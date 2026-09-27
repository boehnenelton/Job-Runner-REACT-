/**
 * Library:         lib_bejson_Runner_engine.ts
 * Family:          Runner
 * Module Purpose:  Autonomous task execution engine, prompt synthesis assembler, unified diff generator, and BEJSON 104a Job document updater.
 * Architecture:    BEJSON 104a field map cached task state machine with multi-gate validation and atomic commit protocol.
 * Version:         3.1.6
 * Release_Version: 300
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   5c81f092-7489-4bc2-965a-8bfe3f92d131
 */

import { BEJSONDocument } from "./lib_bejson_Core_bejson_types";
import { bejson_core_get_field_map } from "./lib_bejson_Core_bejson_field_map";

export interface JobTaskItem {
  taskId: string;
  taskOrder: number;
  taskName: string;
  taskDescription: string;
  taskCompleted: boolean;
  auditEnabled: boolean;
  auditPassed: boolean;
  auditFailReason: string;
  taskContext: any[];
  taskReference: any[];
  taskMandatory: boolean;
  testCmd?: string;
}

export interface StagedEvolution {
  stageId: string;
  entryId?: string;
  taskOrder: number;
  taskName: string;
  targetFile: string;
  originalCode: string;
  candidateCode: string;
  diff: string;
  createdAt: number;
}

/**
 * Parses cell value to JSON if string-encoded, per 104a cell typing rules.
 */
export function cellFromJsonString(val: any): any[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Extracts typed task items from a BEJSON 104a Job document using cached field maps.
 */
export function extractTasksFromJobDoc(jobDoc: BEJSONDocument): JobTaskItem[] {
  const fmap = bejson_core_get_field_map(jobDoc);
  const rows = jobDoc.Values || [];
  const tasks: JobTaskItem[] = [];

  for (const row of rows) {
    const rawCtx = fmap["task_context"] !== undefined ? row[fmap["task_context"]] : "[]";
    const rawRef = fmap["task_reference"] !== undefined ? row[fmap["task_reference"]] : "[]";

    tasks.push({
      taskId: String(row[fmap["task_id"]] ?? ""),
      taskOrder: Number(row[fmap["task_order"]] ?? 0),
      taskName: String(row[fmap["task_name"]] ?? ""),
      taskDescription: String(row[fmap["task_description"]] ?? ""),
      taskCompleted: Boolean(row[fmap["task_completed"]]),
      auditEnabled: Boolean(fmap["audit_enabled"] !== undefined ? row[fmap["audit_enabled"]] : false),
      auditPassed: Boolean(fmap["audit_passed"] !== undefined ? row[fmap["audit_passed"]] : false),
      auditFailReason: String(fmap["audit_fail_reason"] !== undefined ? row[fmap["audit_fail_reason"]] ?? "" : ""),
      taskContext: cellFromJsonString(rawCtx),
      taskReference: cellFromJsonString(rawRef),
      taskMandatory: Boolean(fmap["task_mandatory"] !== undefined ? row[fmap["task_mandatory"]] : false),
      testCmd: fmap["test_cmd"] !== undefined ? String(row[fmap["test_cmd"]] ?? "") : "",
    });
  }

  return tasks.sort((a, b) => a.taskOrder - b.taskOrder);
}

/**
 * Finds the current active pending task in a Job document.
 */
export function getActivePendingTask(jobDoc: BEJSONDocument): { activeTask: JobTaskItem | null; lastOutput: string; allCompleted: boolean } {
  const tasks = extractTasksFromJobDoc(jobDoc);
  let activeTask: JobTaskItem | null = null;
  let lastOutput = "";

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task.taskCompleted) {
      activeTask = task;
      if (i > 0) {
        const prevTask = tasks[i - 1];
        const traces = (jobDoc as any)["Execution_Traces"] || {};
        lastOutput = traces[prevTask.taskId] || "";
      }
      break;
    }
  }

  const allCompleted = tasks.length > 0 && tasks.every((t) => t.taskCompleted);
  return { activeTask, lastOutput, allCompleted };
}

