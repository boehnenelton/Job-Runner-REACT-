/**
 * File:            /js/app.js
 * Description:     Complete standalone vanilla JavaScript mirror of JobMaker & Job Runner.
 *                  Resolves and imports libraries relatively from ../src/lib/lib_js/ with zero Node dependencies.
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Version:         3.1.7
 * Date:            2026-09-27
 */

import {
  extractTasksFromJobDoc,
  getActivePendingTask,
  commitTaskInJobDoc,
  computeUnifiedDiff,
  bejson_core_get_field_map,
} from "../src/lib/lib_js/lib_bejson_Runner_engine.js";

import {
  RUNNER_TEMPLATES,
  instantiateJobDocFromTemplate,
} from "../src/lib/lib_js/lib_bejson_Runner_templates.js";

import {
  createEmptyKeyStoreDoc,
  extractKeySlots,
  getNextRoundRobinKey,
  updateKeySlot,
  DEFAULT_MODEL,
} from "../src/lib/lib_js/lib_bejson_Runner_keys.js";

let currentEntryId = null;
let currentJobDoc = null;
let currentStageId = null;
let keyStoreDoc = createEmptyKeyStoreDoc();
let activeTab = "hub";
let currentPanelType = "context";
let attachedFilesList = [];

export async function initApp() {
  bindNavigation();
  await refreshRegistry();
  renderTemplates();
  renderKeySlots();
  renderAttachedFiles();
}

function bindNavigation() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-nav");
      switchSection(tab);
    });
  });

  const runBtn = document.getElementById("globalRunBtn");
  if (runBtn) {
    runBtn.addEventListener("click", runNextTask);
  }

  const aboutBtn = document.getElementById("aboutBtn");
  if (aboutBtn) {
    aboutBtn.addEventListener("click", () => {
      document.getElementById("aboutModal").hidden = false;
    });
  }

  const closeAboutBtn = document.getElementById("closeAboutBtn");
  if (closeAboutBtn) {
    closeAboutBtn.addEventListener("click", () => {
      document.getElementById("aboutModal").hidden = true;
    });
  }
}

function switchSection(name) {
  activeTab = name;
  document.querySelectorAll("[data-section]").forEach((sec) => {
    sec.style.display = sec.getAttribute("data-section") === name ? "block" : "none";
  });
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.classList.toggle("jm-sidebar__btn--active", btn.getAttribute("data-nav") === name);
  });
}

export function setPanelType(type) {
  currentPanelType = type;
  const expl = document.getElementById("panelExplanation");
  if (expl) {
    if (type === "context") {
      expl.innerHTML =
        "<strong>Read-Only Context Files:</strong> Ingested for AI to study and learn from. The AI will never replicate or overwrite these files.";
      expl.style.borderColor = "#000000";
    } else {
      expl.innerHTML =
        "<strong>Work Attachments:</strong> Target files for active job refactoring, editing, and execution.";
      expl.style.borderColor = "var(--red)";
    }
  }
  renderAttachedFiles();
}

export async function handleJsSingleFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const content = await file.text();
    attachedFilesList.push({
      id: "f-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      name: file.name,
      path: file.name,
      content,
      size: file.size,
      isChecked: true,
      type: currentPanelType,
    });
    setStatus(`Attached ${file.name} to ${currentPanelType}`);
    renderAttachedFiles();
  } catch (err) {
    setStatus("Failed reading file: " + err);
  }
  e.target.value = "";
}

export async function handleJsFolder(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  setStatus(`Reading ${files.length} files from folder...`);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.name.startsWith(".")) continue;
    try {
      const content = await file.text();
      attachedFilesList.push({
        id: "f-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
        name: file.name,
        path: file.webkitRelativePath || file.name,
        content,
        size: file.size,
        isChecked: true,
        type: currentPanelType,
      });
    } catch (_) {}
  }
  setStatus(`Imported folder files into ${currentPanelType}.`);
  renderAttachedFiles();
  e.target.value = "";
}

