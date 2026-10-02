/**
 * File:            server.ts
 * Description:     Full-stack Express server with Vite middleware mount, backward-compatible Flask runner API,
 *                  BEJSON file storage, and server-side @google/genai SDK integration.
 * Version:         3.1.9
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * RELATIONAL_ID:   4b38d122-cc4a-4a25-ae19-86c29124be31
 */

import express, { Request, Response } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

import {
  parse,
  serialize,
  validateDocument,
  bejson_core_get_field_map,
} from "./src/lib/index";
import {
  computeUnifiedDiff,
  stripMarkdownFences,
  assembleJobPrompt,
  extractTasksFromJobDoc,
  getActivePendingTask,
  commitTaskInJobDoc,
  recordTaskAuditFailure,
  StagedEvolution,
} from "./src/lib/lib_bejson_Runner_engine";
import {
  RUNNER_TEMPLATES,
  instantiateJobDocFromTemplate,
} from "./src/lib/lib_bejson_Runner_templates";
import {
  DEFAULT_MODEL,
  createEmptyKeyStoreDoc,
} from "./src/lib/lib_bejson_Runner_keys";
import {
  buildSpreadsheetAnalogySystemInstruction,
  diagnoseValidationFailure,
} from "./src/lib/lib_bejson_Runner_generator";

dotenv.config();

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const BASE_DIR = __dirname;
const JOBS_DIR = path.join(BASE_DIR, "jobs");
const REGISTRY_PATH = path.join(BASE_DIR, "registry.bejson");
const STAGE_TTL_MS = 600 * 1000;

// Ensure directories
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });

// Allowed containment roots
const ALLOWED_ROOTS = [
  path.resolve(BASE_DIR),
  "/storage/emulated/0",
  "/storage/7B30-0E0B",
  "/storage/FE5F-F510",
];

function validatePathContainment(candidatePath: string): boolean {
  const resolved = path.resolve(candidatePath);
  for (const root of ALLOWED_ROOTS) {
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return true;
    }
  }
  return false;
}

function resolveContainedPath(relativeOrAbs: string): { resolved: string | null; error: string | null } {
  const candidate = path.isAbsolute(relativeOrAbs)
    ? path.resolve(relativeOrAbs)
    : path.resolve(BASE_DIR, relativeOrAbs);

  if (!validatePathContainment(candidate)) {
    return { resolved: null, error: `Path escapes allowed containment roots: ${relativeOrAbs}` };
  }
  return { resolved: candidate, error: null };
}

// In-memory staged mutations
const activeStages = new Map<string, StagedEvolution>();

function cleanupExpiredStages(): void {
  const now = Date.now();
  for (const [id, stage] of activeStages.entries()) {
    if (now - stage.createdAt > STAGE_TTL_MS) {
      activeStages.delete(id);
    }
  }
}

