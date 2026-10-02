<!--
Name: ui-notes.md
Description: Reusable interface and design guidelines extracted from project requirements
Version: 3.1.7
Date Created: 2026-09-27
Author: Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
RELATIONAL_ID: 28bc94a1-0294-4d82-b7e1-88941cfb2190
-->

# Reusable UI & Design Principles

## 1. Tri-Color Palette Discipline
- **Canvas / Background**: Pure White (`#FFFFFF`) or Pure Black (`#000000`).
- **Typography / Text**: Pure Black (`#000000`) or Pure White (`#FFFFFF`).
- **Active / Interactive Accent**: Vivid Red (`#DE2626`).
- **Strict Prohibition**: No black text on red backgrounds.
- **Button Standards**: White typography on `#DE2626` backgrounds for active, primary, or destructive approval actions; crisp hover state transitions.
- **Form Controls**: Pure white background (`#FFFFFF`) with pure black text (`#000000`) and standard crisp 1px borders.
- **Zero Ornamentation**: No visual clutter, decorative gradients, rounded pill excesses, or floating fluff.

## 2. Typography Rules
- **UI & Body Copy**: Inter (`font-sans`).
- **Code, Schema, Diffs, and Monospace Data**: Source Code Pro (`font-mono`).

## 3. Structural Layout & Anti-Monolithic Architecture
- **Persistent Header Toolbar**: Single-row horizontal scrollable toolbar for global actions, active job indicator, API state, and system mode.
- **Desktop Sidebar Navigation / Mobile Flyout**: Primary navigation tabs (Hub, Editor, Attachments & Context, Runner & Diff, Templates, Key Manager, About / Info).
- **Mobile Responsive Hamburger Direct Switch**: Mobile drawer features direct category switches between Read-Only Context Files and Work Attachments.
- **Horizontal Sub-Navigation**: Fixed top subtabs for sub-sections.
- **Section-Based Partitioning**: Avoid tall monolithic scrolls by partitioning workflow phases into distinct panes.

## 4. Dual Panel Architecture: Context vs Work Attachments
- **Radio Box Toggle**: Clean, unambiguous switching between Read-Only Context Files and Work Attachments.
- **Read-Only Context Files**: Ingested strictly for AI analysis, learning, and reference. Never replicated or overwritten.
- **Work Attachments**: Files targeted for direct job editing, refactoring, and code evolution.
- **Tri-Modal Ingestion**: Supports single file picker, directory / folder upload (`webkitdirectory`), and ZIP archive unpacker (`JSZip`).
- **Per-File Active Transmission Checkbox**:
  - Checked: included in prompt dispatch.
  - Unchecked: preserved locally and held on to without transmission.

## 5. AI Job Generation & Self-Healing Validation Loop
- **Workbook Spreadsheet Analogy**: System prompts are structured using Excel/Google Sheets workbook analogy (Identity, PascalCase custom headers, Header Row Fields, Data Rows Values with Record Length matching column size, Positional Integrity). This teaches the model the schema intuitively.
- **Structured Output Validation Loop**: The server executes strict Elton Boehnen Core BEJSON validators on the model's parsed JSON output.
- **Iterative Error Feedback Prompt Injection**: If a validation constraint fails (e.g. `RECORD_LENGTH_MISMATCH` or `INVALID_CUSTOM_KEY`), the exact errors are parsed, explained, and injected into the system prompt for automated, real-time retry correction up to 3 times before failing gracefully.
- **Direct Import Integration**: One-click direct loading from the generator preview panel into the active Editor and Runner sections.

## 6. Real-Time Action Auditing & Debug Console Architecture
- **Persistent Action Stream**: Every user action, stage evolution dispatch, candidate diff generation, atomic swap, template instantiation, key rotation, and network exception is intercepted and logged into an immutable chronological buffer (capped at 300 entries in `localStorage`).
- **Sidebar Diagnostic Badges**: The navigation sidebar dynamically monitors error records and displays vivid red notification pills (`[# ERR]`) alerting the developer to failures without requiring manual console opening.
- **One-Click Clipboard Debug Bundling**: A dedicated "Copy Full Debug Log" button serializes system environment variables, active model identifiers, target script paths, processing states, and full indented payloads into an easily shareable report.
- **Tri-Color Log Inspection Accordions**: Errors are highlighted in pure black boxes with vivid red borders, accompanied by collapsible accordions revealing complete stack traces, request bodies, and API responses.
- **100% Vanilla JS Mirror Parity**: Console logging, search filtering, level toggles, and copy functions are mirrored identically in `/js/index.html` and `/js/app.js` with zero external dependencies.

## 7. Multi-Page Website Blueprint & Navigation Link Integrity Standard
- **Master Template Precedence**: Multi-page website planning must always generate the master layout shell template first (header, brand mark, navigation link structure, responsive mobile flyout, persistent footer, and CSS styling tokens).
- **Derived Page Inheritance**: Derive all subsequent pages (Index/Landing, Feed/Catalog, Features, About, Contact) from the master layout template to preserve visual coherence and layout integrity.
- **Sequential Context Feeding**: Just as in sequential creative novel pipelines, each web page task inherits the master template and previous page code as recursive context so navigation links and tokens are strictly maintained.
- **Terminal Hyperlink Integrity Audit**: Conclude every multi-page website job with an automated audit step checking that every page contains the unified navigation bar, all relative links (`index.html`, `feed.html`, `features.html`, `about.html`, `contact.html`) resolve without dead ends, active page markers reflect the current route, and mobile responsive menus behave identically.