export async function handleJsZip(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!window.JSZip) {
    setStatus("JSZip library not available in browser.");
    return;
  }
  setStatus(`Extracting ZIP: ${file.name}...`);
  try {
    const zip = await window.JSZip.loadAsync(file);
    for (const [relPath, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir && !relPath.startsWith("__MACOSX/")) {
        try {
          const content = await zipEntry.async("string");
          attachedFilesList.push({
            id: "f-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
            name: relPath.split("/").pop() || relPath,
            path: relPath,
            content,
            size: content.length,
            isChecked: true,
            type: currentPanelType,
          });
        } catch (_) {}
      }
    }
    setStatus(`Extracted files from ${file.name}.`);
    renderAttachedFiles();
  } catch (err) {
    setStatus("ZIP error: " + err);
  }
  e.target.value = "";
}

function renderAttachedFiles() {
  const container = document.getElementById("jsFilesListContainer");
  if (!container) return;

  const filtered = attachedFilesList.filter((f) => f.type === currentPanelType);
  if (filtered.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:16px;color:#777;font-size:0.85rem;">No files attached in this category. Use buttons above to import.</div>';
    return;
  }

  container.innerHTML = filtered
    .map(
      (f) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid #EEE;">
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" ${f.isChecked ? "checked" : ""} onchange="window.toggleFileCheck('${f.id}')" style="cursor:pointer;" />
        <div>
          <div style="font-weight:700;font-size:0.82rem;">${escapeHtml(f.name)}</div>
          <div style="font-family:monospace;font-size:0.75rem;color:#666;">${escapeHtml(f.path)} (${(f.size / 1024).toFixed(1)} KB)</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="jm-btn" style="padding:4px 8px;font-size:0.75rem;" onclick="window.previewAttachedFile('${f.id}')">View</button>
        <button class="jm-btn" style="padding:4px 8px;font-size:0.75rem;color:var(--red);" onclick="window.deleteAttachedFile('${f.id}')">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

window.toggleFileCheck = function (id) {
  attachedFilesList = attachedFilesList.map((f) => (f.id === id ? { ...f, isChecked: !f.isChecked } : f));
  renderAttachedFiles();
};

window.deleteAttachedFile = function (id) {
  attachedFilesList = attachedFilesList.filter((f) => f.id !== id);
  renderAttachedFiles();
};

window.previewAttachedFile = function (id) {
  const file = attachedFilesList.find((f) => f.id === id);
  if (!file) return;
  document.getElementById("previewTitle").textContent = file.name + " (" + file.path + ")";
  document.getElementById("previewBody").textContent = file.content;
  document.getElementById("filePreviewModal").hidden = false;
};

export async function refreshRegistry() {
  try {
    const res = await fetch("/api/registry?type=schema");
    const data = await res.json();
    const picker = document.getElementById("hubPicker");
    if (!picker) return;

    picker.innerHTML = (data.entries || [])
      .map((e) => `<option value="${e.entry_id}">${escapeHtml(e.entry_name)} (${e.file_path})</option>`)
      .join("");

    if (data.entries && data.entries.length > 0 && !currentEntryId) {
      currentEntryId = data.entries[0].entry_id;
      loadJob(currentEntryId);
    }
  } catch (err) {
    setStatus("Failed to load registry: " + err);
  }
}

export async function loadSelectedJob() {
  const picker = document.getElementById("hubPicker");
  if (!picker || !picker.value) return;
  loadJob(picker.value);
}

export async function loadJob(entryId) {
  currentEntryId = entryId;
  setStatus(`Loading entry ${entryId}...`);
  try {
    const res = await fetch(`/api/entry/${entryId}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatus("Error: " + (data.error || "Failed to load job"));
      return;
    }

    currentJobDoc = data.raw_doc;
    document.getElementById("jobNameInput").value = data.entry_name;
    document.getElementById("targetFileInput").value = data.target_file || "Joob_Runner.py";
    document.getElementById("jobGoalText").value = data.goal || "";

    renderTaskList(data.tasks);
    setStatus(`Loaded job: ${data.entry_name}`);
    switchSection("editor");
  } catch (err) {
    setStatus("Error: " + err);
  }
}

function renderTaskList(tasks) {
  const container = document.getElementById("taskListContainer");
  if (!container) return;

  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#666;">No tasks in this job.</div>';
    return;
  }

  container.innerHTML = tasks
    .map((t) => {
      const icon = t.taskCompleted ? "✅" : "⏳";
      const failReason = t.auditFailReason
        ? `<div style="color:var(--red);font-size:0.75rem;margin-top:4px;">Audit Fail: ${escapeHtml(t.auditFailReason)}</div>`
        : "";

      return `
      <div class="jm-task-row">
        <span style="font-size:1.1rem;">${icon}</span>
        <div style="flex:1;">
          <strong>Step ${t.taskOrder}: ${escapeHtml(t.taskName)}</strong>
          <div style="font-size:0.82rem;color:#444;margin-top:2px;">${escapeHtml(t.taskDescription)}</div>
          ${failReason}
        </div>
      </div>
    `;
    })
    .join("");
}

export async function runNextTask() {
  if (!currentEntryId && !currentJobDoc) {
    setStatus("Select a job first.");
    return;
  }

  setStatus("Synthesizing code patch and evaluating gates...");
  const targetFile = document.getElementById("targetFileInput")?.value || "Joob_Runner.py";

  try {
    const res = await fetch("/api/run/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_id: currentEntryId,
        job_doc: currentJobDoc,
        target_file: targetFile,
        attached_files: attachedFilesList,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatus("Stage Error: " + (data.error || "Failed"));
      return;
    }

    if (data.all_completed) {
      setStatus("All tasks in this job completed!");
      return;
    }

    currentStageId = data.stage_id;
    document.getElementById("diffTaskInfo").textContent =
      `Step ${data.task_order}: ${data.task_name} -> ${data.target_file}`;
    document.getElementById("diffView").textContent = data.diff || "(No diff)";
    document.getElementById("diffModal").hidden = false;
    setStatus(`Stage ready for Step ${data.task_order}.`);
  } catch (err) {
    setStatus("Error: " + err);
  }
}

export async function commitDiff() {
  if (!currentStageId) return;
  try {
    const res = await fetch("/api/run/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: currentStageId }),
    });
    const data = await res.json();
    document.getElementById("diffModal").hidden = true;
    if (data.ok) {
      setStatus(`Committed Step ${data.task_order}.`);
      if (currentEntryId) loadJob(currentEntryId);
    } else {
      setStatus("Commit Error: " + data.error);
    }
  } catch (err) {
    setStatus("Commit Failed: " + err);
  }
}

export async function discardDiff() {
  if (!currentStageId) return;
  try {
    await fetch("/api/run/discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: currentStageId }),
    });
  } catch (_) {}
  document.getElementById("diffModal").hidden = true;
  setStatus("Discarded candidate stage.");
}

function renderTemplates() {
  const container = document.getElementById("templatesListContainer");
  if (!container) return;

  container.innerHTML = RUNNER_TEMPLATES.map((tmpl) => `
    <div style="border:1px solid #000;padding:14px;background:#FFF;margin-bottom:12px;">
      <div style="font-size:0.75rem;font-weight:700;color:var(--red);text-transform:uppercase;">${tmpl.category}</div>
      <h4 style="font-size:0.95rem;font-weight:800;margin:4px 0;">${escapeHtml(tmpl.templateName)}</h4>
      <p style="font-size:0.8rem;color:#555;margin-bottom:8px;">${escapeHtml(tmpl.description)}</p>
      <div style="font-size:0.75rem;font-family:monospace;margin-bottom:10px;">Steps: ${tmpl.tasks.length} | Target: ${tmpl.defaultTarget}</div>
      <button class="jm-btn jm-btn--red" onclick="window.useTemplate('${tmpl.templateId}')">Instantiate</button>
    </div>
  `).join("");
}

window.useTemplate = async function (templateId) {
  const tmpl = RUNNER_TEMPLATES.find((t) => t.templateId === templateId);
  if (!tmpl) return;
  setStatus(`Instantiating template ${tmpl.templateName}...`);
  try {
    const res = await fetch("/api/templates/instantiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: tmpl.templateId,
        job_name: tmpl.templateName,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      await refreshRegistry();
      loadJob(data.entry_id);
    }
  } catch (err) {
    setStatus("Template failed: " + err);
  }
};

function renderKeySlots() {
  const container = document.getElementById("keySlotsContainer");
  if (!container) return;
  const slots = extractKeySlots(keyStoreDoc);

  container.innerHTML = slots.slice(0, 10).map((s) => `
    <div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #DDD;">
      <span style="font-weight:700;font-size:0.8rem;width:100px;">${s.slotLabel}</span>
      <input type="password" value="${escapeHtml(s.apiKey)}" placeholder="API Key..." style="flex:1;"
        onchange="window.updateKey(${s.slotIndex}, this.value)" />
    </div>
  `).join("");
}

window.updateKey = function (slotIndex, val) {
  keyStoreDoc = updateKeySlot(keyStoreDoc, slotIndex, val);
  setStatus(`Updated Key Slot ${slotIndex}`);
};

let lastGeneratedJobDoc = null;
let lastGeneratedEntryId = null;

window.generateJobAI = async function() {
  const prompt = document.getElementById("genPromptInput").value;
  if (!prompt || !prompt.trim()) {
    setStatus("Error: Description prompt is required.");
    return;
  }

  const triggerBtn = document.getElementById("triggerGenBtn");
  triggerBtn.disabled = true;
  triggerBtn.textContent = "Generating & Validating BEJSON 104a...";
  setStatus("Generating Job using spreadsheet analogies...");

  const name = document.getElementById("genJobNameInput").value;
  const targetFile = document.getElementById("genTargetFileInput").value;
  const type = document.getElementById("genJobTypeSelect").value;
  const subtype = document.getElementById("genJobSubtypeSelect").value;
  const steps = parseInt(document.getElementById("genStepCountInput").value, 10) || 5;
  const model = document.getElementById("genModelSelect").value;

  const key = getNextRoundRobinKey(keyStoreDoc);

  try {
    const res = await fetch("/api/jobs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        job_name: name.trim() || undefined,
        target_file: targetFile.trim() || undefined,
        job_type: type,
        job_subtype: subtype,
        step_count: steps,
        api_key: key || undefined,
        model: model,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Generation validation failed.");
    }

    lastGeneratedJobDoc = data.job_doc;
    lastGeneratedEntryId = data.entry_id;

    // Render preview results
    document.getElementById("genResultBox").hidden = false;
    document.getElementById("genSummaryStats").textContent = 
      `Job Title: ${lastGeneratedJobDoc.Job_Name} | Target File: ${lastGeneratedJobDoc.Target_File} | Steps: ${lastGeneratedJobDoc.Values.length} | Attempts: ${data.attempts_count}`;

    // Render simple task sequence mapping
    const tasksHtml = (lastGeneratedJobDoc.Values || []).map((row) => {
      return `<div style="border-bottom:1px solid #EEE;padding:6px 0;">
        <strong>Step ${row[1]}: ${escapeHtml(row[2])}</strong>
        <p style="margin:2px 0;font-size:0.75rem;color:#444;">${escapeHtml(row[3])}</p>
      </div>`;
    }).join("");
    document.getElementById("genTasksTable").innerHTML = tasksHtml;

    // Render diagnostics
    document.getElementById("genDiagnosticsView").textContent = (data.diagnostics || []).join("\n\n") || "Validated on Attempt #1. No errors detected.";

    // Render raw json
    document.getElementById("genRawCodeView").textContent = JSON.stringify(lastGeneratedJobDoc, null, 2);

    setStatus("Successfully generated and validated job!");
  } catch (err) {
    setStatus("Generation failed: " + err.message);
  } finally {
    triggerBtn.disabled = false;
    triggerBtn.textContent = "Generate Job Document";
  }
};

window.loadGeneratedJobIntoActive = async function() {
  if (!lastGeneratedJobDoc) return;
  currentJobDoc = lastGeneratedJobDoc;
  currentEntryId = lastGeneratedEntryId;
  await refreshRegistry();
  loadJob(currentEntryId);
  switchSection("editor");
  setStatus("Loaded generated job into editor.");
};

function setStatus(msg) {
  const line = document.getElementById("statusLine");
  if (line) line.textContent = msg;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = String(s || "");
  return d.innerHTML;
}

// Global hooks for inline event handlers
window.loadSelectedJob = loadSelectedJob;
window.runNextTask = runNextTask;
window.commitDiff = commitDiff;
window.discardDiff = discardDiff;
window.setPanelType = setPanelType;
window.handleJsSingleFile = handleJsSingleFile;
window.handleJsFolder = handleJsFolder;
window.handleJsZip = handleJsZip;

document.addEventListener("DOMContentLoaded", initApp);