export interface AttachedFile {
  id: string;
  name: string;
  path: string;
  content: string;
  size: number;
  isChecked: boolean;
  type: "context" | "work";
}

/**
 * Assembles the surgical AI prompt for the active task following the exact specification.
 */
export function assembleJobPrompt(
  jobDoc: BEJSONDocument,
  activeTask: JobTaskItem,
  lastOutput: string,
  attachedFiles?: AttachedFile[]
): { systemInstruction: string; userPrompt: string } {
  const systemInstruction =
    "You are an expert autonomous code architect. Apply surgical modifications to the target file to satisfy the active task instructions. Return strictly the complete, valid, updated code without markdown wrappers or conversational filler.";

  const parts: string[] = [];

  if ((jobDoc as any)["Contextualize_Plan"]) {
    parts.push(`### GLOBAL JOB GOAL\n${(jobDoc as any)["Job_Goal"] || "Perform requested updates."}`);
    const tasks = extractTasksFromJobDoc(jobDoc);
    const scope = tasks
      .map((t) => `- Step ${t.taskOrder}: ${t.taskName} [${t.taskCompleted ? "DONE" : "PENDING"}]`)
      .join("\n");
    parts.push(`### FULL PLAN SCOPE\n${scope}`);
  }

  if ((jobDoc as any)["Contextualize_Last"] && lastOutput) {
    parts.push(`### PREVIOUS TASK OUTPUT / TRACEBACK\n${lastOutput}`);
  }

  parts.push(`### ACTIVE TASK ${activeTask.taskOrder}: ${activeTask.taskName}\n${activeTask.taskDescription}`);

  // Built-in task context chunks
  if (activeTask.taskContext && activeTask.taskContext.length > 0) {
    for (const ctx of activeTask.taskContext) {
      if (ctx && ctx.text_based && Array.isArray(ctx.chunks)) {
        for (const ch of ctx.chunks) {
          parts.push(`### CONTEXT CHUNK (${ch.chunk_label || "context"}):\n${ch.chunk_content || ""}`);
        }
      }
    }
  }

  // User Attachments: Context Files (Read-Only Study) vs Work Attachments (Direct Task Work)
  if (attachedFiles && attachedFiles.length > 0) {
    const activeContextFiles = attachedFiles.filter((f) => f.type === "context" && f.isChecked);
    const activeWorkFiles = attachedFiles.filter((f) => f.type === "work" && f.isChecked);

    if (activeContextFiles.length > 0) {
      const contextBlocks = activeContextFiles.map(
        (f) => `#### [Context File: ${f.name} | Path: ${f.path}]\n${f.content}`
      );
      parts.push(
        `### READ-ONLY CONTEXT STUDY MATERIAL (FOR AI STUDY & LEARNING ONLY - DO NOT REPLICATE OR OVERWRITE):\n${contextBlocks.join("\n\n")}`
      );
    }

    if (activeWorkFiles.length > 0) {
      const workBlocks = activeWorkFiles.map(
        (f) => `#### [Work File: ${f.name} | Path: ${f.path}]\n${f.content}`
      );
      parts.push(
        `### WORK ATTACHMENTS (FILES FOR ACTIVE TASK EXECUTION & REFACTORING):\n${workBlocks.join("\n\n")}`
      );
    }
  }

  return { systemInstruction, userPrompt: parts.join("\n\n") };
}

/**
 * Strips markdown code block fences (```lang ... ```).
 */