// Sync registry with disk files
function syncRegistryFromDisk(): any {
  let regDoc: any = null;
  if (fs.existsSync(REGISTRY_PATH)) {
    try {
      regDoc = parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    } catch {
      regDoc = null;
    }
  }

  if (!regDoc || !Array.isArray(regDoc.Fields)) {
    regDoc = {
      Format: "BEJSON",
      Format_Version: "104a",
      Format_Creator: "Elton Boehnen",
      Records_Type: ["JobRegistry"],
      Fields: [
        { name: "entry_id", type: "string" },
        { name: "entry_name", type: "string" },
        { name: "entry_slug", type: "string" },
        { name: "entry_type", type: "string" },
        { name: "file_path", type: "string" },
        { name: "created_date", type: "string" },
        { name: "modified_date", type: "string" },
      ],
      Values: [],
    };
  }

  const fmap = bejson_core_get_field_map(regDoc);
  const knownPaths = new Set<string>();
  for (const row of regDoc.Values || []) {
    const fp = String(row[fmap["file_path"]] || "").replace(/\\/g, "/");
    knownPaths.add(fp);
  }

  const candidates: string[] = [];
  if (fs.existsSync(JOBS_DIR)) {
    const files = fs.readdirSync(JOBS_DIR);
    for (const f of files) {
      if (f.endsWith(".json") || f.endsWith(".bejson")) {
        candidates.push(path.join("jobs", f).replace(/\\/g, "/"));
      }
    }
  }

  let modified = false;
  const today = new Date().toISOString().slice(0, 10);

  for (const rel of candidates) {
    if (!knownPaths.has(rel)) {
      const absPath = path.join(BASE_DIR, rel);
      try {
        const raw = fs.readFileSync(absPath, "utf-8");
        const doc = parse(raw);
        if (Array.isArray(doc.Records_Type) && doc.Records_Type[0] === "JobSchema") {
          const entryName = (doc as any)["Job_Name"] || path.basename(rel, path.extname(rel)).replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const slug = path.basename(rel, path.extname(rel)).toLowerCase().replace(/[^a-z0-9]/g, "_");
          const row = [
            crypto.randomUUID(),
            entryName,
            slug,
            "schema",
            rel,
            today,
            today,
          ];
          regDoc.Values.push(row);
          knownPaths.add(rel);
          modified = true;
        }
      } catch {
        // ignore unparseable
      }
    }
  }

  if (modified) {
    fs.writeFileSync(REGISTRY_PATH, serialize(regDoc, 2), "utf-8");
  }

  return regDoc;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Static serving for vanilla JavaScript mirror in /js and its mirrored libraries in /src/lib/lib_js
  app.use("/js", express.static(path.join(BASE_DIR, "js")));
  app.use("/src/lib/lib_js", express.static(path.join(BASE_DIR, "src", "lib", "lib_js")));

  // ---------------------------------------------------------------------------
  // API: Registry Endpoints (Backward Compatible with Flask API)
  // ---------------------------------------------------------------------------

  app.get("/api/registry", (req: Request, res: Response) => {
    try {
      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);
      const etype = (req.query.type as string) || "schema";

      const entries: Array<{ entry_id: string; entry_name: string; file_path: string; modified_date: string }> = [];
      for (const row of regDoc.Values || []) {
        if (row[fmap["entry_type"]] === etype) {
          entries.push({
            entry_id: String(row[fmap["entry_id"]]),
            entry_name: String(row[fmap["entry_name"]]),
            file_path: String(row[fmap["file_path"]]),
            modified_date: String(row[fmap["modified_date"]]),
          });
        }
      }

      entries.sort((a, b) => a.entry_name.localeCompare(b.entry_name));
      res.json({ ok: true, entries });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: `Failed to load registry: ${err.message}` });
    }
  });

  app.post("/api/registry", (req: Request, res: Response) => {
    try {
      const { entry_name, entry_type, file_path: targetFilePath } = req.body;
      if (!entry_name || !entry_type || !targetFilePath) {
        return res.status(400).json({ ok: false, error: "Missing required fields: entry_name, entry_type, file_path" });
      }

      const { resolved, error } = resolveContainedPath(targetFilePath);
      if (error) return res.status(403).json({ ok: false, error });

      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);
      const entryId = crypto.randomUUID();
      const now = new Date().toISOString().slice(0, 10);
      const slug = entry_name.toLowerCase().replace(/[^a-z0-9]/g, "_");

      const relPath = path.relative(BASE_DIR, resolved!).replace(/\\/g, "/");
      const row = [entryId, entry_name, slug, entry_type, relPath, now, now];
      regDoc.Values.push(row);

      fs.writeFileSync(REGISTRY_PATH, serialize(regDoc, 2), "utf-8");
      res.json({ ok: true, entry_id: entryId });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get("/api/entry/:id", (req: Request, res: Response) => {
    try {
      const entryId = req.params.id;
      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);

      const row = (regDoc.Values || []).find((r: any[]) => String(r[fmap["entry_id"]]) === entryId);
      if (!row) {
        return res.status(404).json({ ok: false, error: "Job entry not found in registry." });
      }

      const relFile = String(row[fmap["file_path"]]);
      const { resolved, error } = resolveContainedPath(relFile);
      if (error || !resolved || !fs.existsSync(resolved)) {
        return res.status(404).json({ ok: false, error: `Job file not found on disk: ${relFile}` });
      }

      const doc = parse(fs.readFileSync(resolved, "utf-8"));
      const tasks = extractTasksFromJobDoc(doc);

      res.json({
        ok: true,
        entry_id: entryId,
        entry_name: row[fmap["entry_name"]],
        entry_type: row[fmap["entry_type"]],
        file_path: relFile,
        goal: (doc as any)["Job_Goal"] || "",
        complete: Boolean((doc as any)["Job_Complete"]),
        target_file: (doc as any)["Target_File"] || "Joob_Runner.py",
        tasks,
        raw_doc: doc,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // API: Runner Execution & Diff Staging
  // ---------------------------------------------------------------------------

  app.post("/api/run/stage", async (req: Request, res: Response) => {
    cleanupExpiredStages();

    const { entry_id, target_file, custom_prompt, api_key, model } = req.body;
    let activeTask: any = null;
    let resolvedTarget: string | null = null;
    let chosenModel = model || DEFAULT_MODEL;

    try {
      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);
      const row = (regDoc.Values || []).find((r: any[]) => String(r[fmap["entry_id"]]) === entry_id);

      let jobDoc: any;
      let jobPath: string;

      if (row) {
        const { resolved, error } = resolveContainedPath(String(row[fmap["file_path"]]));
        if (error || !resolved || !fs.existsSync(resolved)) {
          return res.status(404).json({ ok: false, error: "Target job file could not be resolved." });
        }
        jobPath = resolved;
        jobDoc = parse(fs.readFileSync(jobPath, "utf-8"));
      } else if (req.body.job_doc) {
        jobDoc = req.body.job_doc;
        jobPath = path.join(JOBS_DIR, `temp_${Date.now()}.bejson`);
      } else {
        return res.status(404).json({ ok: false, error: "Job entry not found." });
      }

      const pending = getActivePendingTask(jobDoc);
      activeTask = pending.activeTask;
      const lastOutput = pending.lastOutput;
      const allCompleted = pending.allCompleted;

      if (allCompleted || !activeTask) {
        return res.json({ ok: true, all_completed: true, message: "All tasks completed." });
      }

      // Resolve target file
      const targetRel = target_file || (jobDoc as any)["Target_File"] || "Joob_Runner.py";
      const { resolved: resolvedTargetCandidate, error: targetErr } = resolveContainedPath(targetRel);
      if (targetErr || !resolvedTargetCandidate) {
        return res.status(403).json({ ok: false, error: targetErr || "Target file resolution forbidden." });
      }
      resolvedTarget = resolvedTargetCandidate;

      // Ensure target directory exists on disk
      const targetDir = path.dirname(resolvedTarget);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let originalCode = "";
      if (fs.existsSync(resolvedTarget)) {
        originalCode = fs.readFileSync(resolvedTarget, "utf-8");
      }

      // Assemble prompt
      const attachedFiles = req.body.attached_files || [];
      const { systemInstruction, userPrompt } = assembleJobPrompt(jobDoc, activeTask, lastOutput, attachedFiles);
      const turnPrompt = `${userPrompt}\n\n### EXISTING FILE CONTENTS (${path.basename(resolvedTarget)}):\n\`\`\`\n${originalCode}\n\`\`\`${
        custom_prompt ? `\n\n### ADDITIONAL USER INSTRUCTION:\n${custom_prompt}` : ""
      }`;

      // Synchronous Prompt Archiving (Section 3.3 & 11.2)
      try {
        const promptsLogPath = path.join(BASE_DIR, "dev", "prompts.md");
        const logEntry = `\n\n## Dispatched [${new Date().toISOString()}] Task ${activeTask.taskOrder}: ${activeTask.taskName}\n**System Instruction:**\n\`\`\`text\n${systemInstruction}\n\`\`\`\n**Turn Prompt:**\n\`\`\`text\n${turnPrompt}\n\`\`\`\n`;
        fs.appendFileSync(promptsLogPath, logEntry, "utf-8");
      } catch {
        // Non-blocking log
      }

      // Dispatch to Gemini SDK
      const resolvedApiKey = api_key || process.env.GEMINI_API_KEY;
      if (!resolvedApiKey) {
        return res.status(400).json({
          ok: false,
          error: "No Gemini API key available. Configure a key in Key Manager or ensure GEMINI_API_KEY is present in environment.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey: resolvedApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      chosenModel = model || (jobDoc as any)["Selected_Model"] || DEFAULT_MODEL;
      let aiResponse;
      let synthesizedText = "";
      let fallbackChain: string[] = [chosenModel];
      if (chosenModel !== "gemini-3.5-flash-lite") fallbackChain.push("gemini-3.5-flash-lite");
      if (chosenModel !== "gemini-3.6-flash") fallbackChain.push("gemini-3.6-flash");
      if (chosenModel !== "gemini-2.5-flash") fallbackChain.push("gemini-2.5-flash");

      let lastModelError: Error | null = null;
      let modelUsed = chosenModel;

      for (const candidateModel of fallbackChain) {
        try {
          aiResponse = await ai.models.generateContent({
            model: candidateModel,
            contents: turnPrompt,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
          synthesizedText = aiResponse.text || "";
          if (synthesizedText.trim()) {
            modelUsed = candidateModel;
            chosenModel = candidateModel;
            break;
          }
        } catch (sdkErr: any) {
          lastModelError = sdkErr;
          console.warn(`[Gemini SDK] Execution on model ${candidateModel} failed: ${sdkErr.message}. Attempting fallback if available...`);
        }
      }

      if (!synthesizedText.trim()) {
        const errorDetail = lastModelError ? lastModelError.message : "Model returned an empty response across all attempted models.";
        return res.status(502).json({
          ok: false,
          error: `Stage evolution synthesis failed: ${errorDetail}`,
          attempted_models: fallbackChain,
          details: lastModelError?.stack || String(lastModelError),
        });
      }

      const candidateCode = stripMarkdownFences(synthesizedText);

      // AST / Execution gate verification
      let auditPassed = true;
      let auditFailReason = "";

      // Optional test command gate
      if (activeTask.auditEnabled && activeTask.testCmd && activeTask.testCmd.trim()) {
        const tempTestPath = `${resolvedTarget}.test_clone_${Date.now()}`;
        try {
          fs.writeFileSync(tempTestPath, candidateCode, "utf-8");
          const cmd = activeTask.testCmd.replace(/\{SCRIPT\}/g, tempTestPath);
          await execAsync(cmd, { timeout: 30000 });
        } catch (execErr: any) {
          auditPassed = false;
          auditFailReason = `Subprocess gate failure: ${execErr.message}`;
        } finally {
          if (fs.existsSync(tempTestPath)) fs.unlinkSync(tempTestPath);
        }
      }

      if (!auditPassed) {
        const updatedDoc = recordTaskAuditFailure(jobDoc, activeTask.taskId, auditFailReason);
        if (jobPath && fs.existsSync(jobPath)) {
          fs.writeFileSync(jobPath, serialize(updatedDoc, 2), "utf-8");
        }
        return res.status(422).json({
          ok: false,
          error: `Audit gate failed for Task ${activeTask.taskOrder}: ${auditFailReason}`,
        });
      }

      // Generate diff
      const diff = computeUnifiedDiff(originalCode, candidateCode, path.basename(resolvedTarget));
      const stageId = crypto.randomUUID();

      activeStages.set(stageId, {
        stageId,
        entryId: entry_id,
        taskOrder: activeTask.taskOrder,
        taskName: activeTask.taskName,
        targetFile: resolvedTarget,
        originalCode,
        candidateCode,
        diff,
        createdAt: Date.now(),
      });

      res.json({
        ok: true,
        all_completed: false,
        stage_id: stageId,
        task_id: activeTask.taskId,
        task_order: activeTask.taskOrder,
        task_name: activeTask.taskName,
        target_file: path.basename(resolvedTarget),
        diff,
        candidate_code: candidateCode,
        model_used: modelUsed,
      });
    } catch (err: any) {
      console.error("[/api/run/stage error]", err);
      res.status(500).json({
        ok: false,
        error: `Stage evolution failed: ${err.message}`,
        details: err.stack || String(err),
        model: chosenModel,
        task_order: activeTask?.taskOrder,
        task_name: activeTask?.taskName,
        target_file: resolvedTarget ? path.basename(resolvedTarget) : undefined,
      });
    }
  });

  app.post("/api/run/commit", (req: Request, res: Response) => {
    cleanupExpiredStages();
    const { stage_id } = req.body;

    if (!stage_id || !activeStages.has(stage_id)) {
      return res.status(404).json({ ok: false, error: "Invalid or expired stage ID." });
    }

    const stage = activeStages.get(stage_id)!;
    activeStages.delete(stage_id);

    try {
      // 1. Atomic write candidate code to target file
      const targetDir = path.dirname(stage.targetFile);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const tempPath = `${stage.targetFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, stage.candidateCode, "utf-8");
      fs.renameSync(tempPath, stage.targetFile);

      // 2. Update job doc
      let jobDoc: any = null;
      let jobFilePath: string | null = null;

      if (stage.entryId) {
        const regDoc = syncRegistryFromDisk();
        const fmap = bejson_core_get_field_map(regDoc);
        const row = (regDoc.Values || []).find((r: any[]) => String(r[fmap["entry_id"]]) === stage.entryId);
        if (row) {
          const { resolved } = resolveContainedPath(String(row[fmap["file_path"]]));
          if (resolved && fs.existsSync(resolved)) {
            jobFilePath = resolved;
            jobDoc = parse(fs.readFileSync(jobFilePath, "utf-8"));
          }
        }
      }

      let allDone = false;
      if (jobDoc && jobFilePath) {
        const tasks = extractTasksFromJobDoc(jobDoc);
        const activeT = tasks.find((t) => t.taskOrder === stage.taskOrder);
        if (activeT) {
          const isCreativeOrDocOrWeb = 
            jobDoc.Job_Type === "creative" || 
            jobDoc.Job_Type === "documentation" || 
            jobDoc.Job_Type === "website" || 
            jobDoc.Job_Type === "ui" || 
            jobDoc.Job_Type === "frontend" || 
            jobDoc.Job_Subtype === "novel" || 
            String(jobDoc.Job_Subtype).includes("book") ||
            String(jobDoc.Job_Subtype).includes("website") ||
            String(jobDoc.Job_Subtype).includes("multipage") ||
            String(jobDoc.Job_Subtype).includes("web");

          const traceSummary = isCreativeOrDocOrWeb 
            ? stage.candidateCode 
            : `Task ${stage.taskOrder} [${stage.taskName}] committed atomically.`;

          const updatedDoc = commitTaskInJobDoc(
            jobDoc,
            activeT.taskId,
            traceSummary
          );
          fs.writeFileSync(jobFilePath, serialize(updatedDoc, 2), "utf-8");
          allDone = Boolean((updatedDoc as any)["Job_Complete"]);
        }
      }

      res.json({
        ok: true,
        task_order: stage.taskOrder,
        all_completed: allDone,
        message: `Task ${stage.taskOrder} committed successfully.`,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: `Atomic swap failed: ${err.message}` });
    }
  });

  app.post("/api/run/discard", (req: Request, res: Response) => {
    const { stage_id } = req.body;
    if (stage_id && activeStages.has(stage_id)) {
      activeStages.delete(stage_id);
    }
    res.json({ ok: true, message: "Staged candidate discarded." });
  });

  // ---------------------------------------------------------------------------
  // API: Templates & New Jobs
  // ---------------------------------------------------------------------------

  app.get("/api/templates", (_req: Request, res: Response) => {
    res.json({ ok: true, templates: RUNNER_TEMPLATES });
  });

  app.post("/api/templates/instantiate", (req: Request, res: Response) => {
    try {
      const { template_id, custom_goal, target_file, job_name } = req.body;
      const tmpl = RUNNER_TEMPLATES.find((t) => t.templateId === template_id);
      if (!tmpl) {
        return res.status(404).json({ ok: false, error: "Template not found." });
      }

      const doc = instantiateJobDocFromTemplate(tmpl, custom_goal, target_file);
      const name = job_name || tmpl.templateName;
      (doc as any)["Job_Name"] = name;

      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const filename = `job_${slug}_${Date.now().toString(36)}.bejson`;
      const relPath = path.join("jobs", filename).replace(/\\/g, "/");
      const absPath = path.join(BASE_DIR, relPath);

      fs.writeFileSync(absPath, serialize(doc, 2), "utf-8");

      // Register
      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);
      const entryId = crypto.randomUUID();
      const today = new Date().toISOString().slice(0, 10);
      const row = [entryId, name, slug, "schema", relPath, today, today];
      regDoc.Values.push(row);
      fs.writeFileSync(REGISTRY_PATH, serialize(regDoc, 2), "utf-8");

      res.json({ ok: true, entry_id: entryId, file_path: relPath, job_doc: doc });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // API: AI Job Generator with Spreadsheet Analogies & Self-Correcting Loop
  // ---------------------------------------------------------------------------

  app.post("/api/jobs/generate", async (req: Request, res: Response) => {
    const {
      prompt,
      job_name,
      target_file,
      job_type,
      job_subtype,
      step_count = 5,
      api_key,
      model,
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "Prompt description is required to generate a job." });
    }

    const resolvedApiKey = api_key || process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({
        ok: false,
        error: "No Gemini API key available. Configure a key in Key Manager or ensure GEMINI_API_KEY is present in environment.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    let chosenModel = model || DEFAULT_MODEL;
    const MAX_GEN_ATTEMPTS = 3;
    let currentDiagnosis = "";
    const allDiagnostics: string[] = [];
    let lastCandidateDoc: any = null;
    let lastValidationResult: any = null;

    for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
      const systemInstruction = buildSpreadsheetAnalogySystemInstruction(currentDiagnosis);

      const userTurnPrompt = `Generate a comprehensive BEJSON 104a Job document based on the following project requirement:
### USER SPECIFICATION:
"${prompt.trim()}"

### SPECIFICATION CONSTRAINTS:
- Suggested Job Title: ${job_name ? job_name.trim() : "Custom Autonomous Evolution"}
- Target Script File: ${target_file ? target_file.trim() : "Joob_Runner.py"}
- Primary Job Type: ${job_type || "feature"}
- Job Subtype: ${job_subtype || "typescript"}
- Recommended Step Count: Approximately ${step_count} actionable sequential steps.
- Each step must have clear, granular technical descriptions in "task_description".
- Return STRICTLY a valid JSON object matching the BEJSON 104a spreadsheet format.`;

      // Log prompt to dev/prompts.md per Section 3.3
      try {
        const promptsLogPath = path.join(BASE_DIR, "dev", "prompts.md");
        const logEntry = `\n\n## Job Generation Attempt ${attempt} [${new Date().toISOString()}]\n**System Instruction:**\n\`\`\`text\n${systemInstruction}\n\`\`\`\n**Turn Prompt:**\n\`\`\`text\n${userTurnPrompt}\n\`\`\`\n`;
        fs.appendFileSync(promptsLogPath, logEntry, "utf-8");
      } catch {
        // non-blocking log
      }

      try {
        let aiResponse;
        try {
          aiResponse = await ai.models.generateContent({
            model: chosenModel,
            contents: userTurnPrompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          });
        } catch (sdkErr: any) {
          const errMsg = String(sdkErr.message || "").toLowerCase();
          const isQuotaErr = errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("exhausted") || errMsg.includes("429") || errMsg.includes("overloaded");
          if (isQuotaErr && chosenModel !== "gemini-3.5-flash-lite") {
            console.warn(`[Gemini SDK] Rate limit hit on model ${chosenModel} during generation. Degrading automatically to gemini-3.5-flash-lite and retrying...`);
            try {
              chosenModel = "gemini-3.5-flash-lite";
              aiResponse = await ai.models.generateContent({
                model: chosenModel,
                contents: userTurnPrompt,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  temperature: 0.2,
                },
              });
            } catch (retryErr: any) {
              throw new Error(`Job generation failed on original model and fallback model gemini-3.5-flash-lite: ${retryErr.message}`);
            }
          } else {
            throw sdkErr;
          }
        }

        const rawText = aiResponse.text || "{}";
        let parsedDoc: any;
        try {
          parsedDoc = parse(rawText);
        } catch (jsonErr: any) {
          currentDiagnosis = `Attempt ${attempt} returned invalid JSON syntax: ${jsonErr.message}. Ensure you emit strictly valid, parseable JSON matching the BEJSON 104a schema.`;
          allDiagnostics.push(currentDiagnosis);
          continue;
        }

        lastCandidateDoc = parsedDoc;

        // Ensure required 104a top-level keys
        if (!parsedDoc.Format) parsedDoc.Format = "BEJSON";
        if (!parsedDoc.Format_Version) parsedDoc.Format_Version = "104a";
        if (!parsedDoc.Format_Creator) parsedDoc.Format_Creator = "Elton Boehnen";
        if (!parsedDoc.Records_Type) parsedDoc.Records_Type = ["JobTask"];

        // Run strict Elton Boehnen Core BEJSON validators
        const valResult = validateDocument(parsedDoc);
        lastValidationResult = valResult;

        if (valResult.valid) {
          // Success! Save to disk and register in registry.bejson
          const title = job_name || (parsedDoc as any)["Job_Name"] || "Generated Job";
          (parsedDoc as any)["Job_Name"] = title;
          (parsedDoc as any)["Creation_Date"] = new Date().toISOString().slice(0, 10);
          (parsedDoc as any)["Target_File"] = target_file || (parsedDoc as any)["Target_File"] || "Joob_Runner.py";

          const slug = title.toLowerCase().replace(/[^a-z0-9]/g, "_");
          const filename = `job_${slug}_${Date.now().toString(36)}.bejson`;
          const relPath = path.join("jobs", filename).replace(/\\/g, "/");
          const absPath = path.join(BASE_DIR, relPath);

          fs.writeFileSync(absPath, serialize(parsedDoc, 2), "utf-8");

          const regDoc = syncRegistryFromDisk();
          const fmap = bejson_core_get_field_map(regDoc);
          const entryId = crypto.randomUUID();
          const today = new Date().toISOString().slice(0, 10);
          const row = [entryId, title, slug, "schema", relPath, today, today];
          regDoc.Values.push(row);
          fs.writeFileSync(REGISTRY_PATH, serialize(regDoc, 2), "utf-8");

          return res.json({
            ok: true,
            job_doc: parsedDoc,
            entry_id: entryId,
            file_path: relPath,
            attempts_count: attempt,
            diagnostics: allDiagnostics,
            message: `Successfully generated and validated Job document on attempt ${attempt}.`,
          });
        }

        // If validation failed, diagnose and inject into next turn
        const diag = diagnoseValidationFailure(valResult);
        currentDiagnosis = `Attempt ${attempt} BEJSON validation failed with ${valResult.errors.length} error(s):\n${diag}`;
        allDiagnostics.push(currentDiagnosis);
      } catch (genErr: any) {
        currentDiagnosis = `Attempt ${attempt} execution error: ${genErr.message}`;
        allDiagnostics.push(currentDiagnosis);
      }
    }

    // If loop finishes without success
    return res.status(422).json({
      ok: false,
      error: `Failed to generate a valid BEJSON 104a Job document after ${MAX_GEN_ATTEMPTS} attempts.`,
      attempts_count: MAX_GEN_ATTEMPTS,
      diagnostics: allDiagnostics,
      validation_errors: lastValidationResult ? lastValidationResult.errors : [],
      raw_candidate: lastCandidateDoc,
    });
  });

  app.post("/api/jobs/save", (req: Request, res: Response) => {
    try {
      const { entry_id, job_doc } = req.body;
      if (!job_doc) return res.status(400).json({ ok: false, error: "No job_doc provided." });

      const validation = validateDocument(job_doc);
      if (!validation.valid && validation.errors.length > 0) {
        return res.status(400).json({
          ok: false,
          error: `BEJSON validation error: ${validation.errors[0].message}`,
        });
      }

      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);
      const row = (regDoc.Values || []).find((r: any[]) => String(r[fmap["entry_id"]]) === entry_id);

      if (!row) return res.status(404).json({ ok: false, error: "Job entry not found in registry." });

      const relPath = String(row[fmap["file_path"]]);
      const { resolved } = resolveContainedPath(relPath);
      if (!resolved) return res.status(403).json({ ok: false, error: "Path forbidden." });

      fs.writeFileSync(resolved, serialize(job_doc, 2), "utf-8");
      res.json({ ok: true, message: "Job document saved atomically." });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // API: Meta Assets (Schemas for Tab 3)
  // ---------------------------------------------------------------------------

  app.get("/api/schemas/assets", (_req: Request, res: Response) => {
    const assets = [
      {
        id: "job-schema-v1",
        name: "Job Schema (v1.0)",
        filename: "job-schema-v1.0.bejson",
        doc: {
          Format: "BEJSON",
          Format_Version: "104a",
          Format_Creator: "Elton Boehnen",
          Schema_Name: "Job Schema",
          Schema_Version: "1.0",
          Schema_Description: "Official schema for task creation, execution, context chunking, and audit gates.",
          Job_Goal: "",
          Goal_Rules: "",
          Job_Type: "conversion",
          Job_Subtype: "typescript",
          Contextualize_Plan: false,
          Contextualize_Last: false,
          Job_Complete: false,
          Creation_Date: "2026-09-27",
          Completion_Date: "",
          Records_Type: ["JobTask"],
          Fields: [
            { name: "task_id", type: "string" },
            { name: "task_order", type: "integer" },
            { name: "task_name", type: "string" },
            { name: "task_description", type: "string" },
            { name: "task_completed", type: "boolean" },
            { name: "audit_enabled", type: "boolean" },
            { name: "audit_passed", type: "boolean" },
            { name: "audit_fail_reason", type: "string" },
            { name: "task_context", type: "array" },
            { name: "task_reference", type: "array" },
            { name: "task_mandatory", type: "boolean" },
          ],
          Values: [],
        },
      },
      {
        id: "job-registry-v104a",
        name: "Job Registry Schema (v104a)",
        filename: "registry.bejson",
        doc: {
          Format: "BEJSON",
          Format_Version: "104a",
          Format_Creator: "Elton Boehnen",
          Records_Type: ["JobRegistry"],
          Fields: [
            { name: "entry_id", type: "string" },
            { name: "entry_name", type: "string" },
            { name: "entry_slug", type: "string" },
            { name: "entry_type", type: "string" },
            { name: "file_path", type: "string" },
            { name: "created_date", type: "string" },
            { name: "modified_date", type: "string" },
          ],
          Values: [],
        },
      },
      {
        id: "base-project-v160",
        name: "Base Project Schema (v1.6.0)",
        filename: "bejson_project.json",
        doc: {
          Format: "BEJSON",
          Format_Version: "104a",
          Format_Creator: "Elton Boehnen",
          Session_Id: "eca99674-337f-477b-96a6-1721098989b2",
          Project_Name: "Job_Runner",
          Project_Modified_Date: "2026-09-27",
          Project_Description: "Unified standalone job creation system and self-evolving runner.",
          Schema_Version: "1.6.0",
          Project_Version: "3.1.6",
          Package_Version: "104",
          Project_GUID: "2f924a82-fa7b-466e-bd8e-f31551e5ca5e",
          Records_Type: ["RootPackage"],
          Fields: [
            { name: "Project_Name", type: "string" },
            { name: "Project_Version", type: "string" },
            { name: "Package_Version", type: "string" },
            { name: "Project_Root_Path", type: "string" },
            { name: "Project_GUID", type: "string" },
            { name: "Session_Id", type: "string" },
            { name: "Author", type: "string" },
            { name: "Description", type: "string" },
            { name: "Project_Modified_Date", type: "string" },
            { name: "Package_Date", type: "string" },
            { name: "Remote_Repo", type: "string" },
            { name: "Launcher", type: "string" },
            { name: "Marker_File_Path", type: "string" },
            { name: "Drive_Path", type: "string" },
            { name: "First_Detected_Date", type: "string" },
            { name: "Last_Seen_Date", type: "string" },
            { name: "Detected_By_Index_Type", type: "string" },
            { name: "Raw_JSON", type: "string" },
            { name: "change_log", type: "string" },
            { name: "Known_Issues", type: "string" },
            { name: "User_Feedback", type: "string" },
          ],
          Values: [],
        },
      },
      {
        id: "key-store-v1",
        name: "Key Store Schema (v1.0)",
        filename: "key_store.bejson",
        doc: createEmptyKeyStoreDoc(),
      },
      {
        id: "chunked-104a",
        name: "Chunked 104a Schema (v1.0.1)",
        filename: "chunked-104a.bejson",
        doc: {
          Format: "BEJSON",
          Format_Version: "104a",
          Format_Creator: "Elton Boehnen",
          Schema_Name: "Chunked-104a",
          Schema_Version: "1.0.1",
          Schema_Description: "Standard schema for chunking single projects.",
          Chunk_Date: "2026-09-27",
          Session_Is_Mounted: false,
          Mount_Path: "",
          Records_Type: ["Chunked"],
          Fields: [
            { name: "File_Name", type: "string" },
            { name: "File_Extension", type: "string" },
            { name: "File_Content", type: "string" },
            { name: "File_Version", type: "string" },
            { name: "File_Hash", type: "string" },
            { name: "Relative_Path", type: "string" },
            { name: "Is_Binary", type: "boolean" },
            { name: "Is_Mounted", type: "boolean" },
          ],
          Values: [],
        },
      },
    ];

    // 1. Incorporate all RUNNER_TEMPLATES as exportable schemas
    for (const tmpl of RUNNER_TEMPLATES) {
      assets.push({
        id: `template-${tmpl.templateId}`,
        name: `Template: ${tmpl.templateName}`,
        filename: `template-${tmpl.templateId}.bejson`,
        doc: instantiateJobDocFromTemplate(tmpl, tmpl.defaultGoal, "Joob_Runner.py"),
      });
    }

    // 2. Incorporate all registered jobs dynamically from registry as exportable schemas
    try {
      const regDoc = syncRegistryFromDisk();
      const fmap = bejson_core_get_field_map(regDoc);
      for (const row of regDoc.Values || []) {
        const id = String(row[fmap["entry_id"]]);
        const name = String(row[fmap["entry_name"]]);
        const relPath = String(row[fmap["file_path"]]);
        const { resolved } = resolveContainedPath(relPath);
        if (resolved && fs.existsSync(resolved)) {
          try {
            const fileContent = fs.readFileSync(resolved, "utf-8");
            const parsed = parse(fileContent);
            assets.push({
              id: `job-file-${id}`,
              name: `Job: ${name}`,
              filename: path.basename(relPath),
              doc: parsed,
            });
          } catch {
            // skip unparseable or corrupted job files
          }
        }
      }
    } catch {
      // skip registry loading failure
    }

    res.json({ ok: true, assets });
  });

  // ---------------------------------------------------------------------------
  // Vite Integration (Dev Mode: middlewares, Prod Mode: static dist)
  // ---------------------------------------------------------------------------
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(BASE_DIR, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  const server = http.createServer(app);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`JobMaker & Job Runner server online at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server startup failure:", err);
  process.exit(1);
});
