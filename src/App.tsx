/**
 * File:            src/App.tsx
 * Description:     Unified JobMaker & Job Runner React application with BEJSON 104a integration,
 *                  full-stack execution runner, diff review, template engine, Three-Tab Meta-UI,
 *                  and dual Attachment & Read-Only Context File panels with ZIP/folder import.
 * Version:         3.1.7
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * RELATIONAL_ID:   7f19842a-281b-4659-b108-a68194cf2190
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import JSZip from "jszip";
import {
  Play,
  RotateCw,
  FileCode,
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Copy,
  Download,
  Key,
  Layers,
  Menu,
  X,
  FileText,
  ChevronRight,
  ExternalLink,
  Shield,
  ArrowRight,
  Archive,
  Paperclip,
  Eye,
  CheckSquare,
  Square,
  UploadCloud,
  BookOpen,
  Sparkles,
  HelpCircle,
  Terminal,
} from "lucide-react";

import {
  BEJSONDocument,
  BEJSONField,
  validateDocument,
  bejson_core_get_field_map,
  parse,
  serialize,
} from "./lib/index";

import {
  JobTaskItem,
  StagedEvolution,
  AttachedFile,
  extractTasksFromJobDoc,
  getActivePendingTask,
  commitTaskInJobDoc,
  computeUnifiedDiff,
} from "./lib/lib_bejson_Runner_engine";

import {
  RUNNER_TEMPLATES,
  JobTemplateDefinition,
  instantiateJobDocFromTemplate,
  OFFICIAL_JOB_FIELDS,
} from "./lib/lib_bejson_Runner_templates";

import {
  SUPPORTED_GEMINI_MODELS,
  DEFAULT_MODEL,
  createEmptyKeyStoreDoc,
  extractKeySlots,
  getNextRoundRobinKey,
  updateKeySlot,
  KeySlotItem,
} from "./lib/lib_bejson_Runner_keys";

type MainSection = "hub" | "editor" | "runner" | "templates" | "keys" | "attachments" | "generate" | "console";
type ProcessingState = "No keys loaded" | "Idle" | "Sending..." | "Awaiting response..." | "Error";

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  timeFormatted: string;
  category: "RUN_STAGE" | "COMMIT_DIFF" | "DISCARD_DIFF" | "GENERATE_JOB" | "TEMPLATE" | "KEY_STORE" | "FILE_ATTACHMENT" | "REGISTRY" | "DOCUMENT_IO" | "SYSTEM";
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  title: string;
  summary: string;
  endpoint?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestPayload?: any;
  responsePayload?: any;
  errorMessage?: string;
  errorDetails?: string;
}

interface RegistryEntry {
  entry_id: string;
  entry_name: string;
  file_path: string;
  modified_date: string;
}

interface AssetSchemaItem {
  id: string;
  name: string;
  filename: string;
  doc: any;
}

export default function App() {
  // Navigation State
  const [activeSection, setActiveSection] = useState<MainSection>("hub");
  const [hubSubTab, setHubSubTab] = useState<"list" | "import">("list");
  const [editorSubTab, setEditorSubTab] = useState<"tasks" | "json">("tasks");
  const [runnerSubTab, setRunnerSubTab] = useState<"staged" | "traces">("staged");
  const [templatesSubTab, setTemplatesSubTab] = useState<"browse" | "custom">("browse");
  const [keysSubTab, setKeysSubTab] = useState<"slots" | "models">("slots");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Registry & Active Job State
  const [registryEntries, setRegistryEntries] = useState<RegistryEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [activeJobDoc, setActiveJobDoc] = useState<BEJSONDocument | null>(null);
  const [activeJobTasks, setActiveJobTasks] = useState<JobTaskItem[]>([]);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const [targetFileInput, setTargetFileInput] = useState<string>("Joob_Runner.py");
  const [customTurnInstruction, setCustomTurnInstruction] = useState<string>("");

  // Attachments & Read-Only Context Files State
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [attachmentPanelType, setAttachmentPanelType] = useState<"context" | "work">("context");
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null);

  // File Inputs Refs
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Runner Staged Evolution State
  const [stagedEvolution, setStagedEvolution] = useState<StagedEvolution | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);

  // Key Store State (BEJSON 104a stored in localStorage)
  const [keyStoreDoc, setKeyStoreDoc] = useState<BEJSONDocument>(() => {
    const saved = localStorage.getItem("jobmaker_keystore_104a");
    if (saved) {
      try {
        return parse(saved);
      } catch {
        return createEmptyKeyStoreDoc();
      }
    }
    return createEmptyKeyStoreDoc();
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return (keyStoreDoc as any)["Selected_Model"] || DEFAULT_MODEL;
  });

  // Processing & Feedback State
  const [processingState, setProcessingState] = useState<ProcessingState>("Idle");
  const [statusMessage, setStatusMessage] = useState<string>("System standby.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Meta-UI Three-Tab Modal State
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [metaActiveTab, setMetaActiveTab] = useState<1 | 2 | 3>(1);
  const [registeredAssets, setRegisteredAssets] = useState<AssetSchemaItem[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [projectLedgerDoc, setProjectLedgerDoc] = useState<any>(null);

  // AI Job Generator State (Spreadsheet Analogy & Self-Healing Feedback Loop)
  const [genPrompt, setGenPrompt] = useState<string>("");
  const [genJobName, setGenJobName] = useState<string>("");
  const [genTargetFile, setGenTargetFile] = useState<string>("Joob_Runner.py");
  const [genJobType, setGenJobType] = useState<string>("feature");
  const [genJobSubtype, setGenJobSubtype] = useState<string>("typescript");
  const [genStepCount, setGenStepCount] = useState<number>(5);
  const [genModel, setGenModel] = useState<string>(DEFAULT_MODEL);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedJobDoc, setGeneratedJobDoc] = useState<BEJSONDocument | null>(null);
  const [generatedEntryId, setGeneratedEntryId] = useState<string | null>(null);
  const [genDiagnostics, setGenDiagnostics] = useState<string[]>([]);
  const [genAttempts, setGenAttempts] = useState<number>(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccessMessage, setGenSuccessMessage] = useState<string | null>(null);
  const [genSubTab, setGenSubTab] = useState<"create" | "preview" | "diagnostics" | "analogy">("create");

  // Action Console Logs State
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem("jobmaker_action_console_logs");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "init-log",
        timestamp: new Date().toISOString(),
        timeFormatted: new Date().toLocaleTimeString(),
        category: "SYSTEM",
        level: "INFO",
        title: "System Console Ready",
        summary: "Autonomous action logger tracking all stage evolutions, diff reviews, mutations, and backend API interactions.",
        requestPayload: { version: "3.1.11", platform: "Full-Stack TypeScript" },
      },
    ];
  });
  const [consoleFilterLevel, setConsoleFilterLevel] = useState<"all" | "ERROR" | "WARN" | "SUCCESS" | "INFO">("all");
  const [consoleFilterCategory, setConsoleFilterCategory] = useState<string>("all");
  const [consoleSearchQuery, setConsoleSearchQuery] = useState<string>("");
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  function logAction(entry: Omit<ConsoleLogEntry, "id" | "timestamp" | "timeFormatted">) {
    const now = new Date();
    const newEntry: ConsoleLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.toISOString(),
      timeFormatted: now.toLocaleTimeString() + "." + String(now.getMilliseconds()).padStart(3, "0"),
    };
    setConsoleLogs((prev) => {
      const updated = [newEntry, ...prev].slice(0, 300);
      try {
        localStorage.setItem("jobmaker_action_console_logs", JSON.stringify(updated));
      } catch {
        // quota
      }
      return updated;
    });
  }

  function handleCopyAllLogs() {
    if (consoleLogs.length === 0) {
      setSuccessBanner("No logs to copy.");
      return;
    }
    const lines: string[] = [];
    lines.push("================================================================================");
    lines.push("JOBMAKER & JOB RUNNER SYSTEM CONSOLE DEBUG REPORT");
    lines.push(`Export Timestamp: ${new Date().toISOString()}`);
    lines.push(`Total Entries: ${consoleLogs.length}`);
    lines.push(`Active Job: ${(activeJobDoc as any)?.Job_Name || "None"} | Target: ${targetFileInput}`);
    lines.push(`Selected Model: ${selectedModel} | Processing State: ${processingState}`);
    lines.push("Author: Elton Boehnen · boehnenelton2024@gmail.com · github.com/boehnenelton");
    lines.push("================================================================================\n");

    consoleLogs.forEach((log, index) => {
      lines.push(`[#${consoleLogs.length - index}] [${log.timestamp}] [${log.level}] [${log.category}]`);
      lines.push(`TITLE: ${log.title}`);
      lines.push(`SUMMARY: ${log.summary}`);
      if (log.endpoint) {
        lines.push(`HTTP: ${log.method || "GET"} ${log.endpoint} ${log.status ? `[HTTP ${log.status}]` : ""} ${log.durationMs !== undefined ? `(${log.durationMs}ms)` : ""}`);
      }
      if (log.errorMessage) {
        lines.push(`ERROR: ${log.errorMessage}`);
      }
      if (log.errorDetails) {
        lines.push(`ERROR DETAILS:\n${log.errorDetails}`);
      }
      if (log.requestPayload) {
        lines.push(`REQUEST PAYLOAD:\n${typeof log.requestPayload === "string" ? log.requestPayload : JSON.stringify(log.requestPayload, null, 2)}`);
      }
      if (log.responsePayload) {
        lines.push(`RESPONSE PAYLOAD:\n${typeof log.responsePayload === "string" ? log.responsePayload : JSON.stringify(log.responsePayload, null, 2)}`);
      }
      lines.push("--------------------------------------------------------------------------------");
    });

    const fullText = lines.join("\n");
    navigator.clipboard.writeText(fullText);
    setSuccessBanner(`Copied ${consoleLogs.length} console log entries to clipboard! Ready to send for debugging.`);
    logAction({
      category: "SYSTEM",
      level: "INFO",
      title: "Logs Exported to Clipboard",
      summary: `Exported ${consoleLogs.length} action log entries for debugging.`,
    });
  }

  function handleDownloadLogs() {
    if (consoleLogs.length === 0) return;
    const lines: string[] = [];
    lines.push("================================================================================");
    lines.push("JOBMAKER & JOB RUNNER SYSTEM CONSOLE DEBUG REPORT");
    lines.push(`Export Timestamp: ${new Date().toISOString()}`);
    lines.push(`Total Entries: ${consoleLogs.length}`);
    lines.push(`Active Job: ${(activeJobDoc as any)?.Job_Name || "None"} | Target: ${targetFileInput}`);
    lines.push(`Selected Model: ${selectedModel} | Processing State: ${processingState}`);
    lines.push("Author: Elton Boehnen · boehnenelton2024@gmail.com · github.com/boehnenelton");
    lines.push("================================================================================\n");

    consoleLogs.forEach((log, index) => {
      lines.push(`[#${consoleLogs.length - index}] [${log.timestamp}] [${log.level}] [${log.category}]`);
      lines.push(`TITLE: ${log.title}`);
      lines.push(`SUMMARY: ${log.summary}`);
      if (log.endpoint) {
        lines.push(`HTTP: ${log.method || "GET"} ${log.endpoint} ${log.status ? `[HTTP ${log.status}]` : ""} ${log.durationMs !== undefined ? `(${log.durationMs}ms)` : ""}`);
      }
      if (log.errorMessage) lines.push(`ERROR: ${log.errorMessage}`);
      if (log.errorDetails) lines.push(`ERROR DETAILS:\n${log.errorDetails}`);
      if (log.requestPayload) lines.push(`REQUEST: ${typeof log.requestPayload === "string" ? log.requestPayload : JSON.stringify(log.requestPayload, null, 2)}`);
      if (log.responsePayload) lines.push(`RESPONSE: ${typeof log.responsePayload === "string" ? log.responsePayload : JSON.stringify(log.responsePayload, null, 2)}`);
      lines.push("--------------------------------------------------------------------------------");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobmaker-console-debug-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClearLogs() {
    setConsoleLogs([]);
    try {
      localStorage.removeItem("jobmaker_action_console_logs");
    } catch {}
    setSuccessBanner("Console logs cleared.");
  }

  function handleToggleExpandLog(id: string) {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCopySingleLog(log: ConsoleLogEntry) {
    const text = `[${log.timestamp}] [${log.level}] [${log.category}] ${log.title}\nSUMMARY: ${log.summary}\n${log.endpoint ? `HTTP: ${log.method || "POST"} ${log.endpoint} [${log.status || ""}] (${log.durationMs || 0}ms)\n` : ""}${log.errorMessage ? `ERROR: ${log.errorMessage}\n` : ""}${log.errorDetails ? `DETAILS: ${log.errorDetails}\n` : ""}${log.requestPayload ? `REQUEST: ${JSON.stringify(log.requestPayload, null, 2)}\n` : ""}${log.responsePayload ? `RESPONSE: ${JSON.stringify(log.responsePayload, null, 2)}\n` : ""}`;
    navigator.clipboard.writeText(text);
    setSuccessBanner("Log entry copied to clipboard.");
  }

  const errorLogsCount = useMemo(
    () => consoleLogs.filter((l) => l.level === "ERROR").length,
    [consoleLogs]
  );
  const warnLogsCount = useMemo(
    () => consoleLogs.filter((l) => l.level === "WARN").length,
    [consoleLogs]
  );
  const successLogsCount = useMemo(
    () => consoleLogs.filter((l) => l.level === "SUCCESS").length,
    [consoleLogs]
  );
  const infoLogsCount = useMemo(
    () => consoleLogs.filter((l) => l.level === "INFO").length,
    [consoleLogs]
  );

  const filteredConsoleLogs = useMemo(() => {
    return consoleLogs.filter((log) => {
      if (consoleFilterLevel !== "all" && log.level !== consoleFilterLevel) {
        return false;
      }
      if (consoleFilterCategory !== "all" && log.category !== consoleFilterCategory) {
        return false;
      }
      if (consoleSearchQuery.trim()) {
        const q = consoleSearchQuery.toLowerCase();
        const inTitle = log.title.toLowerCase().includes(q);
        const inSummary = log.summary.toLowerCase().includes(q);
        const inErr = (log.errorMessage || "").toLowerCase().includes(q);
        const inDetails = (log.errorDetails || "").toLowerCase().includes(q);
        const inEndpoint = (log.endpoint || "").toLowerCase().includes(q);
        return inTitle || inSummary || inErr || inDetails || inEndpoint;
      }
      return true;
    });
  }, [consoleLogs, consoleFilterLevel, consoleFilterCategory, consoleSearchQuery]);

  // Save key store doc to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem("jobmaker_keystore_104a", serialize(keyStoreDoc, 2));
    } catch {
      // non-fatal
    }
  }, [keyStoreDoc]);

  // Sync active tasks whenever active job doc updates
  useEffect(() => {
    if (activeJobDoc) {
      const tasks = extractTasksFromJobDoc(activeJobDoc);
      setActiveJobTasks(tasks);
      const target = (activeJobDoc as any)["Target_File"] || "Joob_Runner.py";
      setTargetFileInput(target);
    } else {
      setActiveJobTasks([]);
    }
  }, [activeJobDoc]);

  // Initial Fetch: Registry, Assets, Project Ledger
  useEffect(() => {
    fetchRegistry();
    fetchAssets();
    fetchProjectLedger();
  }, []);

  const keySlots = useMemo(() => extractKeySlots(keyStoreDoc), [keyStoreDoc]);
  const activeKeySlotCount = useMemo(
    () => keySlots.filter((s) => s.isActive && s.apiKey.trim().length > 0).length,
    [keySlots]
  );
  const currentKeySlotIndex = useMemo(
    () => Number((keyStoreDoc as any)["Active_Slot_Index"] || 1),
    [keyStoreDoc]
  );

  async function fetchRegistry() {
    try {
      const res = await fetch("/api/registry?type=schema");
      const data = await res.json();
      if (data.ok && Array.isArray(data.entries)) {
        setRegistryEntries(data.entries);
        if (data.entries.length > 0 && !selectedEntryId) {
          setSelectedEntryId(data.entries[0].entry_id);
          loadJobEntry(data.entries[0].entry_id);
        }
      }
      // Keep exportable assets list in sync dynamically
      fetchAssets();
    } catch (err: any) {
      setErrorMessage(`Failed to fetch registry: ${err.message}`);
    }
  }

  async function fetchAssets() {
    try {
      const res = await fetch("/api/schemas/assets");
      const data = await res.json();
      if (data.ok && Array.isArray(data.assets)) {
        setRegisteredAssets(data.assets);
        if (data.assets.length > 0) {
          setSelectedAssetId(data.assets[0].id);
        }
      }
    } catch {
      // fallback handled
    }
  }

  async function fetchProjectLedger() {
    try {
      const res = await fetch("/bejson_project.json");
      if (res.ok) {
        const json = await res.json();
        setProjectLedgerDoc(json);
      }
    } catch {
      // fallback
    }
  }

  async function loadJobEntry(entryId: string) {
    if (!entryId) return;
    setProcessingState("Sending...");
    setStatusMessage(`Loading entry ${entryId}...`);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/entry/${entryId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load job file.");
      }
      setSelectedEntryId(entryId);
      setActiveJobDoc(data.raw_doc);
      setProcessingState("Idle");
      setStatusMessage(`Loaded job: ${data.entry_name}`);
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment & Context Files Handlers
  // ---------------------------------------------------------------------------

  async function handleImportSingleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const newFile: AttachedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        path: file.name,
        content,
        size: file.size,
        isChecked: true, // checked by default: sent in prompt
        type: attachmentPanelType,
      };

      setAttachedFiles((prev) => [...prev, newFile]);
      setSuccessBanner(
        `Attached "${file.name}" to ${
          attachmentPanelType === "context" ? "Context Files (Read-Only)" : "Work Attachments"
        }.`
      );
    } catch (err: any) {
      setErrorMessage(`Failed reading file: ${err.message}`);
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  async function handleImportFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessingState("Sending...");
    setStatusMessage(`Ingesting folder (${files.length} files)...`);

    try {
      const newFiles: AttachedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Skip common binary / hidden junk
        if (file.name.startsWith(".") || file.name.endsWith(".png") || file.name.endsWith(".jpg")) {
          continue;
        }
        try {
          const content = await file.text();
          const relPath = file.webkitRelativePath || file.name;
          newFiles.push({
            id: crypto.randomUUID(),
            name: file.name,
            path: relPath,
            content,
            size: file.size,
            isChecked: true,
            type: attachmentPanelType,
          });
        } catch {
          // skip unreadable
        }
      }

      setAttachedFiles((prev) => [...prev, ...newFiles]);
      setProcessingState("Idle");
      setSuccessBanner(
        `Imported ${newFiles.length} files from folder into ${
          attachmentPanelType === "context" ? "Context Files (Read-Only)" : "Work Attachments"
        }.`
      );
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(`Folder import error: ${err.message}`);
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  async function handleImportZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingState("Sending...");
    setStatusMessage(`Extracting ZIP archive: ${file.name}...`);

    try {
      const zip = await JSZip.loadAsync(file);
      const newFiles: AttachedFile[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && !relativePath.startsWith("__MACOSX/") && !relativePath.endsWith(".DS_Store")) {
          try {
            const content = await zipEntry.async("string");
            newFiles.push({
              id: crypto.randomUUID(),
              name: relativePath.split("/").pop() || relativePath,
              path: relativePath,
              content,
              size: content.length,
              isChecked: true,
              type: attachmentPanelType,
            });
          } catch {
            // skip binary
          }
        }
      }

      setAttachedFiles((prev) => [...prev, ...newFiles]);
      setProcessingState("Idle");
      setSuccessBanner(
        `Extracted ${newFiles.length} files from "${file.name}" into ${
          attachmentPanelType === "context" ? "Context Files (Read-Only)" : "Work Attachments"
        }.`
      );
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(`ZIP extraction failed: ${err.message}`);
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  function handleToggleFileCheck(id: string) {
    setAttachedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isChecked: !f.isChecked } : f))
    );
  }

  function handleDeleteAttachedFile(id: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleToggleAllCategory(type: "context" | "work", check: boolean) {
    setAttachedFiles((prev) =>
      prev.map((f) => (f.type === type ? { ...f, isChecked: check } : f))
    );
  }

  function handleClearCategory(type: "context" | "work") {
    setAttachedFiles((prev) => prev.filter((f) => f.type !== type));
    setSuccessBanner(
      `Cleared all ${type === "context" ? "Context Files" : "Work Attachments"}.`
    );
  }

  const currentCategoryFiles = useMemo(() => {
    return attachedFiles.filter((f) => f.type === attachmentPanelType);
  }, [attachedFiles, attachmentPanelType]);

  const activeSendingCount = useMemo(() => {
    return attachedFiles.filter((f) => f.type === attachmentPanelType && f.isChecked).length;
  }, [attachedFiles, attachmentPanelType]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  async function handleRunNextTask() {
    if (!activeJobDoc && !selectedEntryId) {
      setErrorMessage("No job currently loaded. Please select a job from the Hub first.");
      logAction({
        category: "RUN_STAGE",
        level: "WARN",
        title: "Run Attempt Cancelled",
        summary: "No job is currently loaded into active workspace.",
      });
      return;
    }

    setProcessingState("Sending...");
    setStatusMessage("Synthesizing autonomous code patch with Gemini...");
    setErrorMessage(null);
    setSuccessBanner(null);

    // Round-robin key selection if local keys exist
    const rrResult = getNextRoundRobinKey(keyStoreDoc);
    let clientApiKey = "";
    if (rrResult) {
      clientApiKey = rrResult.key;
      setKeyStoreDoc(rrResult.updatedDoc);
    }

    const startTime = Date.now();
    const pendingTask = activeJobTasks.find((t) => !t.taskCompleted) || activeJobTasks[0];

    logAction({
      category: "RUN_STAGE",
      level: "INFO",
      title: `Starting Stage Evolution (Task ${pendingTask?.taskOrder || 1}: ${pendingTask?.taskName || "Next Step"})`,
      summary: `Synthesizing code patch for target '${targetFileInput}' using model '${selectedModel}'`,
      endpoint: "/api/run/stage",
      method: "POST",
      requestPayload: {
        entry_id: selectedEntryId,
        job_name: (activeJobDoc as any)?.Job_Name,
        target_file: targetFileInput,
        model: selectedModel,
        has_custom_prompt: Boolean(customTurnInstruction),
        attached_files_count: attachedFiles.filter((f) => f.isChecked).length,
        has_client_api_key: Boolean(clientApiKey),
      },
    });

    try {
      setProcessingState("Awaiting response...");
      const res = await fetch("/api/run/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: selectedEntryId,
          job_doc: activeJobDoc,
          target_file: targetFileInput,
          custom_prompt: customTurnInstruction,
          api_key: clientApiKey || undefined,
          model: selectedModel,
          attached_files: attachedFiles, // Passes both context and work attachments!
        }),
      });

      const data = await res.json().catch(() => ({}));
      const durationMs = Date.now() - startTime;

      if (!res.ok || !data.ok) {
        const errorMsg = data.error || `Execution stage failed (HTTP ${res.status}).`;
        logAction({
          category: "RUN_STAGE",
          level: "ERROR",
          title: `Stage Evolution Failed (Task ${pendingTask?.taskOrder || "?"}: ${pendingTask?.taskName || "Next Step"})`,
          summary: errorMsg,
          endpoint: "/api/run/stage",
          method: "POST",
          status: res.status,
          durationMs,
          errorMessage: errorMsg,
          errorDetails: data.details || JSON.stringify(data, null, 2),
          requestPayload: {
            entry_id: selectedEntryId,
            job_name: (activeJobDoc as any)?.Job_Name,
            target_file: targetFileInput,
            model: selectedModel,
          },
          responsePayload: data,
        });
        throw new Error(errorMsg);
      }

      if (data.all_completed) {
        logAction({
          category: "RUN_STAGE",
          level: "SUCCESS",
          title: "All Tasks Completed",
          summary: "All tasks in active job are completed.",
          endpoint: "/api/run/stage",
          method: "POST",
          status: res.status,
          durationMs,
          responsePayload: data,
        });
        setProcessingState("Idle");
        setStatusMessage("All tasks in this job are completed! 🎉");
        setSuccessBanner("All tasks completed.");
        return;
      }

      logAction({
        category: "RUN_STAGE",
        level: "SUCCESS",
        title: `Stage Evolution Succeeded (Task ${data.task_order}: ${data.task_name})`,
        summary: `Synthesized candidate patch (${data.candidate_code?.length || 0} bytes) in ${durationMs}ms for '${data.target_file}'. Diff ready for review.`,
        endpoint: "/api/run/stage",
        method: "POST",
        status: 200,
        durationMs,
        responsePayload: {
          stage_id: data.stage_id,
          task_order: data.task_order,
          task_name: data.task_name,
          target_file: data.target_file,
          candidate_length: data.candidate_code?.length || 0,
        },
      });

      setStagedEvolution({
        stageId: data.stage_id,
        entryId: selectedEntryId,
        taskOrder: data.task_order,
        taskName: data.task_name,
        targetFile: data.target_file,
        originalCode: "",
        candidateCode: data.candidate_code,
        diff: data.diff,
        createdAt: Date.now(),
      });

      setProcessingState("Idle");
      setStatusMessage(`Stage generated for Step ${data.task_order}: ${data.task_name}`);
      setIsDiffModalOpen(true);
      setActiveSection("runner");
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(err.message);
      setStatusMessage("Run failed.");
    }
  }

  async function handleCommitDiff() {
    if (!stagedEvolution) return;
    setProcessingState("Sending...");
    setStatusMessage("Applying atomic swap and committing task...");

    const startTime = Date.now();
    try {
      const res = await fetch("/api/run/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stagedEvolution.stageId }),
      });

      const data = await res.json().catch(() => ({}));
      const durationMs = Date.now() - startTime;

      if (!res.ok || !data.ok) {
        const errorMsg = data.error || "Commit failed.";
        logAction({
          category: "COMMIT_DIFF",
          level: "ERROR",
          title: `Commit Diff Failed (Step ${stagedEvolution.taskOrder})`,
          summary: errorMsg,
          endpoint: "/api/run/commit",
          method: "POST",
          status: res.status,
          durationMs,
          errorMessage: errorMsg,
          requestPayload: { stage_id: stagedEvolution.stageId },
          responsePayload: data,
        });
        throw new Error(errorMsg);
      }

      logAction({
        category: "COMMIT_DIFF",
        level: "SUCCESS",
        title: `Committed Diff Atomically (Step ${data.task_order})`,
        summary: `Successfully committed candidate patch to '${stagedEvolution.targetFile}' in ${durationMs}ms.`,
        endpoint: "/api/run/commit",
        method: "POST",
        status: 200,
        durationMs,
        responsePayload: data,
      });

      setIsDiffModalOpen(false);
      setStagedEvolution(null);
      setProcessingState("Idle");
      setSuccessBanner(`Step ${data.task_order} committed cleanly.`);
      setStatusMessage(`Committed Step ${data.task_order}. Target updated.`);

      if (selectedEntryId) {
        await loadJobEntry(selectedEntryId);
      }
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(err.message);
    }
  }

  async function handleDiscardDiff() {
    if (!stagedEvolution) return;
    try {
      await fetch("/api/run/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stagedEvolution.stageId }),
      });
      logAction({
        category: "DISCARD_DIFF",
        level: "WARN",
        title: `Discarded Candidate Diff (Step ${stagedEvolution.taskOrder})`,
        summary: `Discarded candidate code for '${stagedEvolution.targetFile}'. Working file preserved.`,
        endpoint: "/api/run/discard",
        method: "POST",
      });
    } catch {
      // non-fatal
    }
    setIsDiffModalOpen(false);
    setStagedEvolution(null);
    setStatusMessage("Staged candidate discarded. Working file preserved.");
  }

  async function handleInstantiateTemplate(tmpl: JobTemplateDefinition, customGoal?: string, customTarget?: string) {
    setProcessingState("Sending...");
    setStatusMessage(`Instantiating template: ${tmpl.templateName}...`);
    setErrorMessage(null);

    const startTime = Date.now();
    try {
      const res = await fetch("/api/templates/instantiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: tmpl.templateId,
          custom_goal: customGoal,
          target_file: customTarget,
          job_name: tmpl.templateName,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const durationMs = Date.now() - startTime;

      if (!res.ok || !data.ok) {
        const errorMsg = data.error || "Failed to create job from template.";
        logAction({
          category: "TEMPLATE",
          level: "ERROR",
          title: `Template Instantiation Failed (${tmpl.templateName})`,
          summary: errorMsg,
          endpoint: "/api/templates/instantiate",
          method: "POST",
          status: res.status,
          durationMs,
          errorMessage: errorMsg,
        });
        throw new Error(errorMsg);
      }

      logAction({
        category: "TEMPLATE",
        level: "SUCCESS",
        title: `Template Instantiated (${tmpl.templateName})`,
        summary: `Created job entry '${data.entry_id}' from template in ${durationMs}ms.`,
        endpoint: "/api/templates/instantiate",
        method: "POST",
        status: 200,
        durationMs,
        responsePayload: { entry_id: data.entry_id, job_name: tmpl.templateName },
      });

      await fetchRegistry();
      setSelectedEntryId(data.entry_id);
      setActiveJobDoc(data.job_doc);
      setProcessingState("Idle");
      setStatusMessage(`Created and loaded job from template "${tmpl.templateName}"`);
      setActiveSection("editor");
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(err.message);
    }
  }

  async function handleSaveJobDoc() {
    if (!activeJobDoc || !selectedEntryId) return;
    setProcessingState("Sending...");
    setStatusMessage("Saving job document to disk...");
    setErrorMessage(null);

    const startTime = Date.now();
    try {
      const res = await fetch("/api/jobs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: selectedEntryId,
          job_doc: activeJobDoc,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const durationMs = Date.now() - startTime;

      if (!res.ok || !data.ok) {
        const errorMsg = data.error || "Failed to save job.";
        logAction({
          category: "DOCUMENT_IO",
          level: "ERROR",
          title: `Save Job Document Failed (${selectedEntryId})`,
          summary: errorMsg,
          endpoint: "/api/jobs/save",
          method: "POST",
          status: res.status,
          durationMs,
          errorMessage: errorMsg,
        });
        throw new Error(errorMsg);
      }

      logAction({
        category: "DOCUMENT_IO",
        level: "SUCCESS",
        title: `Saved Job Document (${(activeJobDoc as any)?.Job_Name || selectedEntryId})`,
        summary: `Serialized and saved job document to disk in ${durationMs}ms.`,
        endpoint: "/api/jobs/save",
        method: "POST",
        status: 200,
        durationMs,
      });

      setProcessingState("Idle");
      setSuccessBanner("Job document saved successfully.");
      setStatusMessage("Job saved.");
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(err.message);
    }
  }

  function handleImportJobFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = String(evt.target?.result || "");
        const doc = parse(text);
        const val = validateDocument(doc);
        if (!val.valid) {
          throw new Error(val.errors[0]?.message || "Invalid BEJSON document.");
        }

        const entryName = (doc as any)["Job_Name"] || file.name.replace(/\.[^/.]+$/, "");
        const res = await fetch("/api/registry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entry_name: entryName,
            entry_type: "schema",
            file_path: `jobs/${file.name}`,
          }),
        });

        const regData = await res.json();
        if (regData.ok) {
          setActiveJobDoc(doc);
          setSelectedEntryId(regData.entry_id);
          await fetchRegistry();
          setSuccessBanner(`Imported job "${entryName}" successfully.`);
          setActiveSection("editor");
        }
      } catch (err: any) {
        setErrorMessage(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------------------
  // AI Job Generation & Self-Healing Handlers
  // ---------------------------------------------------------------------------

  async function handleGenerateJob() {
    if (!genPrompt.trim()) {
      setErrorMessage("Please enter a description for the job to generate.");
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    setGenSuccessMessage(null);
    setGenDiagnostics([]);
    setProcessingState("Sending...");
    setStatusMessage("Synthesizing BEJSON 104a Job document using spreadsheet analogies...");

    const activeKey = getNextRoundRobinKey(keyStoreDoc);
    const resolvedKey = activeKey ? activeKey.key : undefined;
    const startTime = Date.now();

    logAction({
      category: "GENERATE_JOB",
      level: "INFO",
      title: "Starting AI Job Document Generation",
      summary: `Synthesizing BEJSON 104a job with ${genStepCount} steps using model '${genModel || selectedModel}'`,
      endpoint: "/api/jobs/generate",
      method: "POST",
      requestPayload: {
        job_name: genJobName,
        target_file: genTargetFile,
        job_type: genJobType,
        job_subtype: genJobSubtype,
        step_count: genStepCount,
        model: genModel || selectedModel,
        prompt_snippet: genPrompt.slice(0, 150),
      },
    });

    try {
      const res = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: genPrompt.trim(),
          job_name: genJobName.trim() || undefined,
          target_file: genTargetFile.trim() || undefined,
          job_type: genJobType,
          job_subtype: genJobSubtype,
          step_count: Number(genStepCount) || 5,
          api_key: resolvedKey,
          model: genModel || selectedModel || DEFAULT_MODEL,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const durationMs = Date.now() - startTime;
      setGenAttempts(data.attempts_count || 1);
      setGenDiagnostics(data.diagnostics || []);

      if (!res.ok || !data.ok) {
        const errText = data.error || "Job generation failed validation.";
        logAction({
          category: "GENERATE_JOB",
          level: "ERROR",
          title: "AI Job Generation Failed",
          summary: errText,
          endpoint: "/api/jobs/generate",
          method: "POST",
          status: res.status,
          durationMs,
          errorMessage: errText,
          errorDetails: (data.diagnostics || []).join("\n\n"),
          responsePayload: data,
        });
        setGenError(errText);
        setErrorMessage(errText);
        setProcessingState("Error");
        setStatusMessage("Generation validation failed.");
        setGenSubTab("diagnostics");
        return;
      }

      logAction({
        category: "GENERATE_JOB",
        level: "SUCCESS",
        title: `AI Job Document Generated (${data.job_doc?.Values?.length || 0} tasks)`,
        summary: `Synthesized & validated BEJSON 104a document in ${data.attempts_count} attempt(s) (${durationMs}ms).`,
        endpoint: "/api/jobs/generate",
        method: "POST",
        status: 200,
        durationMs,
        responsePayload: {
          job_name: data.job_doc?.Job_Name,
          target_file: data.job_doc?.Target_File,
          task_count: data.job_doc?.Values?.length || 0,
          attempts: data.attempts_count,
        },
      });

      setGeneratedJobDoc(data.job_doc);
      setGeneratedEntryId(data.entry_id || null);
      setGenSuccessMessage(
        data.message || `Successfully generated and validated job in ${data.attempts_count} attempt(s)!`
      );
      setProcessingState("Idle");
      setStatusMessage("Job generated and validated.");
      setGenSubTab("preview");
      await fetchRegistry();
    } catch (err: any) {
      logAction({
        category: "GENERATE_JOB",
        level: "ERROR",
        title: "AI Job Generation Network Error",
        summary: err.message,
        endpoint: "/api/jobs/generate",
        method: "POST",
        errorMessage: err.message,
      });
      setGenError(err.message);
      setErrorMessage(`Generation error: ${err.message}`);
      setProcessingState("Error");
      setStatusMessage("Network failure during generation.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleLoadGeneratedJobIntoEditor() {
    if (!generatedJobDoc) return;
    setActiveJobDoc(generatedJobDoc);
    if (generatedEntryId) {
      setSelectedEntryId(generatedEntryId);
    }
    setActiveSection("editor");
    setSuccessBanner("Generated Job loaded into active editor.");
  }

  function handleCopyGeneratedBEJSON() {
    if (!generatedJobDoc) return;
    navigator.clipboard.writeText(serialize(generatedJobDoc, 2));
    setSuccessBanner("Generated BEJSON document copied to clipboard.");
  }

  function handleDownloadGeneratedBEJSON() {
    if (!generatedJobDoc) return;
    const name = (generatedJobDoc as any)["Job_Name"] || "generated_job";
    const filename = `${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.bejson`;
    const blob = new Blob([serialize(generatedJobDoc, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessBanner(`Downloaded ${filename}`);
  }

  // ---------------------------------------------------------------------------
  // Tab 3: Asset Export Handlers (JSZip)
  // ---------------------------------------------------------------------------

  const activeAsset = useMemo(() => {
    return registeredAssets.find((a) => a.id === selectedAssetId) || registeredAssets[0];
  }, [registeredAssets, selectedAssetId]);

  function handleCopyActiveSchema() {
    if (!activeAsset) return;
    navigator.clipboard.writeText(JSON.stringify(activeAsset.doc, null, 2));
    setSuccessBanner(`Copied ${activeAsset.name} to clipboard.`);
  }

  function handleDownloadActiveSchema() {
    if (!activeAsset) return;
    const blob = new Blob([JSON.stringify(activeAsset.doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeAsset.filename;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessBanner(`Downloaded ${activeAsset.filename}`);
  }

  async function handleDownloadAllSchemasZip() {
    if (registeredAssets.length === 0) return;
    setProcessingState("Sending...");
    try {
      const zip = new JSZip();
      for (const asset of registeredAssets) {
        zip.file(asset.filename, JSON.stringify(asset.doc, null, 2));
      }

      if (projectLedgerDoc) {
        zip.file("bejson_project.json", JSON.stringify(projectLedgerDoc, null, 2));
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "JobMaker_BEJSON_Assets.zip";
      a.click();
      URL.revokeObjectURL(url);
      setProcessingState("Idle");
      setSuccessBanner("Exported all schemas to JobMaker_BEJSON_Assets.zip");
    } catch (err: any) {
      setProcessingState("Error");
      setErrorMessage(`Failed to package ZIP: ${err.message}`);
    }
  }

  const changeLogParsed = useMemo(() => {
    if (!projectLedgerDoc) return "No change log available.";
    const fmap = bejson_core_get_field_map(projectLedgerDoc);
    if (projectLedgerDoc.Values && projectLedgerDoc.Values[0]) {
      const row = projectLedgerDoc.Values[0];
      const clIdx = fmap["Change_Log"] !== undefined ? fmap["Change_Log"] : fmap["change_log"];
      if (clIdx !== undefined && row[clIdx]) {
        return String(row[clIdx]);
      }
    }
    return "3.1.7 | 2026-09-27 | Added dual Attachment & Context File panels with file/folder/ZIP import, radio selection, and prompt segregation.";
  }, [projectLedgerDoc]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#FFFFFF] text-[#000000] overflow-hidden select-none font-sans">
      {/* -------------------------------------------------------------------- */}
      {/* GLOBAL PERSISTENT HEADER TOOLBAR (Horizontally Scrollable) */}
      {/* -------------------------------------------------------------------- */}
      <header className="h-14 bg-[#000000] text-[#FFFFFF] border-b border-[#000000] px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap py-1">
          {/* Mobile Menu Toggle (Hamburger) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 text-[#FFFFFF] hover:text-[#DE2626] focus:outline-none cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand & Solid Numeric Version */}
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-sm uppercase">JobMaker</span>
            <span className="bg-[#DE2626] text-[#FFFFFF] text-xs font-mono font-bold px-1.5 py-0.5 rounded-none">
              v3.1.12 (3112)
            </span>
          </div>

          <div className="h-4 w-px bg-[#333333] mx-1 shrink-0" />

          {/* Active Job Name */}
          <div className="flex items-center gap-1.5 text-xs text-[#FFFFFF]">
            <FolderOpen size={14} className="text-[#DE2626]" />
            <span className="font-semibold max-w-[200px] truncate">
              {activeJobDoc ? (activeJobDoc as any)["Job_Name"] || "Active Job" : "No Job Active"}
            </span>
          </div>

          <div className="h-4 w-px bg-[#333333] mx-1 shrink-0" />

          {/* Target File */}
          <div className="flex items-center gap-1.5 text-xs text-[#AAAAAA] font-mono">
            <FileCode size={13} />
            <span className="text-[#FFFFFF]">{targetFileInput}</span>
          </div>

          <div className="h-4 w-px bg-[#333333] mx-1 shrink-0" />

          {/* Operational State Indicator (Section 11.3) */}
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                processingState === "Error"
                  ? "bg-[#DE2626]"
                  : processingState === "Sending..." || processingState === "Awaiting response..."
                  ? "bg-[#DE2626] animate-pulse"
                  : "bg-[#FFFFFF]"
              }`}
            />
            <span className="font-medium">{processingState}</span>
          </div>

          <div className="h-4 w-px bg-[#333333] mx-1 shrink-0" />

          {/* Key Store & Model Slot Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-[#AAAAAA]">
            <Key size={13} className="text-[#DE2626]" />
            <span>
              {activeKeySlotCount > 0 ? `Key Slot ${currentKeySlotIndex}/20` : "ENV Key"} ·{" "}
              <span className="text-[#FFFFFF] font-mono">{selectedModel}</span>
            </span>
          </div>

          <div className="h-4 w-px bg-[#333333] mx-1 shrink-0" />

          {/* Attached Files Counter Badge */}
          <div className="flex items-center gap-1.5 text-xs text-[#AAAAAA]">
            <Paperclip size={13} className="text-[#DE2626]" />
            <span>
              Files:{" "}
              <span className="text-[#FFFFFF] font-mono">
                {attachedFiles.filter((f) => f.isChecked).length}/{attachedFiles.length}
              </span>
            </span>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2 pl-3 shrink-0">
          <button
            onClick={handleRunNextTask}
            disabled={processingState === "Sending..." || processingState === "Awaiting response..."}
            className="flex items-center gap-1.5 bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] hover:border hover:border-[#DE2626] px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            title="Execute next pending task in active job"
          >
            <Play size={13} className="fill-current" />
            <span>RUN NEXT TASK</span>
          </button>

          <button
            onClick={() => setIsAboutModalOpen(true)}
            className="flex items-center gap-1 border border-[#444444] hover:border-[#DE2626] hover:text-[#DE2626] text-[#FFFFFF] px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            title="Open About, Change Log & Asset Schemas"
          >
            <Info size={14} />
            <span className="hidden sm:inline">About / Assets</span>
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* STATUS & FEEDBACK NOTIFICATION BAR */}
      {/* -------------------------------------------------------------------- */}
      {(errorMessage || successBanner || statusMessage !== "System standby.") && (
        <div
          className={`px-4 py-1.5 text-xs flex items-center justify-between border-b ${
            errorMessage
              ? "bg-[#000000] text-[#DE2626] border-[#DE2626]"
              : successBanner
              ? "bg-[#000000] text-[#FFFFFF] border-[#000000]"
              : "bg-[#F9F9F9] text-[#333333] border-[#E5E5E5]"
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden truncate">
            {errorMessage ? (
              <AlertTriangle size={14} className="text-[#DE2626] shrink-0" />
            ) : successBanner ? (
              <CheckCircle2 size={14} className="text-[#FFFFFF] shrink-0" />
            ) : (
              <Clock size={14} className="text-[#666666] shrink-0" />
            )}
            <span className="truncate">{errorMessage || successBanner || statusMessage}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {errorMessage && (
              <button
                onClick={() => setErrorMessage(null)}
                className="underline hover:text-[#FFFFFF] ml-2 cursor-pointer"
              >
                Dismiss
              </button>
            )}
            {successBanner && (
              <button
                onClick={() => setSuccessBanner(null)}
                className="underline hover:text-[#DE2626] ml-2 cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MAIN VIEWPORT: SIDEBAR + CONTENT AREA */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Navigation Sidebar (Desktop Persistent / Mobile Flyout Drawer) */}
        <nav
          className={`${
            isMobileMenuOpen ? "fixed inset-0 z-40 bg-[#000000] flex flex-col pt-16" : "hidden"
          } md:flex md:w-60 bg-[#000000] text-[#FFFFFF] flex-col justify-between shrink-0 border-r border-[#000000]`}
        >
          <div className="p-3 space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-[#777777] uppercase px-3 py-1">
              Workspace Navigation
            </div>

            <button
              onClick={() => {
                setActiveSection("hub");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "hub"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <FolderOpen size={16} />
              <span>Jobs &amp; Hub</span>
            </button>

            <button
              onClick={() => {
                setActiveSection("editor");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "editor"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <FileCode size={16} />
              <span>Job Editor</span>
            </button>

            <button
              onClick={() => {
                setActiveSection("attachments");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "attachments"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Paperclip size={16} />
                <span>Files &amp; Attachments</span>
              </div>
              {attachedFiles.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#222222] text-[#FFFFFF]">
                  {attachedFiles.filter((f) => f.isChecked).length}/{attachedFiles.length}
                </span>
              )}
            </button>

            {/* Mobile Fast Switchers (User Rule: Mobile responsive hamburger switch between context & attachments) */}
            <div className="md:hidden pt-2 pb-1 px-1 border-t border-[#333333]">
              <div className="text-[10px] font-bold tracking-wider text-[#DE2626] uppercase px-2 py-1">
                Direct Category Switch
              </div>
              <button
                onClick={() => {
                  setActiveSection("attachments");
                  setAttachmentPanelType("context");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-left cursor-pointer transition-colors ${
                  activeSection === "attachments" && attachmentPanelType === "context"
                    ? "bg-[#DE2626] text-[#FFFFFF]"
                    : "text-[#FFFFFF] bg-[#1A1A1A] hover:bg-[#DE2626]"
                }`}
              >
                <span>📂 Context Files (Read-Only)</span>
                <span className="font-mono text-[10px]">
                  ({attachedFiles.filter((f) => f.type === "context").length})
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveSection("attachments");
                  setAttachmentPanelType("work");
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-left cursor-pointer mt-1 transition-colors ${
                  activeSection === "attachments" && attachmentPanelType === "work"
                    ? "bg-[#DE2626] text-[#FFFFFF]"
                    : "text-[#FFFFFF] bg-[#1A1A1A] hover:bg-[#DE2626]"
                }`}
              >
                <span>📝 Work Attachments</span>
                <span className="font-mono text-[10px]">
                  ({attachedFiles.filter((f) => f.type === "work").length})
                </span>
              </button>
            </div>

            <button
              onClick={() => {
                setActiveSection("runner");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "runner"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <Layers size={16} />
              <span>Runner &amp; Diff</span>
              {stagedEvolution && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#FFFFFF]" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveSection("templates");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "templates"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <Plus size={16} />
              <span>Job Templates</span>
            </button>

            <button
              onClick={() => {
                setActiveSection("generate");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "generate"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <Sparkles size={16} />
              <span>Generate Job</span>
              {generatedJobDoc && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#FFFFFF]" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveSection("keys");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "keys"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <Key size={16} />
              <span>Key Manager</span>
            </button>

            <button
              onClick={() => {
                setActiveSection("console");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-none text-left cursor-pointer transition-colors ${
                activeSection === "console"
                  ? "bg-[#DE2626] text-[#FFFFFF]"
                  : "text-[#CCCCCC] hover:bg-[#1A1A1A] hover:text-[#FFFFFF]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Terminal size={16} />
                <span>Console</span>
              </div>
              {errorLogsCount > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#DE2626] text-[#FFFFFF] font-bold">
                  {errorLogsCount} ERR
                </span>
              ) : consoleLogs.length > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#222222] text-[#AAAAAA]">
                  {consoleLogs.length}
                </span>
              ) : null}
            </button>

            <div className="pt-3">
              <div className="text-[10px] font-bold tracking-wider text-[#777777] uppercase px-3 py-1">
                Mirrored Runtime
              </div>
              <a
                href="/js/index.html"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#AAAAAA] hover:bg-[#1A1A1A] hover:text-[#FFFFFF] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText size={15} />
                  <span>Vanilla JS (/js)</span>
                </span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Sidebar Footer: Author Crediting */}
          <div className="p-3 border-t border-[#222222] text-[11px] text-[#888888]">
            <div className="font-bold text-[#FFFFFF]">Elton Boehnen</div>
            <div>boehnenelton2024@gmail.com</div>
            <div className="pt-1 text-[#666666] font-mono text-[10px]">BEJSON 104a Core Suite</div>
          </div>
        </nav>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION CONTAINER WITH TOP-LEVEL HORIZONTAL SUB-NAVIGATION */}
        {/* ------------------------------------------------------------------ */}
        <main className="flex-1 flex flex-col bg-[#FFFFFF] overflow-hidden">
          {/* 1. ATTACHMENT & CONTEXT FILES PANEL (New Requested Feature) */}
          {activeSection === "attachments" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Radio Box Switcher (Mandated in Prompt) */}
              <div className="border-b border-[#000000] bg-[#FAFAFA] p-3">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase m-0 text-[#000000]">
                      <input
                        type="radio"
                        name="panelSelectorRadio"
                        checked={attachmentPanelType === "context"}
                        onChange={() => setAttachmentPanelType("context")}
                        className="accent-[#DE2626] w-4 h-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={14} className="text-[#DE2626]" />
                        <span>Context Files (Read-Only Study)</span>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase m-0 text-[#000000]">
                      <input
                        type="radio"
                        name="panelSelectorRadio"
                        checked={attachmentPanelType === "work"}
                        onChange={() => setAttachmentPanelType("work")}
                        className="accent-[#DE2626] w-4 h-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Paperclip size={14} className="text-[#DE2626]" />
                        <span>Work Attachments (Task Files)</span>
                      </span>
                    </label>
                  </div>

                  <div className="text-xs font-mono text-[#666666]">
                    Category:{" "}
                    <span className="font-bold text-[#000000]">
                      {currentCategoryFiles.length} files ({activeSendingCount} sending)
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Panel Content */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-5 max-w-4xl mx-auto w-full">
                {/* Descriptive Operational Callout */}
                <div
                  className={`p-4 border ${
                    attachmentPanelType === "context"
                      ? "border-[#000000] bg-[#FFFFFF]"
                      : "border-[#DE2626] bg-[#FFFFFF]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {attachmentPanelType === "context" ? (
                      <BookOpen size={20} className="text-[#000000] shrink-0 mt-0.5" />
                    ) : (
                      <Paperclip size={20} className="text-[#DE2626] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#000000]">
                        {attachmentPanelType === "context"
                          ? "Read-Only Context Files Panel (Study & Learning Only)"
                          : "Work Attachments Form Panel (Direct Task Execution)"}
                      </h3>
                      <p className="text-xs text-[#444444] mt-1 leading-relaxed">
                        {attachmentPanelType === "context"
                          ? "These files are ingested strictly as read-only study material for the AI to learn from, analyze patterns, and extract references. The AI will NEVER replicate, modify, or overwrite these context files."
                          : "These files are target documents for the active job to execute on, edit, refactor, and evolve directly."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Import Controls: File, Folder, ZIP */}
                <div className="border border-[#000000] p-4 bg-[#FFFFFF] space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                    Import into {attachmentPanelType === "context" ? "Context Files" : "Work Attachments"}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Single File */}
                    <div>
                      <input
                        type="file"
                        ref={singleFileInputRef}
                        onChange={handleImportSingleFile}
                        className="hidden"
                      />
                      <button
                        onClick={() => singleFileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-3 border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer"
                      >
                        <FileCode size={14} />
                        <span>Import File</span>
                      </button>
                    </div>

                    {/* 2. Folder */}
                    <div>
                      <input
                        type="file"
                        // @ts-ignore
                        webkitdirectory=""
                        directory=""
                        ref={folderInputRef}
                        onChange={handleImportFolder}
                        className="hidden"
                      />
                      <button
                        onClick={() => folderInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-3 border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer"
                      >
                        <FolderOpen size={14} />
                        <span>Import Folder</span>
                      </button>
                    </div>

                    {/* 3. ZIP Archive */}
                    <div>
                      <input
                        type="file"
                        accept=".zip"
                        ref={zipInputRef}
                        onChange={handleImportZip}
                        className="hidden"
                      />
                      <button
                        onClick={() => zipInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-3 border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Archive size={14} />
                        <span>Import ZIP Archive</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* File List Controls & Filter Summary */}
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 mb-2 border-b border-[#000000] gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#000000] flex items-center gap-2">
                      <span>Attached Files in Active Category</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#000000] text-[#FFFFFF]">
                        {currentCategoryFiles.length} Total
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => handleToggleAllCategory(attachmentPanelType, true)}
                        className="font-bold text-[#000000] hover:text-[#DE2626] underline cursor-pointer"
                      >
                        Check All
                      </button>
                      <span className="text-[#CCCCCC]">|</span>
                      <button
                        onClick={() => handleToggleAllCategory(attachmentPanelType, false)}
                        className="font-bold text-[#000000] hover:text-[#DE2626] underline cursor-pointer"
                      >
                        Uncheck All
                      </button>
                      <span className="text-[#CCCCCC]">|</span>
                      <button
                        onClick={() => handleClearCategory(attachmentPanelType)}
                        className="font-bold text-[#DE2626] hover:underline cursor-pointer"
                      >
                        Clear Category
                      </button>
                    </div>
                  </div>

                  {/* Per-File Interactive Rows */}
                  <div className="border border-[#000000] bg-[#FFFFFF] divide-y divide-[#EEEEEE]">
                    {currentCategoryFiles.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#777777] space-y-2">
                        <UploadCloud size={28} className="mx-auto text-[#AAAAAA]" />
                        <div>No {attachmentPanelType === "context" ? "context" : "work attachment"} files loaded.</div>
                        <div className="text-[11px] text-[#999999]">
                          Use the Import File, Import Folder, or Import ZIP buttons above.
                        </div>
                      </div>
                    ) : (
                      currentCategoryFiles.map((file) => {
                        return (
                          <div
                            key={file.id}
                            className={`p-3 flex items-center justify-between transition-colors ${
                              file.isChecked ? "bg-[#FFFFFF]" : "bg-[#FBFBFB] text-[#777777]"
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden pr-3">
                              {/* Selection Checkbox */}
                              <button
                                onClick={() => handleToggleFileCheck(file.id)}
                                className="cursor-pointer text-[#000000] hover:text-[#DE2626] shrink-0"
                                title={
                                  file.isChecked
                                    ? "Checked: file is included in prompt payload"
                                    : "Unchecked: file is held on to locally and omitted from prompt"
                                }
                              >
                                {file.isChecked ? (
                                  <CheckSquare size={18} className="text-[#DE2626]" />
                                ) : (
                                  <Square size={18} className="text-[#AAAAAA]" />
                                )}
                              </button>

                              <div className="overflow-hidden truncate">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-[#000000] truncate">
                                    {file.name}
                                  </span>
                                  <span
                                    className={`text-[9px] font-mono px-1 py-0.2 border shrink-0 ${
                                      file.type === "context"
                                        ? "border-[#000000] text-[#000000]"
                                        : "border-[#DE2626] text-[#DE2626]"
                                    }`}
                                  >
                                    {file.type === "context" ? "READ-ONLY STUDY" : "WORK ATTACHMENT"}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-[#666666] truncate">
                                  {file.path} · {(file.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 ${
                                  file.isChecked
                                    ? "bg-[#000000] text-[#FFFFFF]"
                                    : "bg-[#E5E5E5] text-[#555555]"
                                }`}
                              >
                                {file.isChecked ? "SENDING OUT" : "HELD ON TO"}
                              </span>

                              <button
                                onClick={() => setPreviewFile(file)}
                                className="p-1 text-[#000000] hover:text-[#DE2626] cursor-pointer"
                                title="Inspect content"
                              >
                                <Eye size={15} />
                              </button>

                              <button
                                onClick={() => handleDeleteAttachedFile(file.id)}
                                className="p-1 text-[#000000] hover:text-[#DE2626] cursor-pointer"
                                title="Remove file"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. HUB SECTION */}
          {activeSection === "hub" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center border-b border-[#000000] bg-[#FFFFFF] px-4 gap-2">
                <button
                  onClick={() => setHubSubTab("list")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    hubSubTab === "list"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Registered Jobs ({registryEntries.length})
                </button>
                <button
                  onClick={() => setHubSubTab("import")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    hubSubTab === "import"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Import Job (.bejson)
                </button>
                <button
                  onClick={fetchRegistry}
                  className="ml-auto text-xs flex items-center gap-1 font-semibold text-[#000000] hover:text-[#DE2626] cursor-pointer"
                  title="Rescan disk for newly added jobs"
                >
                  <RotateCw size={13} />
                  <span>Sync Registry</span>
                </button>
              </div>

              {hubSubTab === "list" && (
                <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF]">
                    <h2 className="text-sm font-bold uppercase tracking-wider mb-2">Select Active Job</h2>
                    <p className="text-xs text-[#555555] mb-4">
                      Select a job document registered in <span className="font-mono">registry.bejson</span> or synchronized from the <span className="font-mono">jobs/</span> directory.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedEntryId}
                        onChange={(e) => setSelectedEntryId(e.target.value)}
                        className="flex-1 p-2 text-xs border border-[#000000] rounded-none focus:outline-none"
                      >
                        {registryEntries.map((e) => (
                          <option key={e.entry_id} value={e.entry_id}>
                            {e.entry_name} ({e.file_path})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => loadJobEntry(selectedEntryId)}
                        className="bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] px-5 py-2 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Load Into Editor
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-[#555555]">
                      Available Job Records
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {registryEntries.map((e) => {
                        const isCurrent = e.entry_id === selectedEntryId;
                        return (
                          <div
                            key={e.entry_id}
                            className={`p-4 border transition-colors ${
                              isCurrent ? "border-[#DE2626] bg-[#FFFFFF]" : "border-[#000000] bg-[#FFFFFF]"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-bold text-sm text-[#000000]">{e.entry_name}</div>
                                <div className="font-mono text-xs text-[#666666] mt-0.5">{e.file_path}</div>
                              </div>
                              <span className="text-[10px] font-mono text-[#888888]">{e.modified_date}</span>
                            </div>

                            <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#EEEEEE]">
                              <button
                                onClick={() => {
                                  setSelectedEntryId(e.entry_id);
                                  loadJobEntry(e.entry_id);
                                  setActiveSection("editor");
                                }}
                                className="text-xs font-bold text-[#DE2626] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>Open in Editor</span>
                                <ArrowRight size={12} />
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedEntryId(e.entry_id);
                                  loadJobEntry(e.entry_id);
                                  handleRunNextTask();
                                }}
                                className="text-xs font-bold bg-[#000000] hover:bg-[#DE2626] text-[#FFFFFF] px-2.5 py-1 cursor-pointer transition-colors"
                              >
                                Run Step
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {hubSubTab === "import" && (
                <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
                  <div className="border border-[#000000] p-6 bg-[#FFFFFF] space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider">Import BEJSON 104a Job Document</h2>
                    <p className="text-xs text-[#555555]">
                      Upload any BEJSON 104a document (<span className="font-mono">Records_Type: ["JobSchema"]</span>).
                      The document will be validated against Elton Boehnen's Core BEJSON validators and registered in the active workspace.
                    </p>

                    <div className="border-2 border-dashed border-[#000000] p-8 text-center bg-[#FFFFFF]">
                      <input
                        type="file"
                        accept=".bejson,.json"
                        id="job-file-input"
                        onChange={handleImportJobFile}
                        className="hidden"
                      />
                      <label
                        htmlFor="job-file-input"
                        className="cursor-pointer flex flex-col items-center justify-center gap-2"
                      >
                        <FolderOpen size={32} className="text-[#DE2626]" />
                        <span className="text-xs font-bold text-[#000000] underline">
                          Browse and select a .bejson or .json file
                        </span>
                        <span className="text-[11px] text-[#777777]">Strict BEJSON 104a Schema validation</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. JOB EDITOR SECTION */}
          {activeSection === "editor" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center border-b border-[#000000] bg-[#FFFFFF] px-4 gap-2">
                <button
                  onClick={() => setEditorSubTab("tasks")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    editorSubTab === "tasks"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Tasks ({activeJobTasks.length})
                </button>
                <button
                  onClick={() => setEditorSubTab("json")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    editorSubTab === "json"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Raw BEJSON Document
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setActiveSection("attachments")}
                    className="border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] text-[#000000] px-3 py-1 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Paperclip size={12} />
                    <span>Manage Attachments ({attachedFiles.filter((f) => f.isChecked).length})</span>
                  </button>

                  <button
                    onClick={handleSaveJobDoc}
                    className="bg-[#000000] hover:bg-[#DE2626] text-[#FFFFFF] px-3 py-1 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Save Job
                  </button>
                  <button
                    onClick={handleRunNextTask}
                    className="bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] px-3 py-1 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Run Next Task
                  </button>
                </div>
              </div>

              {editorSubTab === "tasks" && (
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 max-w-5xl mx-auto w-full">
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF] grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase mb-1">Global Job Goal</label>
                      <textarea
                        rows={2}
                        value={(activeJobDoc as any)?.["Job_Goal"] || ""}
                        onChange={(e) => {
                          if (activeJobDoc) {
                            const updated = { ...activeJobDoc, Job_Goal: e.target.value };
                            setActiveJobDoc(updated as any);
                          }
                        }}
                        className="w-full p-2 text-xs border border-[#000000] rounded-none focus:outline-none"
                        placeholder="Define the primary objective of this self-evolving run..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase mb-1">Target Script File</label>
                      <input
                        type="text"
                        value={targetFileInput}
                        onChange={(e) => setTargetFileInput(e.target.value)}
                        className="w-full p-2 text-xs border border-[#000000] rounded-none font-mono focus:outline-none mb-2"
                        placeholder="e.g. Joob_Runner.py, server.ts, src/App.tsx"
                      />
                      <div className="flex items-center justify-between text-[11px] text-[#666666]">
                        <span>Default: Joob_Runner.py</span>
                        <span className="font-mono">
                          {activeJobDoc && Boolean((activeJobDoc as any)["Job_Complete"])
                            ? "Status: COMPLETE ✅"
                            : "Status: IN PROGRESS ⏳"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                        Job Task Sequence ({activeJobTasks.length} steps)
                      </h3>
                      <button
                        onClick={() => {
                          if (!activeJobDoc) return;
                          const newOrder = activeJobTasks.length + 1;
                          const newRow = [
                            `task-${Date.now().toString(36)}`,
                            newOrder,
                            `Step ${newOrder}`,
                            "Perform requested modifications.",
                            false,
                            true,
                            false,
                            "",
                            "[]",
                            "[]",
                            true,
                            "",
                          ];
                          const updated = {
                            ...activeJobDoc,
                            Values: [...(activeJobDoc.Values || []), newRow],
                          };
                          setActiveJobDoc(updated as any);
                        }}
                        className="text-xs font-bold flex items-center gap-1 text-[#DE2626] hover:underline cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add Task Step</span>
                      </button>
                    </div>

                    <div className="border border-[#000000] bg-[#FFFFFF] divide-y divide-[#EEEEEE]">
                      {activeJobTasks.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#777777]">
                          No tasks loaded. Load a job from the Hub or create one from Job Templates.
                        </div>
                      ) : (
                        activeJobTasks.map((t, idx) => {
                          const isSelected = selectedTaskIndex === idx;
                          return (
                            <div
                              key={t.taskId}
                              onClick={() => setSelectedTaskIndex(idx)}
                              className={`p-3.5 flex items-start justify-between cursor-pointer transition-colors ${
                                isSelected ? "bg-[#F8F8F8] border-l-4 border-l-[#DE2626]" : "hover:bg-[#FAFAFA]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="pt-0.5">
                                  {t.taskCompleted ? (
                                    <CheckCircle2 size={16} className="text-[#000000]" />
                                  ) : (
                                    <Clock size={16} className="text-[#DE2626]" />
                                  )}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-[#000000] flex items-center gap-2">
                                    <span>
                                      Step {t.taskOrder}: {t.taskName}
                                    </span>
                                    {t.auditEnabled && (
                                      <span className="text-[10px] font-mono border border-[#000000] px-1 py-0.2">
                                        Audit Gate
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[#444444] mt-0.5">{t.taskDescription}</div>

                                  {t.auditFailReason && (
                                    <div className="text-xs text-[#DE2626] font-mono mt-1">
                                      Audit Fail: {t.auditFailReason}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!activeJobDoc) return;
                                    const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(activeJobDoc));
                                    const fmap = bejson_core_get_field_map(clonedDoc);
                                    const row = clonedDoc.Values[idx];
                                    row[fmap["task_completed"]] = !row[fmap["task_completed"]];
                                    setActiveJobDoc(clonedDoc);
                                  }}
                                  className="text-[11px] px-2 py-0.5 border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] cursor-pointer"
                                >
                                  {t.taskCompleted ? "Mark Pending" : "Mark Done"}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {activeJobTasks[selectedTaskIndex] && (
                    <div className="border border-[#000000] p-4 bg-[#FFFFFF] space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                        Edit Step {activeJobTasks[selectedTaskIndex].taskOrder} Details
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase mb-1">Step Name</label>
                          <input
                            type="text"
                            value={activeJobTasks[selectedTaskIndex].taskName}
                            onChange={(e) => {
                              const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(activeJobDoc));
                              const fmap = bejson_core_get_field_map(clonedDoc);
                              clonedDoc.Values[selectedTaskIndex][fmap["task_name"]] = e.target.value;
                              setActiveJobDoc(clonedDoc);
                            }}
                            className="w-full p-2 text-xs border border-[#000000] rounded-none focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase mb-1">Subprocess Test Command</label>
                          <input
                            type="text"
                            value={activeJobTasks[selectedTaskIndex].testCmd || ""}
                            onChange={(e) => {
                              const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(activeJobDoc));
                              const fmap = bejson_core_get_field_map(clonedDoc);
                              if (fmap["test_cmd"] !== undefined) {
                                clonedDoc.Values[selectedTaskIndex][fmap["test_cmd"]] = e.target.value;
                                setActiveJobDoc(clonedDoc);
                              }
                            }}
                            placeholder="e.g. npm test or python3 -m py_compile {SCRIPT}"
                            className="w-full p-2 text-xs border border-[#000000] rounded-none font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase mb-1">Step Instructions</label>
                        <textarea
                          rows={2}
                          value={activeJobTasks[selectedTaskIndex].taskDescription}
                          onChange={(e) => {
                            const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(activeJobDoc));
                            const fmap = bejson_core_get_field_map(clonedDoc);
                            clonedDoc.Values[selectedTaskIndex][fmap["task_description"]] = e.target.value;
                            setActiveJobDoc(clonedDoc);
                          }}
                          className="w-full p-2 text-xs border border-[#000000] rounded-none focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editorSubTab === "json" && (
                <div className="flex-1 p-4 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-[#666666]">
                      Format: BEJSON 104a · Elton Boehnen
                    </span>
                    <button
                      onClick={() => {
                        if (activeJobDoc) {
                          navigator.clipboard.writeText(serialize(activeJobDoc, 2));
                          setSuccessBanner("Copied BEJSON payload to clipboard.");
                        }
                      }}
                      className="text-xs font-bold text-[#DE2626] hover:underline cursor-pointer"
                    >
                      Copy Raw JSON
                    </button>
                  </div>
                  <pre className="flex-1 bg-[#000000] text-[#FFFFFF] p-4 text-xs font-mono overflow-auto border border-[#000000]">
                    {activeJobDoc ? serialize(activeJobDoc, 2) : "{}"}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 4. RUNNER & DIFF REVIEW SECTION */}
          {activeSection === "runner" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center border-b border-[#000000] bg-[#FFFFFF] px-4 gap-2">
                <button
                  onClick={() => setRunnerSubTab("staged")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    runnerSubTab === "staged"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Active Stage Diff {stagedEvolution ? "(1 Pending Review)" : "(Idle)"}
                </button>
                <button
                  onClick={() => setRunnerSubTab("traces")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    runnerSubTab === "traces"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Execution Traces
                </button>
              </div>

              {runnerSubTab === "staged" && (
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 max-w-5xl mx-auto w-full flex flex-col">
                  {stagedEvolution ? (
                    <div className="flex-1 flex flex-col border border-[#000000] bg-[#FFFFFF] p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-[#000000] pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-[#000000]">
                            Verified Candidate Diff &mdash; Step {stagedEvolution.taskOrder}: {stagedEvolution.taskName}
                          </h3>
                          <div className="text-xs font-mono text-[#555555]">
                            Target File: {stagedEvolution.targetFile}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleDiscardDiff}
                            className="px-4 py-1.5 border border-[#000000] text-xs font-bold text-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            onClick={handleCommitDiff}
                            className="px-5 py-1.5 bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer"
                          >
                            Approve &amp; Commit
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col">
                        <pre className="flex-1 bg-[#000000] text-[#FFFFFF] p-4 text-xs font-mono overflow-auto max-h-[500px] border border-[#000000] whitespace-pre leading-relaxed">
                          {stagedEvolution.diff.split("\n").map((line, lIdx) => {
                            let lineStyle = "text-[#FFFFFF]";
                            if (line.startsWith("+") && !line.startsWith("+++")) {
                              lineStyle = "text-[#A7F3D0]";
                            } else if (line.startsWith("-") && !line.startsWith("---")) {
                              lineStyle = "text-[#FCA5A5]";
                            } else if (line.startsWith("@@")) {
                              lineStyle = "text-[#DE2626] font-bold";
                            }
                            return (
                              <div key={lIdx} className={lineStyle}>
                                {line}
                              </div>
                            );
                          })}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-[#000000] p-12 text-center bg-[#FFFFFF] space-y-3">
                      <Layers size={36} className="mx-auto text-[#000000]" />
                      <h3 className="text-sm font-bold uppercase">No Active Mutation Staged</h3>
                      <p className="text-xs text-[#555555] max-w-md mx-auto">
                        Click "RUN NEXT TASK" in the header toolbar or select an active job step to synthesize a surgical candidate patch.
                      </p>
                      <button
                        onClick={handleRunNextTask}
                        className="bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] px-6 py-2 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Play size={14} className="fill-current" />
                        <span>Run Next Task Now</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {runnerSubTab === "traces" && (
                <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Job Execution Traces</h3>
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF]">
                    {activeJobDoc && (activeJobDoc as any)["Execution_Traces"] ? (
                      <pre className="text-xs font-mono text-[#000000] whitespace-pre-wrap">
                        {JSON.stringify((activeJobDoc as any)["Execution_Traces"], null, 2)}
                      </pre>
                    ) : (
                      <div className="text-xs text-[#666666]">No execution traces recorded yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. TEMPLATES SECTION */}
          {activeSection === "templates" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center border-b border-[#000000] bg-[#FFFFFF] px-4 gap-2">
                <button
                  onClick={() => setTemplatesSubTab("browse")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    templatesSubTab === "browse"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Production Templates ({RUNNER_TEMPLATES.length})
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider mb-1">
                    BEJSON 104a Job Templates
                  </h2>
                  <p className="text-xs text-[#555555]">
                    Instantiate pre-configured job workflows with audit gates, AST syntax validation, and context slots.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {RUNNER_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.templateId}
                      className="border border-[#000000] p-4 bg-[#FFFFFF] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold tracking-wider uppercase text-[#DE2626]">
                            {tmpl.category}
                          </span>
                          <span className="text-[10px] font-mono text-[#888888]">{tmpl.jobSubtype}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#000000] mb-1.5">{tmpl.templateName}</h3>
                        <p className="text-xs text-[#555555] mb-3">{tmpl.description}</p>

                        <div className="space-y-1 mb-4">
                          <div className="text-[11px] font-semibold text-[#000000]">
                            Steps ({tmpl.tasks.length}):
                          </div>
                          {tmpl.tasks.map((t, i) => (
                            <div key={i} className="text-xs text-[#444444] flex items-center gap-1.5">
                              <span className="text-[10px] font-mono">[{i + 1}]</span>
                              <span className="truncate">{t.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#EEEEEE] flex items-center justify-between">
                        <span className="text-[11px] font-mono text-[#666666]">
                          Target: {tmpl.defaultTarget}
                        </span>
                        <button
                          onClick={() => handleInstantiateTemplate(tmpl)}
                          className="bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Use Template
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. KEY MANAGER SECTION */}
          {activeSection === "keys" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center border-b border-[#000000] bg-[#FFFFFF] px-4 gap-2">
                <button
                  onClick={() => setKeysSubTab("slots")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    keysSubTab === "slots"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Key Slots ({keySlots.filter((s) => s.apiKey.trim().length > 0).length} / 20 Loaded)
                </button>
                <button
                  onClick={() => setKeysSubTab("models")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    keysSubTab === "models"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Model Configuration ({selectedModel})
                </button>
              </div>

              {keysSubTab === "slots" && (
                <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF]">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold uppercase tracking-wider">
                        BEJSON 104a Browser Key Store
                      </h2>
                      <span className="text-xs font-mono text-[#DE2626]">
                        Active Rotation Slot: {currentKeySlotIndex}
                      </span>
                    </div>
                    <p className="text-xs text-[#555555]">
                      Keys are held client-side in an isolated BEJSON 104a document and rotated in round-robin fashion during execution runs. No keys are ever written to public repository files.
                    </p>
                  </div>

                  <div className="border border-[#000000] bg-[#FFFFFF] divide-y divide-[#EEEEEE]">
                    {keySlots.slice(0, 10).map((slot) => {
                      const isCurrentActive = slot.slotIndex === currentKeySlotIndex;
                      return (
                        <div key={slot.slotIndex} className="p-3.5 flex flex-col sm:flex-row items-center gap-3">
                          <div className="flex items-center gap-2 sm:w-36 shrink-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                slot.apiKey.trim() ? (isCurrentActive ? "bg-[#DE2626]" : "bg-[#000000]") : "bg-[#CCCCCC]"
                              }`}
                            />
                            <span className="text-xs font-bold text-[#000000]">{slot.slotLabel}</span>
                          </div>

                          <div className="flex-1 w-full">
                            <input
                              type="password"
                              value={slot.apiKey}
                              onChange={(e) => {
                                const updated = updateKeySlot(keyStoreDoc, slot.slotIndex, e.target.value);
                                setKeyStoreDoc(updated);
                              }}
                              placeholder="Paste Gemini API Key..."
                              className="w-full p-1.5 text-xs font-mono border border-[#000000] rounded-none focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-mono text-[#666666] shrink-0">
                            <span>Calls: {slot.callCount}</span>
                            <button
                              onClick={() => {
                                const updated = updateKeySlot(keyStoreDoc, slot.slotIndex, "", slot.slotLabel, true);
                                setKeyStoreDoc(updated);
                              }}
                              className="text-[#DE2626] hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {keysSubTab === "models" && (
                <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full space-y-4">
                  <div className="border border-[#000000] p-6 bg-[#FFFFFF] space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider">
                      Google Gemini Model Selection
                    </h3>
                    <p className="text-xs text-[#555555]">
                      Select the active model for code synthesis. Default runtime model is <span className="font-mono font-bold text-[#DE2626]">gemini-3.6-flash</span>.
                    </p>

                    <div className="space-y-2">
                      {SUPPORTED_GEMINI_MODELS.map((m) => {
                        const isSel = selectedModel === m;
                        return (
                          <div
                            key={m}
                            onClick={() => {
                              setSelectedModel(m);
                              const cloned = { ...keyStoreDoc, Selected_Model: m };
                              setKeyStoreDoc(cloned as any);
                            }}
                            className={`p-3 border flex items-center justify-between cursor-pointer transition-colors ${
                              isSel ? "border-[#DE2626] bg-[#FFFFFF]" : "border-[#000000] hover:bg-[#FAFAFA]"
                            }`}
                          >
                            <span className="font-mono text-xs font-bold">{m}</span>
                            {isSel ? (
                              <span className="bg-[#DE2626] text-[#FFFFFF] text-[10px] font-bold px-2 py-0.5">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="text-xs text-[#888888]">Select</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. GENERATE JOB SECTION (AI Structured Output & Self-Healing Validation Loop) */}
          {activeSection === "generate" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Horizontal Sub-Navigation Bar */}
              <div className="flex items-center border-b border-[#000000] bg-[#FFFFFF] px-4 gap-2 overflow-x-auto">
                <button
                  onClick={() => setGenSubTab("create")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer shrink-0 ${
                    genSubTab === "create"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Configure &amp; Generate
                </button>
                <button
                  onClick={() => setGenSubTab("preview")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    genSubTab === "preview"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  <span>Generated Job Preview</span>
                  {generatedJobDoc && (
                    <span className="text-[10px] bg-[#000000] text-[#FFFFFF] px-1.5 py-0.2">
                      Ready
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setGenSubTab("diagnostics")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    genSubTab === "diagnostics"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  <span>Validation &amp; Error Loop</span>
                  {genDiagnostics.length > 0 && (
                    <span className="text-[10px] bg-[#DE2626] text-[#FFFFFF] px-1.5 py-0.2">
                      {genDiagnostics.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setGenSubTab("analogy")}
                  className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors cursor-pointer shrink-0 ${
                    genSubTab === "analogy"
                      ? "border-b-2 border-[#DE2626] text-[#DE2626]"
                      : "text-[#000000] hover:text-[#DE2626]"
                  }`}
                >
                  Spreadsheet Analogy
                </button>
              </div>

              {/* Subtab 1: Configure & Generate */}
              {genSubTab === "create" && (
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                  {/* Banner / Explanation */}
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF]">
                    <div className="flex items-start gap-3">
                      <Sparkles size={22} className="text-[#DE2626] shrink-0 mt-0.5" />
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-[#000000]">
                          Autonomous Job Document Generator
                        </h2>
                        <p className="text-xs text-[#555555] mt-1 leading-relaxed">
                          Describe the workflow, script evolution, refactoring, or test matrix you need. The AI will synthesize a complete, valid BEJSON 104a Job document adhering strictly to Elton Boehnen's spreadsheet workbook specifications. If validation fails, errors are automatically diagnosed and fed back into system instructions until valid.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Banners */}
                  {genError && (
                    <div className="border border-[#DE2626] bg-[#000000] text-[#DE2626] p-4 text-xs">
                      <div className="font-bold uppercase tracking-wider flex items-center gap-2 mb-1">
                        <AlertTriangle size={15} />
                        <span>Generation &amp; Validation Failed ({genAttempts} attempt(s))</span>
                      </div>
                      <p>{genError}</p>
                      <button
                        onClick={() => setGenSubTab("diagnostics")}
                        className="mt-2 text-xs text-[#FFFFFF] underline hover:text-[#DE2626] font-mono cursor-pointer"
                      >
                        Inspect Diagnostic Error Traces &rarr;
                      </button>
                    </div>
                  )}

                  {genSuccessMessage && (
                    <div className="border border-[#000000] bg-[#000000] text-[#FFFFFF] p-4 text-xs">
                      <div className="font-bold uppercase tracking-wider flex items-center gap-2 mb-1">
                        <CheckCircle2 size={15} className="text-[#FFFFFF]" />
                        <span>Generation Succeeded</span>
                      </div>
                      <p>{genSuccessMessage}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          onClick={() => setGenSubTab("preview")}
                          className="bg-[#DE2626] text-[#FFFFFF] px-3 py-1 font-bold text-xs hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
                        >
                          View Generated Job &rarr;
                        </button>
                        <button
                          onClick={handleLoadGeneratedJobIntoEditor}
                          className="border border-[#FFFFFF] text-[#FFFFFF] px-3 py-1 font-bold text-xs hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
                        >
                          Load Directly into Job Editor
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Generator Form Controls */}
                  <div className="border border-[#000000] p-5 bg-[#FFFFFF] space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                          Job Purpose &amp; Task Requirements <span className="text-[#DE2626]">*</span>
                        </label>
                        <span className="text-[11px] font-mono text-[#888888]">Plain language prompt</span>
                      </div>
                      <textarea
                        rows={4}
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder="e.g. Refactor Joob_Runner.py to integrate execution gates, AST verification, diff review before atomic writes, and full test rollback..."
                        className="w-full p-3 text-xs border border-[#000000] font-mono bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Quick Preset Prompts */}
                    <div>
                      <div className="text-[11px] font-bold text-[#666666] uppercase mb-1.5">
                        Quick Template Prompts:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGenPrompt("Refactor Joob_Runner.py to add AST syntax validation gates, atomic diff review, and safe rollback.");
                            setGenJobName("Python AST Gate & Atomic Rollback");
                            setGenTargetFile("Joob_Runner.py");
                            setGenJobType("refactor");
                            setGenJobSubtype("python");
                            setGenStepCount(5);
                          }}
                          className="text-[11px] border border-[#CCCCCC] hover:border-[#DE2626] hover:text-[#DE2626] px-2 py-1 bg-[#FAFAFA] text-[#222222] transition-colors cursor-pointer"
                        >
                          Python Refactor &amp; AST Gate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGenPrompt("Build standalone 1:1 vanilla JavaScript library mirrors in src/lib/lib_js with zero node dependencies.");
                            setGenJobName("TypeScript to Vanilla JS Mirroring");
                            setGenTargetFile("src/lib/lib_js/lib_bejson_Runner_engine.js");
                            setGenJobType("feature");
                            setGenJobSubtype("typescript");
                            setGenStepCount(6);
                          }}
                          className="text-[11px] border border-[#CCCCCC] hover:border-[#DE2626] hover:text-[#DE2626] px-2 py-1 bg-[#FAFAFA] text-[#222222] transition-colors cursor-pointer"
                        >
                          Vanilla JS Library Mirror
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGenPrompt("Implement full-stack Express API endpoints with BEJSON 104a schema validation, error feedback, and atomic save.");
                            setGenJobName("Express API Endpoints & BEJSON Validation");
                            setGenTargetFile("server.ts");
                            setGenJobType("feature");
                            setGenJobSubtype("typescript");
                            setGenStepCount(5);
                          }}
                          className="text-[11px] border border-[#CCCCCC] hover:border-[#DE2626] hover:text-[#DE2626] px-2 py-1 bg-[#FAFAFA] text-[#222222] transition-colors cursor-pointer"
                        >
                          Express Full-Stack API
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGenPrompt("Architect and generate a multi-page website plan: first generate the master shell layout & navigation template (header, nav links, footer, responsive CSS), then derive the Index/Landing, Feed/Catalog, Features, About, and Contact pages off the master template, and conclude with an automated Navigation & Cross-Page Hyperlink Integrity Audit verifying 100% route validity and responsive nav across all pages.");
                            setGenJobName("Multi-Page Website & Nav Link Audit");
                            setGenTargetFile("website/index.html");
                            setGenJobType("website");
                            setGenJobSubtype("multipage_html");
                            setGenStepCount(7);
                          }}
                          className="text-[11px] border border-[#DE2626] hover:bg-[#DE2626] hover:text-[#FFFFFF] px-2 py-1 bg-[#FAFAFA] text-[#DE2626] font-bold transition-colors cursor-pointer"
                        >
                          Multi-Page Website &amp; Nav Audit
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                          Suggested Job Name
                        </label>
                        <input
                          type="text"
                          value={genJobName}
                          onChange={(e) => setGenJobName(e.target.value)}
                          placeholder="e.g. AST Verification Pipeline"
                          className="w-full p-2 text-xs border border-[#000000] bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                          Target Script / File Path
                        </label>
                        <input
                          type="text"
                          value={genTargetFile}
                          onChange={(e) => setGenTargetFile(e.target.value)}
                          placeholder="e.g. Joob_Runner.py or server.ts"
                          className="w-full p-2 text-xs border border-[#000000] font-mono bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                          Job Type &amp; Subtype
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={genJobType}
                            onChange={(e) => setGenJobType(e.target.value)}
                            className="flex-1 p-2 text-xs border border-[#000000] bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                          >
                            <option value="website">website</option>
                            <option value="feature">feature</option>
                            <option value="refactor">refactor</option>
                            <option value="script">script</option>
                            <option value="ui">ui</option>
                            <option value="data_migration">data_migration</option>
                            <option value="test_suite">test_suite</option>
                            <option value="custom">custom</option>
                          </select>
                          <select
                            value={genJobSubtype}
                            onChange={(e) => setGenJobSubtype(e.target.value)}
                            className="flex-1 p-2 text-xs border border-[#000000] bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                          >
                            <option value="multipage_html">multipage_html</option>
                            <option value="typescript">typescript</option>
                            <option value="python">python</option>
                            <option value="react">react</option>
                            <option value="bash">bash</option>
                            <option value="bejson_104a">bejson_104a</option>
                            <option value="audit">audit</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                          Sequential Task Steps Count ({genStepCount})
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={15}
                          value={genStepCount}
                          onChange={(e) => setGenStepCount(parseInt(e.target.value, 10) || 5)}
                          className="w-full p-2 text-xs border border-[#000000] font-mono bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#EEEEEE]">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                            Gemini Model:
                          </label>
                          <select
                            value={genModel}
                            onChange={(e) => setGenModel(e.target.value)}
                            className="p-1.5 text-xs border border-[#000000] font-mono bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                          >
                            {SUPPORTED_GEMINI_MODELS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="text-xs text-[#666666]">
                          {activeKeySlotCount > 0 ? (
                            <span className="font-mono text-[#000000]">
                              Key Slot {currentKeySlotIndex}/20 active (Round-robin)
                            </span>
                          ) : (
                            <span className="font-mono text-[#888888]">Using server ENV key</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <button
                        onClick={handleGenerateJob}
                        disabled={isGenerating}
                        className="w-full bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] hover:border hover:border-[#DE2626] py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <RotateCw size={14} className="animate-spin" />
                            <span>Synthesizing &amp; Validating BEJSON 104a...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Generate BEJSON 104a Job Document</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Generated Job Preview */}
              {genSubTab === "preview" && (
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                  {generatedJobDoc ? (
                    <>
                      {/* Job Header Summary */}
                      <div className="border border-[#000000] p-5 bg-[#FFFFFF] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#000000] pb-3">
                          <div>
                            <div className="text-[10px] font-mono text-[#DE2626] uppercase font-bold">
                              BEJSON 104a Schema · Elton Boehnen
                            </div>
                            <h2 className="text-base font-bold text-[#000000]">
                              {(generatedJobDoc as any)["Job_Name"] || "Generated Job"}
                            </h2>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleLoadGeneratedJobIntoEditor}
                              className="bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Load Into Editor
                            </button>
                            <button
                              onClick={handleDownloadGeneratedBEJSON}
                              className="border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Download .bejson file"
                            >
                              <Download size={13} />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={handleCopyGeneratedBEJSON}
                              className="border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Copy JSON to clipboard"
                            >
                              <Copy size={13} />
                              <span>Copy</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono">
                          <div>
                            <span className="text-[#888888]">Target File:</span>{" "}
                            <span className="font-bold text-[#000000]">
                              {(generatedJobDoc as any)["Target_File"] || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#888888]">Job Type:</span>{" "}
                            <span className="text-[#000000]">
                              {(generatedJobDoc as any)["Job_Type"] || "feature"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#888888]">Subtype:</span>{" "}
                            <span className="text-[#000000]">
                              {(generatedJobDoc as any)["Job_Subtype"] || "typescript"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#888888]">Tasks:</span>{" "}
                            <span className="font-bold text-[#DE2626]">
                              {Array.isArray(generatedJobDoc.Values) ? generatedJobDoc.Values.length : 0} steps
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 text-xs">
                          <span className="text-[#888888] font-bold">Job Goal: </span>
                          <span className="text-[#000000]">
                            {(generatedJobDoc as any)["Job_Goal"] || "No goal specified."}
                          </span>
                        </div>
                      </div>

                      {/* Tasks Sequence Table */}
                      <div className="border border-[#000000] bg-[#FFFFFF]">
                        <div className="p-3 bg-[#000000] text-[#FFFFFF] text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>Synthesized Task Sequence</span>
                          <span className="font-mono text-[10px] text-[#AAAAAA]">
                            Positional Row Mapping (Values)
                          </span>
                        </div>

                        <div className="divide-y divide-[#000000]">
                          {(() => {
                            const fmap = bejson_core_get_field_map(generatedJobDoc);
                            return (generatedJobDoc.Values || []).map((row: any[], idx: number) => {
                              const tId = String(row[fmap["task_id"]] || `task-${idx + 1}`);
                              const tOrder = Number(row[fmap["task_order"]] || idx + 1);
                              const tName = String(row[fmap["task_name"]] || `Step ${idx + 1}`);
                              const tDesc = String(row[fmap["task_description"]] || "");
                              const tMandatory = Boolean(row[fmap["task_mandatory"]]);
                              const tAudit = Boolean(row[fmap["audit_enabled"]]);
                              const tCmd = String(row[fmap["test_cmd"]] || "");

                              return (
                                <div key={idx} className="p-4 space-y-2 hover:bg-[#FAFAFA] transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 flex items-center justify-center bg-[#000000] text-[#FFFFFF] text-xs font-bold font-mono">
                                        {tOrder}
                                      </span>
                                      <span className="font-bold text-xs text-[#000000]">{tName}</span>
                                      <span className="font-mono text-[10px] text-[#888888]">({tId})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {tMandatory && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#000000] text-[#FFFFFF]">
                                          MANDATORY
                                        </span>
                                      )}
                                      {tAudit && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.2 border border-[#DE2626] text-[#DE2626]">
                                          AUDIT
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-xs text-[#444444] leading-relaxed pl-7">
                                    {tDesc}
                                  </div>

                                  {tCmd && (
                                    <div className="pl-7 font-mono text-[11px] text-[#DE2626]">
                                      $ {tCmd}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Raw BEJSON Document View */}
                      <div className="border border-[#000000] bg-[#FFFFFF]">
                        <div className="p-3 bg-[#000000] text-[#FFFFFF] text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>Raw BEJSON 104a Payload</span>
                          <button
                            onClick={handleCopyGeneratedBEJSON}
                            className="text-xs font-bold text-[#FFFFFF] hover:text-[#DE2626] flex items-center gap-1 cursor-pointer"
                          >
                            <Copy size={12} />
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="p-4 bg-[#000000] text-[#FFFFFF] font-mono text-xs overflow-auto max-h-72 whitespace-pre">
                          {serialize(generatedJobDoc, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="border border-[#000000] p-12 text-center bg-[#FFFFFF]">
                      <Sparkles size={32} className="mx-auto text-[#AAAAAA] mb-3" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#000000]">
                        No Job Generated Yet
                      </h3>
                      <p className="text-xs text-[#666666] mt-1 max-w-sm mx-auto">
                        Enter your job requirements in the "Configure &amp; Generate" tab and click generate to synthesize your BEJSON 104a document.
                      </p>
                      <button
                        onClick={() => setGenSubTab("create")}
                        className="mt-4 bg-[#DE2626] text-[#FFFFFF] px-4 py-2 text-xs font-bold hover:bg-[#000000] transition-colors cursor-pointer"
                      >
                        Go to Configure &amp; Generate
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 3: Self-Healing Validation & Error Loop Diagnostics */}
              {genSubTab === "diagnostics" && (
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF]">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#000000]">
                      Self-Healing Validation Loop &amp; Diagnostic Ledger
                    </h3>
                    <p className="text-xs text-[#555555] mt-1 leading-relaxed">
                      Whenever the model synthesizes a candidate document, the server executes strict Elton Boehnen Core BEJSON validators. If any constraint fails, the server extracts the exact error codes, generates diagnosis explanations with spreadsheet analogies, and reinjects them into the system instructions for the next attempt.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {genDiagnostics.length === 0 ? (
                      <div className="border border-[#000000] p-8 text-center bg-[#FFFFFF]">
                        <CheckCircle2 size={28} className="mx-auto text-[#000000] mb-2" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">
                          No Validation Errors Detected
                        </h4>
                        <p className="text-xs text-[#666666] mt-1">
                          Generated documents validated on the first attempt or no generation runs have occurred yet.
                        </p>
                      </div>
                    ) : (
                      genDiagnostics.map((diag, idx) => (
                        <div key={idx} className="border border-[#DE2626] bg-[#FFFFFF] p-4 space-y-2">
                          <div className="flex items-center justify-between border-b border-[#EEEEEE] pb-2">
                            <span className="font-bold text-xs text-[#DE2626] uppercase">
                              Diagnostic Trace #{idx + 1}
                            </span>
                            <span className="font-mono text-[10px] text-[#666666]">
                              Injected into AI System Instructions
                            </span>
                          </div>
                          <pre className="font-mono text-xs text-[#000000] bg-[#FAFAFA] p-3 border border-[#DDDDDD] whitespace-pre-wrap leading-relaxed overflow-x-auto">
                            {diag}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Subtab 4: Spreadsheet Analogy Educational Reference */}
              {genSubTab === "analogy" && (
                <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                  <div className="border border-[#000000] p-5 bg-[#FFFFFF] space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#000000] border-b border-[#000000] pb-2">
                      BEJSON 104a Taught Via The Spreadsheet Analogy
                    </h3>

                    <div className="space-y-4 text-xs text-[#222222] leading-relaxed">
                      <div className="border-l-2 border-[#DE2626] pl-3">
                        <h4 className="font-bold uppercase text-[#000000]">1. Workbook Identity (Root Metadata)</h4>
                        <p className="text-[#555555]">
                          The root object is like a workbook file. It defines the brand and format version:
                          <code className="font-mono text-[#000000]"> "Format": "BEJSON"</code>,
                          <code className="font-mono text-[#000000]"> "Format_Version": "104a"</code>,
                          <code className="font-mono text-[#000000]"> "Format_Creator": "Elton Boehnen"</code>.
                          The single sheet tab name is in <code className="font-mono text-[#000000]">"Records_Type": ["JobTask"]</code>.
                        </p>
                      </div>

                      <div className="border-l-2 border-[#DE2626] pl-3">
                        <h4 className="font-bold uppercase text-[#000000]">2. Workbook Properties (Custom Headers)</h4>
                        <p className="text-[#555555]">
                          Workbook metadata properties must reside only at root and use PascalCase (e.g. <code className="font-mono">Job_Name</code>, <code className="font-mono">Job_Goal</code>, <code className="font-mono">Target_File</code>). They can never collide with the 6 mandatory keys.
                        </p>
                      </div>

                      <div className="border-l-2 border-[#DE2626] pl-3">
                        <h4 className="font-bold uppercase text-[#000000]">3. Column Header Row ("Fields")</h4>
                        <p className="text-[#555555]">
                          Row 1 of the spreadsheet workbook. Declares all column names and primitive types:
                          <code className="font-mono text-[#000000]"> [name, type]</code>. Order in Fields establishes positional mapping.
                        </p>
                      </div>

                      <div className="border-l-2 border-[#DE2626] pl-3">
                        <h4 className="font-bold uppercase text-[#000000]">4. Data Rows ("Values")</h4>
                        <p className="text-[#555555]">
                          Rows 2, 3, 4... underneath the header. Every row is an array where cell values match the column header types.
                          <strong>Positional Integrity Rule:</strong> Every row must have exactly the same length as Fields (12 cells).
                        </p>
                      </div>

                      <div className="border-l-2 border-[#DE2626] pl-3">
                        <h4 className="font-bold uppercase text-[#000000]">5. Field Map Cache Mandate</h4>
                        <p className="text-[#555555]">
                          Index-based positional hardcoding is strictly forbidden. The system always looks up cell column indices using <code className="font-mono">bejson_core_get_field_map()</code> to ensure resilience even if columns change order.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. SYSTEM CONSOLE & ACTION AUDIT LEDGER */}
          {activeSection === "console" && (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#FFFFFF]">
              {/* Top Sub-Navigation / Action Toolbar */}
              <div className="border-b border-[#000000] bg-[#FFFFFF] px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-[#DE2626]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                    System Console &amp; Action Audit Ledger
                  </h2>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyAllLogs}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] hover:border hover:border-[#DE2626] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    title="Copy full debug report to clipboard to send for debugging"
                  >
                    <Copy size={13} />
                    <span>Copy Full Debug Log</span>
                  </button>

                  <button
                    onClick={handleDownloadLogs}
                    disabled={consoleLogs.length === 0}
                    className="flex items-center gap-1.5 border border-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] text-[#000000] px-3 py-1.5 text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
                    title="Download debug log as a text file"
                  >
                    <Download size={13} />
                    <span className="hidden md:inline">Download (.txt)</span>
                  </button>

                  <button
                    onClick={handleClearLogs}
                    disabled={consoleLogs.length === 0}
                    className="flex items-center gap-1.5 border border-[#000000] hover:bg-[#DE2626] hover:text-[#FFFFFF] hover:border-[#DE2626] text-[#000000] px-2.5 py-1.5 text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
                    title="Clear current console history"
                  >
                    <Trash2 size={13} />
                    <span className="hidden md:inline">Clear</span>
                  </button>
                </div>
              </div>

              {/* Status & Filter Bar */}
              <div className="border-b border-[#000000] bg-[#FAFAFA] p-3 space-y-2 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-[11px] text-[#666666] uppercase mr-1">Filter Level:</span>
                    <button
                      onClick={() => setConsoleFilterLevel("all")}
                      className={`px-2 py-0.5 text-xs font-bold transition-colors cursor-pointer ${
                        consoleFilterLevel === "all"
                          ? "bg-[#000000] text-[#FFFFFF]"
                          : "bg-[#FFFFFF] border border-[#CCCCCC] text-[#333333] hover:border-[#000000]"
                      }`}
                    >
                      All ({consoleLogs.length})
                    </button>
                    <button
                      onClick={() => setConsoleFilterLevel("ERROR")}
                      className={`px-2 py-0.5 text-xs font-bold transition-colors cursor-pointer ${
                        consoleFilterLevel === "ERROR"
                          ? "bg-[#DE2626] text-[#FFFFFF]"
                          : errorLogsCount > 0
                          ? "bg-[#FFFFFF] border border-[#DE2626] text-[#DE2626] hover:bg-[#DE2626] hover:text-[#FFFFFF]"
                          : "bg-[#FFFFFF] border border-[#CCCCCC] text-[#888888]"
                      }`}
                    >
                      Errors ({errorLogsCount})
                    </button>
                    <button
                      onClick={() => setConsoleFilterLevel("WARN")}
                      className={`px-2 py-0.5 text-xs font-bold transition-colors cursor-pointer ${
                        consoleFilterLevel === "WARN"
                          ? "bg-[#000000] text-[#FFFFFF]"
                          : "bg-[#FFFFFF] border border-[#CCCCCC] text-[#333333] hover:border-[#000000]"
                      }`}
                    >
                      Warnings ({warnLogsCount})
                    </button>
                    <button
                      onClick={() => setConsoleFilterLevel("SUCCESS")}
                      className={`px-2 py-0.5 text-xs font-bold transition-colors cursor-pointer ${
                        consoleFilterLevel === "SUCCESS"
                          ? "bg-[#000000] text-[#FFFFFF]"
                          : "bg-[#FFFFFF] border border-[#CCCCCC] text-[#333333] hover:border-[#000000]"
                      }`}
                    >
                      Success ({successLogsCount})
                    </button>
                    <button
                      onClick={() => setConsoleFilterLevel("INFO")}
                      className={`px-2 py-0.5 text-xs font-bold transition-colors cursor-pointer ${
                        consoleFilterLevel === "INFO"
                          ? "bg-[#000000] text-[#FFFFFF]"
                          : "bg-[#FFFFFF] border border-[#CCCCCC] text-[#333333] hover:border-[#000000]"
                      }`}
                    >
                      Info ({infoLogsCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11px] text-[#666666] uppercase">Category:</span>
                    <select
                      value={consoleFilterCategory}
                      onChange={(e) => setConsoleFilterCategory(e.target.value)}
                      className="text-xs p-1 border border-[#000000] bg-[#FFFFFF] text-[#000000] rounded-none focus:outline-none"
                    >
                      <option value="all">All Categories</option>
                      <option value="RUN_STAGE">Stage Evolution (/api/run/stage)</option>
                      <option value="COMMIT_DIFF">Commit Diff (/api/run/commit)</option>
                      <option value="DISCARD_DIFF">Discard Diff</option>
                      <option value="GENERATE_JOB">Generate Job (/api/jobs/generate)</option>
                      <option value="TEMPLATE">Template Engine</option>
                      <option value="DOCUMENT_IO">Job Document IO</option>
                      <option value="SYSTEM">System &amp; Workspace</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={consoleSearchQuery}
                    onChange={(e) => setConsoleSearchQuery(e.target.value)}
                    placeholder="Search logs by keyword, endpoint, error text, or task name..."
                    className="w-full text-xs p-1.5 border border-[#000000] bg-[#FFFFFF] text-[#000000] font-mono rounded-none focus:outline-none"
                  />
                  {consoleSearchQuery && (
                    <button
                      onClick={() => setConsoleSearchQuery("")}
                      className="text-xs text-[#666666] hover:text-[#DE2626] font-bold px-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Log Records Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
                {filteredConsoleLogs.length === 0 ? (
                  <div className="border border-[#000000] p-8 text-center bg-[#FFFFFF]">
                    <Terminal size={32} className="mx-auto text-[#888888] mb-2" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                      No Console Entries Match Filter
                    </h3>
                    <p className="text-xs text-[#666666] mt-1">
                      {consoleLogs.length === 0
                        ? "Operations, mutations, stage evolutions, and network requests will appear here automatically."
                        : "Try adjusting your search query or level filters."}
                    </p>
                  </div>
                ) : (
                  filteredConsoleLogs.map((log) => {
                    const isExpanded = Boolean(expandedLogIds[log.id]);
                    const isError = log.level === "ERROR";
                    return (
                      <div
                        key={log.id}
                        className={`border p-3 transition-colors ${
                          isError
                            ? "border-[#DE2626] bg-[#FFF5F5]"
                            : log.level === "WARN"
                            ? "border-[#000000] bg-[#FFFDF0]"
                            : "border-[#000000] bg-[#FFFFFF]"
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E5] pb-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                isError
                                  ? "bg-[#DE2626] text-[#FFFFFF]"
                                  : log.level === "WARN"
                                  ? "bg-[#000000] text-[#DE2626]"
                                  : log.level === "SUCCESS"
                                  ? "bg-[#000000] text-[#FFFFFF]"
                                  : "bg-[#EEEEEE] text-[#000000]"
                              }`}
                            >
                              {log.level}
                            </span>

                            <span className="text-[10px] font-bold text-[#666666] bg-[#EEEEEE] px-1.5 py-0.5">
                              {log.category}
                            </span>

                            <span className="text-[11px] text-[#555555]">
                              {log.timeFormatted}
                            </span>

                            {log.endpoint && (
                              <span className="text-[10px] text-[#000000] font-bold bg-[#EAEAEA] px-1.5 py-0.5">
                                {log.method || "POST"} {log.endpoint}
                                {log.status ? ` [${log.status}]` : ""}
                                {log.durationMs !== undefined ? ` · ${log.durationMs}ms` : ""}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopySingleLog(log)}
                              className="text-[10px] border border-[#000000] px-2 py-0.5 hover:bg-[#DE2626] hover:text-[#FFFFFF] hover:border-[#DE2626] transition-colors cursor-pointer"
                              title="Copy this single entry"
                            >
                              Copy
                            </button>

                            {(log.requestPayload || log.responsePayload || log.errorDetails) && (
                              <button
                                onClick={() => handleToggleExpandLog(log.id)}
                                className="text-[10px] border border-[#000000] px-2 py-0.5 bg-[#000000] text-[#FFFFFF] hover:bg-[#DE2626] transition-colors cursor-pointer"
                              >
                                {isExpanded ? "Hide Details" : "Inspect Payload"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title & Summary */}
                        <div className="space-y-1">
                          <div className="font-bold text-xs text-[#000000]">
                            {log.title}
                          </div>
                          <div className="text-xs text-[#333333] leading-relaxed whitespace-pre-wrap">
                            {log.summary}
                          </div>

                          {/* Prominent Error Box */}
                          {log.errorMessage && (
                            <div className="mt-2 p-2.5 bg-[#000000] text-[#FFFFFF] border-l-4 border-[#DE2626] text-xs">
                              <div className="text-[10px] font-bold uppercase text-[#DE2626]">
                                Error Message:
                              </div>
                              <div className="text-[#FFFFFF] font-bold mt-0.5">
                                {log.errorMessage}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Expandable Technical Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-[#DDDDDD] space-y-2">
                            {log.errorDetails && (
                              <div>
                                <div className="text-[10px] font-bold uppercase text-[#DE2626] mb-1">
                                  Error Details &amp; Stack:
                                </div>
                                <pre className="p-2 bg-[#000000] text-[#FFFFFF] text-[11px] overflow-x-auto whitespace-pre-wrap">
                                  {log.errorDetails}
                                </pre>
                              </div>
                            )}

                            {log.requestPayload && (
                              <div>
                                <div className="text-[10px] font-bold uppercase text-[#000000] mb-1">
                                  Request Payload:
                                </div>
                                <pre className="p-2 bg-[#FAFAFA] border border-[#DDDDDD] text-[#000000] text-[11px] overflow-x-auto whitespace-pre-wrap">
                                  {typeof log.requestPayload === "string"
                                    ? log.requestPayload
                                    : JSON.stringify(log.requestPayload, null, 2)}
                                </pre>
                              </div>
                            )}

                            {log.responsePayload && (
                              <div>
                                <div className="text-[10px] font-bold uppercase text-[#000000] mb-1">
                                  Response Payload:
                                </div>
                                <pre className="p-2 bg-[#FAFAFA] border border-[#DDDDDD] text-[#000000] text-[11px] overflow-x-auto whitespace-pre-wrap">
                                  {typeof log.responsePayload === "string"
                                    ? log.responsePayload
                                    : JSON.stringify(log.responsePayload, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* ATTACHED FILE CONTENT PREVIEW MODAL */}
      {/* -------------------------------------------------------------------- */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-[#000000]/75 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#000000] max-w-2xl w-full flex flex-col max-h-[80vh] shadow-2xl p-5">
            <div className="flex items-start justify-between border-b border-[#000000] pb-2 mb-3">
              <div>
                <div className="font-bold text-sm text-[#000000] flex items-center gap-2">
                  <span>{previewFile.name}</span>
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 border ${
                      previewFile.type === "context"
                        ? "border-[#000000] text-[#000000]"
                        : "border-[#DE2626] text-[#DE2626]"
                    }`}
                  >
                    {previewFile.type === "context" ? "READ-ONLY STUDY" : "WORK ATTACHMENT"}
                  </span>
                </div>
                <div className="text-xs font-mono text-[#666666]">
                  Path: {previewFile.path} · {(previewFile.size / 1024).toFixed(1)} KB · Status:{" "}
                  {previewFile.isChecked ? "Checked (Sending)" : "Held On To (Omitted)"}
                </div>
              </div>

              <button
                onClick={() => setPreviewFile(null)}
                className="text-[#000000] hover:text-[#DE2626] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-[#000000] bg-[#000000] p-3 text-xs font-mono text-[#FFFFFF] whitespace-pre">
              {previewFile.content}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setPreviewFile(null)}
                className="bg-[#000000] text-[#FFFFFF] hover:bg-[#DE2626] px-5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* VERIFIED CANDIDATE DIFF REVIEW MODAL */}
      {/* -------------------------------------------------------------------- */}
      {isDiffModalOpen && stagedEvolution && (
        <div className="fixed inset-0 z-50 bg-[#000000]/75 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#000000] max-w-3xl w-full flex flex-col max-h-[85vh] p-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#000000] pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#000000] uppercase">
                  Verified Candidate Diff Review
                </h3>
                <div className="text-xs font-mono text-[#555555] mt-0.5">
                  Step {stagedEvolution.taskOrder}: {stagedEvolution.taskName} &rarr; {stagedEvolution.targetFile}
                </div>
              </div>

              <button
                onClick={() => setIsDiffModalOpen(false)}
                className="text-[#000000] hover:text-[#DE2626] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto border border-[#000000] bg-[#000000] p-3 text-xs font-mono text-[#FFFFFF] mb-4">
              {stagedEvolution.diff.split("\n").map((line, idx) => {
                let colorClass = "text-[#FFFFFF]";
                if (line.startsWith("+") && !line.startsWith("+++")) colorClass = "text-[#A7F3D0]";
                if (line.startsWith("-") && !line.startsWith("---")) colorClass = "text-[#FCA5A5]";
                if (line.startsWith("@@")) colorClass = "text-[#DE2626] font-bold";
                return (
                  <div key={idx} className={colorClass}>
                    {line}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-[#666666]">
                AST verification passed · Atomic swap ready
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscardDiff}
                  className="px-4 py-2 border border-[#000000] text-xs font-bold hover:bg-[#DE2626] hover:text-[#FFFFFF] cursor-pointer transition-colors"
                >
                  Discard Candidate
                </button>
                <button
                  onClick={handleCommitDiff}
                  className="px-6 py-2 bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] text-xs font-bold cursor-pointer transition-colors"
                >
                  Approve &amp; Commit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* REQUIRED APPLICATION META-UI: THE THREE-TAB ARCHITECTURE (Section 9.4) */}
      {/* -------------------------------------------------------------------- */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#000000]/75 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#000000] max-w-2xl w-full flex flex-col max-h-[85vh] shadow-2xl">
            <div className="bg-[#000000] text-[#FFFFFF] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide uppercase">System Information &amp; Meta-UI</span>
                <span className="text-[#DE2626] text-xs font-mono font-bold">3-Tab Standard</span>
              </div>
              <button
                onClick={() => setIsAboutModalOpen(false)}
                className="text-[#FFFFFF] hover:text-[#DE2626] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-[#000000] bg-[#FFFFFF] shrink-0">
              <button
                onClick={() => setMetaActiveTab(1)}
                className={`flex-1 py-2.5 text-xs font-bold text-center border-r border-[#DDDDDD] transition-colors cursor-pointer ${
                  metaActiveTab === 1
                    ? "bg-[#DE2626] text-[#FFFFFF]"
                    : "text-[#000000] hover:bg-[#F2F2F2]"
                }`}
              >
                Tab 1: About (Account)
              </button>
              <button
                onClick={() => setMetaActiveTab(2)}
                className={`flex-1 py-2.5 text-xs font-bold text-center border-r border-[#DDDDDD] transition-colors cursor-pointer ${
                  metaActiveTab === 2
                    ? "bg-[#DE2626] text-[#FFFFFF]"
                    : "text-[#000000] hover:bg-[#F2F2F2]"
                }`}
              >
                Tab 2: Change Log
              </button>
              <button
                onClick={() => setMetaActiveTab(3)}
                className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors cursor-pointer ${
                  metaActiveTab === 3
                    ? "bg-[#DE2626] text-[#FFFFFF]"
                    : "text-[#000000] hover:bg-[#F2F2F2]"
                }`}
              >
                Tab 3: Assets
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {metaActiveTab === 1 && (
                <div className="space-y-4">
                  <div className="border border-[#000000] p-4 bg-[#FFFFFF] space-y-2">
                    <h4 className="text-base font-bold text-[#000000]">JobMaker &amp; Job Runner</h4>
                    <p className="text-xs text-[#444444]">
                      Unified standalone job creation system and self-evolving runner rebuilt 100% in TypeScript with Elton Boehnen's Core BEJSON family libraries.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono border-t border-[#EEEEEE]">
                      <div>
                        <span className="text-[#888888]">Version:</span> 3.1.12 (Package 109)
                      </div>
                      <div>
                        <span className="text-[#888888]">Release Date:</span> 2026-10-02
                      </div>
                    </div>
                  </div>

                  <div className="border border-[#000000] p-4 bg-[#FFFFFF] space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#DE2626]">
                      Mandatory Author Attribution (Section 9.2)
                    </h5>
                    <div className="space-y-1 text-xs">
                      <div>
                        <strong>Author:</strong> Elton Boehnen
                      </div>
                      <div>
                        <strong>Email:</strong>{" "}
                        <a
                          href="mailto:boehnenelton2024@gmail.com"
                          className="text-[#000000] underline hover:text-[#DE2626]"
                        >
                          boehnenelton2024@gmail.com
                        </a>
                      </div>
                      <div>
                        <strong>Website:</strong>{" "}
                        <a
                          href="https://boehnenelton2024.pages.dev"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#000000] underline hover:text-[#DE2626]"
                        >
                          boehnenelton2024.pages.dev
                        </a>
                      </div>
                      <div>
                        <strong>GitHub:</strong>{" "}
                        <a
                          href="https://github.com/boehnenelton"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#000000] underline hover:text-[#DE2626]"
                        >
                          github.com/boehnenelton
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {metaActiveTab === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                      Revision History (bejson_project.json)
                    </h4>
                    <span className="text-[11px] font-mono text-[#888888]">Current: v3.1.12</span>
                  </div>

                  <div className="border border-[#000000] p-4 bg-[#FFFFFF] font-mono text-xs text-[#222222] whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                    {changeLogParsed}
                  </div>
                </div>
              )}

              {metaActiveTab === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#000000]">
                      Exportable Reusable Schemas
                    </label>
                    <button
                      onClick={handleDownloadAllSchemasZip}
                      className="bg-[#DE2626] hover:bg-[#000000] text-[#FFFFFF] px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Archive size={13} />
                      <span>Save ZIP Archive</span>
                    </button>
                  </div>

                  <div>
                    <select
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                      className="w-full p-2 text-xs border border-[#000000] rounded-none focus:outline-none"
                    >
                      {registeredAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.filename})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border border-[#000000]">
                    <pre className="p-3 bg-[#000000] text-[#FFFFFF] font-mono text-xs overflow-auto max-h-60 whitespace-pre">
                      {activeAsset ? JSON.stringify(activeAsset.doc, null, 2) : "{}"}
                    </pre>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={handleCopyActiveSchema}
                      className="px-4 py-1.5 border border-[#000000] text-xs font-bold flex items-center gap-1.5 hover:bg-[#DE2626] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>Copy Schema</span>
                    </button>
                    <button
                      onClick={handleDownloadActiveSchema}
                      className="px-4 py-1.5 bg-[#000000] hover:bg-[#DE2626] text-[#FFFFFF] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Save File</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#000000] p-3 bg-[#F9F9F9] flex justify-end">
              <button
                onClick={() => setIsAboutModalOpen(false)}
                className="bg-[#000000] text-[#FFFFFF] hover:bg-[#DE2626] px-5 py-1 text-xs font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
