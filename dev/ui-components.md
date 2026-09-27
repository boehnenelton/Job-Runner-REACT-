<!--
Name: ui-components.md
Description: Exhaustive granular specification ledger of all React components, constituent slots, controls, and function handlers
Version: 3.1.7
Date Created: 2026-09-27
Author: Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
RELATIONAL_ID: 41ca8192-3847-4921-93bb-27189a04cf28
-->

# UI Component Specification Ledger

## 1. `HeaderToolbar`
- **Location**: Pinned at the top of the viewport. Single-row horizontally scrollable toolbar.
- **Constituent Slots & Controls**:
  - `TitleBadge`: Displays "JobMaker" and version `v3.1.7 (317)`.
  - `ActiveJobBadge`: Displays currently loaded job name or "No Job Active".
  - `TargetFileIndicator`: Shows active target file (e.g., `Joob_Runner.py` or active script).
  - `NetworkStatusBadge`: Shows live API indicator ("Idle", "Sending...", "Awaiting response...", "Error").
  - `KeySlotIndicator`: Shows active key slot index (e.g., "Key Slot 1/20") and current model name.
  - `AttachedFilesCounter`: Shows active count of attached files transmitting vs total (`X/Y`).
  - `QuickRunAction`: High-priority quick trigger for "Run Next Task".
  - `AboutModalToggle`: Opens the required Three-Tab Meta-UI modal.

## 2. `NavigationSidebar`
- **Location**: Left sidebar on desktop (persistent), overlay drawer on mobile.
- **Constituent Slots & Controls**:
  - `NavTabButton (Hub)`: Switches view to Jobs & Registry Hub.
  - `NavTabButton (Editor)`: Switches view to BEJSON 104a Job Editor.
  - `NavTabButton (Attachments)`: Switches view to Attachments & Context Materials.
  - `MobileFastSwitch (Context)`: Mobile drawer direct switch to Read-Only Context Files.
  - `MobileFastSwitch (Work)`: Mobile drawer direct switch to Work Attachments.
  - `NavTabButton (Runner)`: Switches view to Runner Execution & Diff Review console.
  - `NavTabButton (Templates)`: Switches view to Job Templates Library.
  - `NavTabButton (KeyManager)`: Switches view to BEJSON Key Management & Rotation.

## 3. `AttachmentsSection` (Dual Panel: Context vs Work Attachments)
- **Location**: Main content panel when `Attachments` is active.
- **Constituent Slots & Controls**:
  - `RadioPanelSelector`: Radio buttons switching between:
    - `Context Files (Read-Only Study & Learning)`
    - `Work Attachments (Direct Task Editing & Refactoring)`
  - `CategoryExplanationBanner`: Dynamic banner stating explicit AI rules (Read-only study without replication vs active work editing).
  - `ImportActionToolbar`:
    - `ImportFileButton`: Hidden file input trigger for single text/code files.
    - `ImportFolderButton`: Hidden input (`webkitdirectory`) for folder ingestion.
    - `ImportZipButton`: Hidden input for `.zip` archive unpacker via `JSZip`.
  - `CategoryFilterControls`:
    - `TotalCounter`: Shows total loaded files in active category.
    - `CheckAllAction`: Sets all files in category to checked (`isChecked = true`).
    - `UncheckAllAction`: Sets all files in category to unchecked (`isChecked = false`).
    - `ClearCategoryAction`: Purges files in active category.
  - `AttachedFileRow`:
    - `SelectionCheckbox`: Checked sends file in prompt; unchecked holds on to file locally.
    - `TypeBadge`: `[READ-ONLY STUDY]` or `[WORK ATTACHMENT]`.
    - `FileInfo`: File name, relative path, formatted size in KB.
    - `StatusPill`: `SENDING OUT` or `HELD ON TO`.
    - `ViewButton`: Opens `FilePreviewModal` with content.
    - `DeleteButton`: Removes file from attached state.
- **Function & Handler Mapping**:
  - `handleImportSingleFile(e)`: Reads file via FileReader, assigns category, appends to `attachedFiles`.
  - `handleImportFolder(e)`: Iterates `FileList`, extracts relative path, appends each readable file.
  - `handleImportZip(e)`: Parses archive with `JSZip.loadAsync()`, extracts text files, appends to `attachedFiles`.
  - `handleToggleFileCheck(id)`: Toggles `isChecked` state for target file.
  - `handleDeleteAttachedFile(id)`: Removes file from `attachedFiles` array.
  - `handleToggleAllCategory(type, check)`: Mass-updates `isChecked` for all files in active category.
  - `handleClearCategory(type)`: Removes all files of specified category.

## 4. `FilePreviewModal`
- **Location**: Global modal triggered by `View` button on any attached file.
- **Constituent Slots & Controls**:
  - `PreviewTitle`: File name and relative path.
  - `TypeBadge`: Indicates Context or Work file.
  - `CodeContentDisplay`: Dark monospace container displaying raw text content.
  - `CloseButton`: Dismisses modal.

## 5. `GenerateJobSection`
- **Location**: Main content panel when `Generate Job` is active.
- **Constituent Slots & Controls**:
  - `SubNavTabBar`: Horizontal tabs switching between:
    - `Configure & Generate` (form input)
    - `Generated Job Preview` (shows visual sequence of generated tasks + raw JSON code)
    - `Validation & Error Loop` (shows diagnostics of self-healing retry iterations)
    - `Spreadsheet Analogy` (educational tutorial pane)
  - `RequirementForm`:
    - `PromptDescriptionTextarea`: Descriptive prompt outlining requirements.
    - `QuickPresetPromptGroup`: Set of quick preset buttons (Python Refactor, Vanilla JS, Express API) to auto-fill configurations.
    - `JobTitleInput`: Input field for suggested title of the synthesized job.
    - `TargetScriptInput`: Input field specifying path of script to mutate (default: `Joob_Runner.py`).
    - `JobTypeDropdown`: Select field (feature, refactor, script, ui, etc.).
    - `JobSubtypeDropdown`: Select field (typescript, python, react, bash, bejson_104a, etc.).
    - `StepCountInput`: Number input specifying targeted number of steps.
    - `ModelSelectorDropdown`: Select field for designated Gemini model.
  - `GenerateActionButton`: Large vivid red button triggering API synthesis.
  - `JobPreviewCard`: Contains summary stats, table mapping row positional indices (task_id, task_order, task_name, test_cmd, description, mandatory vs audit), and action buttons:
    - `LoadIntoEditorButton`: Imports generated document immediately as active workspace job.
    - `DownloadBEJSONButton`: Downloads document.
    - `CopyBEJSONButton`: Copies payload.
  - `DiagnosticsConsole`: Monochrome console displaying exact diagnostic traces, failed error codes, and corrective directions injected back into model system instructions.
- **Function & Handler Mapping**:
  - `handleGenerateJob()`: Dispatches request to `/api/jobs/generate` with round-robin key, captures parsed document and self-correcting error diagnostics.
  - `handleLoadGeneratedJobIntoEditor()`: Updates `activeJobDoc` state and sets `activeSection` to Editor.
  - `handleCopyGeneratedBEJSON()`: Writes formatted string to clipboard.
  - `handleDownloadGeneratedBEJSON()`: Saves serialized document as local `.bejson` download.

## 6. `HubSection`, `JobEditorSection`, `RunnerSection`, `TemplatesSection`, `KeyManagerSection`, `MetaUIModal`
- Maintain exhaustive specifications as documented in v3.1.6 ledger.
