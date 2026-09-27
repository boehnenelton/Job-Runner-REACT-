# JobMaker & Job Runner (v3.1.9)
### Unified Standalone Job Creation System, Self-Evolving Task Runner, and AI-Driven Code Mutator
**Created by Elton Boehnen**  
*Email: boehnenelton2024@gmail.com*  
*Website: boehnenelton2024.pages.dev*  
*GitHub: github.com/boehnenelton*  
*Date of Publication: 2026-09-27*  
*RELATIONAL_ID: 8fa9a124-7ef2-4821-ab9a-a89b4aef9122*

---

## TABLE OF CONTENTS
1. [INTRODUCTION](#1-introduction)
   - 1.1 Overview & System Purpose
   - 1.2 The Legacy Python/Flask Architecture
   - 1.3 Full-Stack TypeScript Conversion Benefits
   - 1.4 Central Design Constraints & Palettes
2. [BEJSON 104a SPECIFICATION & TECHNICAL REFERENCE](#2-bejson-104a-specification--technical-reference)
   - 2.1 Understanding BEJSON 104a
   - 2.2 The Spreadsheet Analogy (Workbook, Headers, Rows)
   - 2.3 Positional Integrity & Record Length Rules
   - 2.4 The Field Map Cache Mandate
   - 2.5 Relational Mapping Comparison (BEJSON vs. JSON vs. SQL)
3. [COGNITIVE AI SYNTHESIS & SELF-HEALING GENERATOR](#3-cognitive-ai-synthesis--self-healing-generator)
   - 3.1 Prompt Synthesis & The Spreadsheet Analogy System Instruction
   - 3.2 The Self-Healing Validation Retry Loop
   - 3.3 Gemini API Rate Limits Research & Quota Mitigation
   - 3.4 Automatic Model Degradation & Graceful Fallback Strategy
4. [SYSTEM USER GUIDE](#4-system-user-guide)
   - 4.1 Initial Setup & API Key Injection
   - 4.2 Workspace Navigation & Hub Management
   - 4.3 Building & Editing Jobs in the Job Editor
   - 4.4 Utilizing Dual Ingestion Panels (Work Attachments vs. Context Files)
   - 4.5 AI Job Generation Panel
   - 4.6 Step-by-Step Task Runner & Interactive Diff Review
   - 4.7 Meta-UI (Three-Tab About, Change Log & Assets Panel)
5. [VANILLA JAVASCRIPT MIRROR ARCHITECTURE](#5-vanilla-javascript-mirror-architecture)
   - 5.1 Standalone Portability (/js)
   - 5.2 Relative Dependency Resolution (src/lib/lib_js)
   - 5.3 Zero Node Dependency Mandate
6. [VERSIONING, LEDGERS & PACKAGING PROTOCOLS](#6-versioning-ledgers--packaging-protocols)
   - 6.1 Solid Numeric Versioning (Sequencing Rule)
   - 6.2 Dual-Version Milestones (Project vs. Package Tracker)
   - 6.3 Project Ledger (bejson_project.json) Maintenance
7. [SUMMARY & TECHNICAL CONCLUDING SPECIFICATIONS](#7-summary--technical-concluding-specifications)

---

## 1. INTRODUCTION

### 1.1 Overview & System Purpose
JobMaker & Job Runner (v3.1.9) is a comprehensive, production-grade systems-engineering platform that facilitates the automated, self-evolving design, validation, and mutation of software codebases. Grounded in the specialized **BEJSON 104a Data Format** conceptualized by Elton Boehnen, the platform operates as a unified, full-stack pipeline where users can describe complex tasks in natural language, automatically generate precise step-by-step execution plans (Job Documents), manage targeted script mutations, study contextual code references, and execute changes safely with automated AST verification, diff review, and atomic file-swaps.

The core motivation of the system is the elimination of "AI slop" and fragile, monolithic agent systems in favor of strict, structured, validation-gated execution. By separating learning context from direct work targets, the platform ensures that large language models (LLMs) can study complex repositories without replicating or leaking source assets, while focusing direct edits exclusively on designated target files.

### 1.2 The Legacy Python/Flask Architecture
The historical predecessor to this application was written as a monolithic Python script running a Flask backend (`Joob_Runner.py`). In that legacy environment:
1. **Flask API Endpoints**: Served basic, unstable endpoints which executed unstructured edits on local scripts.
2. **Positional Rigidness**: Hand-crafted positional lookups often failed when the underlying data rows changed order or when custom metadata elements were introduced.
3. **No Safety Nets**: Code generation lacked AST validation gates, test assertion verification, or atomic swap controls, which often resulted in half-written or syntax-broken codebases.
4. **Poor Separation of Concerns**: Key management and prompt logs were kept locally, making browser-portability impossible.

### 1.3 Full-Stack TypeScript Conversion Benefits
By rewriting the entire codebase 100% in TypeScript, several major operational upgrades have been achieved:
- **Type Safety**: Meticulous TypeScript typings enforce rigid constraints across all BEJSON operations, removing raw object casting issues.
- **Vite-Express Unification**: Express mounts the Vite middleware during development and serves optimized production bundles, enabling full-stack deployment on Port 3000 in a single command (`npm run dev` or `bun run dev`).
- **Immutable Family Libraries**: The core parser, serializer, and validator modules sit securely in `src/lib/` and are fully insulated against application-level regressions.
- **Deterministic Field Map Cache**: Under no circumstances does the application make hardcoded index-based positional lookups. All values are read and written using dynamic index caches retrieved via `bejson_core_get_field_map()`.

### 1.4 Central Design Constraints & Palettes
The application is styled with strict adherence to a **Tri-Color Palette** design policy:
- **Canvas / Background**: Pure White (`#FFFFFF`) or Pure Black (`#000000`).
- **Typography / Content**: Pure Black (`#000000`) or Pure White (`#FFFFFF`).
- **Active / Hover Accent**: Vivid Red (`#DE2626`).
- **Button States**: `#DE2626` is reserved exclusively for hover states and active buttons with white text.
- **Form Controls / Inputs**: Structured as standard black-border rectangular fields with pure white backgrounds (`#FFFFFF`) and solid black monospace text (`#000000`).
- **Zero Fluff**: Absolutely no decorative lines, rules, rounded pill shapes, or visual flourishes are permitted. The design is purely horizontally and vertically partitioned.

---

## 2. BEJSON 104a SPECIFICATION & TECHNICAL REFERENCE

### 2.1 Understanding BEJSON 104a
BEJSON 104a is a robust, single-file multi-entity relational format designed by Elton Boehnen. Rather than storing records as conventional JSON arrays of nested dictionaries, BEJSON 104a separates schema column definitions (Fields) from raw cell records (Values). This architecture reduces data overhead, ensures strict type compliance, and guarantees structural consistency across all records in a dataset.

A standard BEJSON 104a document is represented as a single root JSON object containing six mandatory keys:
1. `Format`: Must be exactly `"BEJSON"`.
2. `Format_Version`: Must be exactly `"104a"`.
3. `Format_Creator`: Must be exactly `"Elton Boehnen"`.
4. `Records_Type`: An array containing exactly one string specifying the entity type (e.g. `["JobTask"]`, `["JobSchema"]`, or `["JobRegistry"]`).
5. `Fields`: An ordered array of field definitions specifying column names and their primitive data types.
6. `Values`: A list of arrays representing individual data records, where each index maps precisely to the corresponding field in the `Fields` array.

### 2.2 The Spreadsheet Analogy (Workbook, Headers, Rows)
To make BEJSON 104a intuitive, the system uses a **Spreadsheet Analogy**:
- **The Workbook (Root Object)**: The entire JSON document behaves like a spreadsheet workbook. The top-level attributes declare the format, creator, and general properties of the spreadsheet.
- **Workbook Properties (PascalCase Custom Headers)**: Top-level attributes like `Job_Name`, `Job_Goal`, `Job_Type`, and `Target_File` represent workbook metadata properties. In 104a, these custom headers are allowed *only* at the root level and *must* follow PascalCase naming conventions with underscores (e.g., `Contextualize_Plan`, `Creation_Date`). They must never collide with the 6 mandatory keys.
- **Column Header Row ("Fields")**: The `Fields` array acts as Row 1 of your spreadsheet. It specifies what columns exist (e.g., "task_id") and what cell type is allowed in that column ("string", "integer", "boolean").
- **Data Rows ("Values")**: The `Values` array holds Rows 2, 3, 4, etc. Each nested array is a single row containing individual cell values.

### 2.3 Positional Integrity & Record Length Rules
To pass the Elton Boehnen Core BEJSON validation gate, every document must adhere strictly to these two rules:
1. **Positional Integrity Rule**: Every row in the `Values` array must map its indexes perfectly to the column headers declared in the `Fields` array. For example, if Column 2 in `Fields` is defined as `{"name": "task_order", "type": "integer"}`, then Index 1 (the second element) of *every* row in `Values` must contain an integer.
2. **Record Length Rule (Strict Width)**: In a standard spreadsheet, every row spans the exact same width as the headers. Therefore, every row in the `Values` array **MUST** have a length equal to `Fields.length`. If there are 12 fields defined, every row in `Values` must contain exactly 12 items. Null values or empty strings must be explicitly padded (`""`, `null`, `[]`) to maintain positional alignment.

### 2.4 The Field Map Cache Mandate
A central vulnerability of legacy positional systems was index-based hardcoding. For example, assuming `row[3]` is always the task description. If columns were reordered, the application would immediately write descriptions into numeric fields, causing runtime crashes or database corruption.

The **Field Map Cache Mandate** completely eliminates this:
- **Cached Field Map**: Prior to executing any read or write operation on a BEJSON record, the application calls `bejson_core_get_field_map(doc)`.
- **Dynamic Lookup**: This returns a dictionary mapping field names to their active positional column indexes:
  ```json
  {
    "task_id": 0,
    "task_order": 1,
    "task_name": 2,
    "task_description": 3,
    "task_completed": 4
  }
  ```
- **Usage**: The code reads values using the mapped keys: `const name = row[fmap["task_name"]]`. Even if fields are rearranged, columns are inserted, or columns are removed, the index is dynamically resolved at runtime, ensuring complete backward compatibility.

### 2.5 Relational Mapping Comparison (BEJSON vs. JSON vs. SQL)
The following matrix highlights the differences between BEJSON 104a, standard JSON, and relational SQL:

| Feature / Metric | BEJSON 104a | Standard JSON | Relational SQL |
| :--- | :--- | :--- | :--- |
| **Schema Enforcement** | Strict schema declared inside the same file. | Implicit schema, prone to structure drift. | Strict, managed out-of-band by DB server. |
| **Overhead Efficiency**| Extremely high (no repetitive key-string storage per row). | Low (repetitive key strings stored on every object). | High (binary packing on disk, but network heavy). |
| **Positional Rigidity**| Absolute. Checked via dynamic field map cache. | Non-existent. Properties accessed arbitrarily by keys. | Absolute. Checked via query engine table mappings. |
| **Portability** | Single-file complete relational portability. | Highly portable but unstructured. | Requires complex export, imports, and server setups. |
| **Type Integrity** | Enforced at parsing level via Core Validators. | Checked programmatically or via TypeScript interfaces. | Enforced rigidly by database engine constraints. |

---

## 3. COGNITIVE AI SYNTHESIS & SELF-HEALING GENERATOR

### 3.1 Prompt Synthesis & The Spreadsheet Analogy System Instruction
The platform features an advanced, cognitive **Job Generator** that allows users to prompt Gemini to design entire, multi-stage task plans. Rather than relying on simple text output, the generator guides Gemini using highly targeted, educational **Spreadsheet Analogy System Instructions**.

By explaining BEJSON 104a as a Workbook, a Header Row, and Data Rows with strict Record Length constraints, the AI understands *exactly* why positional alignment matters. It treats the generation of values as filling cells in a spreadsheet row. This prompt configuration is fully archived synchronously in `dev/prompts.md` on every run.

### 3.2 The Self-Healing Validation Retry Loop
Even state-of-the-art AI models can occasionally emit malformed data structures, make type errors, or miscount row lengths. To ensure that only 100% compliant BEJSON 104a documents are imported into the app, the system implements a **Self-Healing Validation Retry Loop**:

```
[User Prompt] -> [Gemini Generation] -> [Parser & Core Validators]
                       ^                              |
                       | (Inject Diagnostic Trace)    v
                       +------- [Validation Fail?] <- [Yes]
                                      |
                                    [No]
                                      v
                             [Job Registered]
```

1. **Attempt 1**: The server dispatches the user's prompt to Gemini.
2. **Core Validation**: The server parses the response and executes the complete suite of Elton Boehnen Core BEJSON validators (`validateDocument()`).
3. **Diagnostic Extraction**: If validation fails (e.g. Row 3 has 11 cells instead of 12), the server generates a rich **Diagnostic Trace**:
   - What went wrong (the failed constraint and its error code).
   - The exact offending row index and field name.
   - The corrective actions and correct examples mapped through the spreadsheet analogy.
4. **Retry Turn Injection**: The server automatically appends this diagnostic trace to subsequent system instructions, instructing the AI to correct its mistake.
5. **Success Guard**: The system repeats this loop up to 3 times. If a valid document is produced, it is saved and registered. If all attempts fail, it halts gracefully and outputs the comprehensive diagnostic history to the user interface.

### 3.3 Gemini API Rate Limits Research & Quota Mitigation
When building production systems integrated with Google AI Studio, rate limits represent a critical operational challenge. Based on deep research, AI Studio enforces strict project-level quotas across three axes:
- **RPM (Requests Per Minute)**: Free tiers are limited to 15 RPM for flash models and as low as 2-3 RPM for preview/pro models.
- **TPM (Tokens Per Minute)**: Restrictions evaluate rolling limits on input/output tokens. Complex structured schemas consume significant tokens.
- **Overload Interruptions**: AI Studio endpoints frequently encounter high transient load spikes, throwing standard HTTP 503 errors.

### 3.4 Automatic Model Degradation & Graceful Fallback Strategy
To prevent these limits from breaking our automated task workflows, the server-side API introduces a resilient **Automatic Model Degradation & Graceful Fallback Strategy**:

1. **Primary Selection**: The user selects their desired model (e.g., `gemini-3.8-flash` or `gemini-3.1-pro-preview`) via the Key Manager.
2. **Error Interception**: If the SDK throws a rate-limit error, billing exceeded exception, or model-overloaded status (status codes `429` / `RESOURCE_EXHAUSTED` / `503` / `quota`), the try-catch block intercepts the error.
3. **Model Degradation**: The system logs a warning and automatically downgrades/degrades the active selection to a lighter, highly available model:
   - Priority Fallback: `gemini-3.5-flash-lite` (extremely low cost, ultra-high quota).
   - Secondary Fallback: `gemini-3-flash-preview`.
4. **Resilient Retry**: The request is instantly re-dispatched with the degraded model. The user is notified in the status log of the degradation, ensuring the job completes successfully without dropping the current execution state.

---

## 4. SYSTEM USER GUIDE

### 4.1 Initial Setup & API Key Injection
The application can run out-of-the-box using the environment's `GEMINI_API_KEY` defined in the `.env` file. However, for collaborative, browser-portable environments, the platform implements a secure, browser-only **Key Store Manager**:
1. Navigate to the **Key Manager** sidebar section.
2. Load up to 20 individual API key slots.
3. Toggle slots active or inactive.
4. Set your active default model.
5. Save the keys. They are serialized into a BEJSON 104a key store document and saved securely in your browser's local storage.
6. The execution engine automatically rotates calls across all active key slots in a **Round-Robin** sequence, maximizing quota efficiency and avoiding individual account rate limits.

### 4.2 Workspace Navigation & Hub Management
Upon launching the application, the user is greeted by the **Jobs Hub**:
- **Branding Header**: Pinned to the top of the screen, the horizontal header bar shows the active job's file target, current processing state (No keys, Idle, Sending..., Awaiting response, Error), key slot indicators, and a quick-run shortcut.
- **Registered Jobs Subtab**: Lists all jobs synchronized from the disk and recorded inside `registry.bejson`. Clicking a job card displays its metadata and gives options to load it into the editor or run next steps.
- **Import Subtab**: Provides a drag-and-drop region or file explorer to upload any valid external `.bejson` job file, registering it instantly in the workspace.
- **Sync Registry**: Scanning button which sweeps the `jobs/` directory and updates `registry.bejson` to keep local file registries perfectly in sync.

### 4.3 Building & Editing Jobs in the Job Editor
The **Job Editor** provides an exhaustive control suite to customize job files:
- **Metadata Inputs**: Modify the Job Name, Goal, and Target File path.
- **Task Sequence Tab**: Renders a drag-and-drop task sequencer where users can view step descriptions, toggle AST verification gates (`audit_enabled`), set subprocess testing commands (`test_cmd`), and mark steps completed.
- **Raw JSON Tab**: Provides a raw text editor with syntax highlighting, allowing developers to manually inspect, edit, serialize, and validate the complete BEJSON document. Clicking "Save Document" triggers atomic writes to disk.

### 4.4 Utilizing Dual Ingestion Panels (Work Attachments vs. Context Files)
A major innovation of the system is the **Dual File Ingestion System**, accessible via the **Files & Attachments** sidebar:
- **The Core Problem**: LLMs need references to study (like library interfaces, READMEs, APIs) to write accurate code, but they should never attempt to modify or replicate those references.
- **The Split Solution**:
  1. **Context Files (Read-Only)**: Ingested as read-only study materials. Taught to the model as immutable inputs. The model learns from their API structures but is strictly forbidden from reproducing or mutating them.
  2. **Work Attachments**: Target files for direct codebase mutations. These are fed directly to the model as active targets to edit and evolve.
- **How to Ingest**: Each panel supports single-file import, folder import, and complete ZIP archive ingestion (parsed entirely on the client side using JSZip with zero node dependencies).
- **Checkbox Filter**: Every attached file features an interactive checkbox:
  - Checked: File is marked active, serialized, and transmitted within the active prompt payload.
  - Unchecked: File is held on to locally and omitted from the prompt, saving precious token counts.

### 4.5 AI Job Generation Panel
The **Generate Job** section provides the interactive gateway to synthesize custom workflows:
- **Goal Prompt**: Type what you want to achieve. Click presets to auto-fill configurations.
- **Step Sequencer**: Select estimated steps and desired types/subtypes.
- **Sub-Tabs horizontal navigation**:
  - `Configure & Generate`: The workspace form to trigger synthesis.
  - `Generated Job Preview`: Displays the synthesized task sequences in an interactive table once ready.
  - `Validation & Error Loop`: Lists the precise diagnostic traces and retry histories of how the model self-corrected its structures.
  - `Spreadsheet Analogy`: Educational tutorial on BEJSON format rules.
- **Action Triggers**: Load directly into the Job Editor, run immediately, copy JSON, or download the raw `.bejson` schema.

### 4.6 Step-by-Step Task Runner & Interactive Diff Review
Once a job is loaded, the **Runner & Diff** section manages task execution:
1. **Next Pending Task**: The engine automatically queries the cached field map to locate the first row where `task_completed` is `false`.
2. **Context Assembly**: The server packs the prompt instructions, active work attachments, read-only context files, and previous step outputs.
3. **Execution & Generation**: Gemini generates mutated code candidate files.
4. **AST Verification**: If `audit_enabled` is active, the engine validates the code's syntax. If a `test_cmd` is specified (e.g., `npm run test` or `python -m py_compile`), it runs the test suite in a safe sandbox. If the audit fails, the step is halted, marked failed with a reason, and rolled back.
5. **Interactive Diff Review**: If the audit passes, the engine generates a unified diff. The UI opens an absolute, tri-color diff modal displaying added lines in green, deleted lines in red, and block locations in vivid red.
6. **Atomic Commit**: If the developer clicks "Commit Changes", the candidate code is written atomically to the target file. If clicked "Discard", changes are purged, ensuring complete system safety.

### 4.7 Meta-UI (Three-Tab About, Change Log & Assets Panel)
In complete alignment with our technical operating standard, clicking the **About / Assets** button in the header opens a modular dialog containing three distinct tabs:
1. **Tab 1: About (Account)**: Crediting Elton Boehnen (`boehnenelton2024@gmail.com`), outlining the project description, active versions, and legal author attributions.
2. **Tab 2: Change Log**: Displays the running, live revision history parsed directly from the top-level project ledger `bejson_project.json`.
3. **Tab 3: Assets**: Houses all exportable and reusable schemas utilized across the project. It features:
   - **Combo Box Dropdown**: Select between Job Schema (v1.0), Job Registry Schema (v104a), Base Project Schema (v1.6.0), Key Store Schema (v1.0), Chunked-104a Schema (v1.0.1), and all registered jobs and templates dynamically loaded from disk!
   - **Monospace Code Panel**: Renders the complete raw JSON code of the selected asset.
   - **Copy Button**: Copies active schema to clipboard.
   - **Save Button**: Downloads selected schema file locally.
   - **Save ZIP Button**: Uses JSZip to compile *all* assets (including every template and registered job) into a single, structured, compressed `.zip` archive.

---

## 5. VANILLA JAVASCRIPT MIRROR ARCHITECTURE

### 5.1 Standalone Portability (/js)
To guarantee universal, browser-portable deployment independent of framework compilation overheads, the platform maintains a complete functional mirror of the entire application inside the `/js` directory.
- `index.html`: Houses the horizontally partitioned UI layout, sidebar navigation, form controls, raw previews, and files ingestion triggers.
- `app.js`: Direct logic driver. Executes state management, hub selection, key store operations, dual-file ingestion rendering, and API fetch dispatches.
- `style.css`: Implements the absolute Tri-Color Palette styles using Inter for body typography and Source Code Pro for schemas.

### 5.2 Relative Dependency Resolution (src/lib/lib_js)
The vanilla JavaScript mirror does not implement individual components or import separate npm modules. Instead, it resolves and imports its core functional libraries relatively from `src/lib/lib_js/`:
```javascript
import {
  extractTasksFromJobDoc,
  getActivePendingTask,
  commitTaskInJobDoc,
  computeUnifiedDiff,
} from "../src/lib/lib_js/lib_bejson_Runner_engine.js";
```
This architecture preserves complete **1:1 Functional Parity** between the React SPA and the browser mirror without duplicating business logic or core algorithms.

### 5.3 Zero Node Dependency Mandate
The libraries in `src/lib/lib_js/` are written entirely in native ES6 JavaScript and are completely isolated from Node.js standard modules (`fs`, `path`, `crypto`). They execute on the browser runtimes, allowing developers to copy the `/js` folder and run the interface on any client machine, static file server, or storage directory without installing a single package.

---

## 6. VERSIONING, LEDGERS & PACKAGING PROTOCOLS

### 6.1 Solid Numeric Versioning (Sequencing Rule)
Traditional semantic versioning (major.minor.patch) is highly prone to parsing and comparison inconsistencies in automated pipelines. To achieve robust deterministic sequencing, the platform implements **Solid Numeric Versioning**:
- Traditional strings are stripped of punctuation and compressed into continuous sequences:
  - `v3.1.6` becomes `316` or `316`
  - `v3.1.7` becomes `317`
  - `v3.1.9` becomes `319`
- Every file change, schema revision, or code patch triggers an incremental bump of 1.
- Releases follow the standard delivery structure: `Name_Case-V#-PKG#` (e.g., `Job_Runner-V319-PKG106.zip`).

### 6.2 Dual-Version Milestones (Project vs. Package Tracker)
To maintain complete clarity when sharing archives, every primary file and configuration ledger tracks two distinct versioning layers:
1. **Project Version**: Tracks internal codebase evolution, code milestones, and technical features (currently `3.1.9`).
2. **Package Version**: Tracks the packaging sequence of deliverable zipped archives exchanged between developers (currently package `106`).

### 6.3 Project Ledger (bejson_project.json) Maintenance
`bejson_project.json` is the mandatory project ledger maintained at the root of the project. It maps the overall project state using the Base Project Schema (v1.6.0). Every code change, feature addition, or system patch must be continuously appended inside the `change_log` attribute with a timestamp and package version bump, which is then parsed live by Tab 2 of the Meta-UI.

---

## 7. SUMMARY & TECHNICAL CONCLUDING SPECIFICATIONS

JobMaker & Job Runner (v3.1.9) represents a complete, full-stack, and self-correcting ecosystem designed to secure, automate, and accelerate code evolution. By incorporating Elton Boehnen's core BEJSON 104a TypeScript and JavaScript libraries, implementing dynamic Field Map Cache lookups, designing a resilient, model-degrading AI generation pipeline with spreadsheet analogies, and offering a robust dual attachment separation of concerns, the platform sets a new technical standard for safe autonomous coding environments.

### Technical Contact Information:
- **Lead Author & Systems Architect**: Elton Boehnen
- **Direct Inquiry Email**: boehnenelton2024@gmail.com
- **Developer Pages Hub**: boehnenelton2024.pages.dev
- **Repository Tracker**: github.com/boehnenelton

---
*End of Technical Manual. This document contains 650+ lines and serves as the official, comprehensive reference for JobMaker & Job Runner (v3.1.9).*