export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\r?\n/, "");
  cleaned = cleaned.replace(/\r?\n```\s*$/, "");
  return cleaned.trim();
}

/**
 * Pure TypeScript Unified Diff computation.
 * Produces standard unidiff representation suitable for terminal or diff viewers.
 */
export function computeUnifiedDiff(originalText: string, newText: string, filename: string = "target"): string {
  const origLines = originalText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  // Compute Longest Common Subsequence matrix
  const m = origLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (origLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to extract diff edits
  let i = m;
  let j = n;
  const diffOps: Array<{ type: "equal" | "delete" | "insert"; line: string; origIdx?: number; newIdx?: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === newLines[j - 1]) {
      diffOps.unshift({ type: "equal", line: origLines[i - 1], origIdx: i, newIdx: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffOps.unshift({ type: "insert", line: newLines[j - 1], newIdx: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffOps.unshift({ type: "delete", line: origLines[i - 1], origIdx: i });
      i--;
    }
  }

  if (diffOps.every((op) => op.type === "equal")) {
    return "(No differences detected)";
  }

  const header = `--- a/${filename}\n+++ b/${filename}\n`;
  const chunks: string[] = [header];

  // Group diff with 3 lines of context
  const hasChanges = diffOps.some((op) => op.type !== "equal");
  if (!hasChanges) return "(No diff)";

  let hunkOrigStart = 1;
  let hunkNewStart = 1;
  let hunkOrigCount = 0;
  let hunkNewCount = 0;
  const hunkLines: string[] = [];

  for (const op of diffOps) {
    if (op.type === "equal") {
      hunkLines.push(` ${op.line}`);
      hunkOrigCount++;
      hunkNewCount++;
    } else if (op.type === "delete") {
      hunkLines.push(`-${op.line}`);
      hunkOrigCount++;
    } else if (op.type === "insert") {
      hunkLines.push(`+${op.line}`);
      hunkNewCount++;
    }
  }

  chunks.push(`@@ -${hunkOrigStart},${hunkOrigCount} +${hunkNewStart},${hunkNewCount} @@\n` + hunkLines.join("\n"));
  return chunks.join("");
}

/**
 * Updates a BEJSON 104a Job document upon committing a task.
 * Marks task_completed=true, audit_passed=true, appends Execution_Traces, and checks Job_Complete.
 */
export function commitTaskInJobDoc(
  jobDoc: BEJSONDocument,
  taskId: string,
  traceSummary?: string
): BEJSONDocument {
  const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(jobDoc));
  const fmap = bejson_core_get_field_map(clonedDoc);
  const rows = clonedDoc.Values || [];

  let targetOrder = 0;
  for (const row of rows) {
    if (String(row[fmap["task_id"]]) === taskId) {
      row[fmap["task_completed"]] = true;
      if (fmap["audit_passed"] !== undefined) row[fmap["audit_passed"]] = true;
      if (fmap["audit_fail_reason"] !== undefined) row[fmap["audit_fail_reason"]] = "";
      targetOrder = Number(row[fmap["task_order"]]);
      break;
    }
  }

  const traces = (clonedDoc as any)["Execution_Traces"] || {};
  traces[taskId] = traceSummary || `Task ${targetOrder} committed successfully.`;
  (clonedDoc as any)["Execution_Traces"] = traces;

  const allDone = rows.length > 0 && rows.every((r) => Boolean(r[fmap["task_completed"]]));
  if (allDone) {
    (clonedDoc as any)["Job_Complete"] = true;
    (clonedDoc as any)["Completion_Date"] = new Date().toISOString().slice(0, 10);
  }

  return clonedDoc;
}

/**
 * Records an audit failure on a specific task without committing.
 */
export function recordTaskAuditFailure(
  jobDoc: BEJSONDocument,
  taskId: string,
  failReason: string
): BEJSONDocument {
  const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(jobDoc));
  const fmap = bejson_core_get_field_map(clonedDoc);
  const rows = clonedDoc.Values || [];

  for (const row of rows) {
    if (String(row[fmap["task_id"]]) === taskId) {
      if (fmap["audit_passed"] !== undefined) row[fmap["audit_passed"]] = false;
      if (fmap["audit_fail_reason"] !== undefined) row[fmap["audit_fail_reason"]] = failReason;
      break;
    }
  }

  return clonedDoc;
}
