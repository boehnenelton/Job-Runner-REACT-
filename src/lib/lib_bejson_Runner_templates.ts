/**
 * Library:         lib_bejson_Runner_templates.ts
 * Family:          Runner
 * Module Purpose:  Standard and extended production templates for autonomous code evolution and task workflows.
 * Architecture:    BEJSON 104a JobSchema factory with pre-configured audit gates, context slots, and task sequences.
 * Version:         3.1.6
 * Release_Version: 300
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   fa910248-18e4-4ab2-8509-6d6281a941bf
 */

import { BEJSONDocument } from "./lib_bejson_Core_bejson_types";

export interface JobTemplateDefinition {
  templateId: string;
  templateName: string;
  category: "Code Evolution" | "Library Architecture" | "Frontend & React" | "Testing & Audit" | "Creative Writing";
  description: string;
  jobType: string;
  jobSubtype: string;
  defaultGoal: string;
  defaultTarget: string;
  tasks: Array<{
    name: string;
    description: string;
    auditEnabled: boolean;
    mandatory: boolean;
    testCmd?: string;
  }>;
}

export const OFFICIAL_JOB_FIELDS = [
  { name: "task_id", type: "string" },
  { name: "task_order", type: "integer" },
  { name: "task_name", type: "string" },
  { name: "task_description", type: "string" },
  { name: "task_completed", type: "boolean" },
  { name: "audit_enabled", type: "boolean" },
  { name: "audit_passed", type: "boolean" },
  { name: "audit_fail_reason", type: "string" },
  { name: "task_context", type: "string" },
  { name: "task_reference", type: "string" },
  { name: "task_mandatory", type: "boolean" },
  { name: "test_cmd", type: "string" },
];

export const RUNNER_TEMPLATES: JobTemplateDefinition[] = [
  {
    templateId: "tmpl-python-refactor",
    templateName: "Python Script Refactor & Test Gate",
    category: "Code Evolution",
    description: "Multi-step autonomous Python script refactoring with AST verification and subprocess test commands.",
    jobType: "script",
    jobSubtype: "python",
    defaultGoal: "Refactor Python target module for performance, safety, and strict typing.",
    defaultTarget: "Joob_Runner.py",
    tasks: [
      {
        name: "Security & Path Containment Audit",
        description: "Audit file paths, command injection risks, and ensure resolved paths do not escape allowed root directories.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "python3 -m py_compile {SCRIPT}",
      },
      {
        name: "Refactor Execution Gates & AST Validation",
        description: "Modernize syntax verification, error propagation, and atomic write transactions.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "python3 -m py_compile {SCRIPT}",
      },
      {
        name: "Integration Test Verification",
        description: "Run automated self-tests to ensure backwards compatibility with legacy BEJSON records.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "python3 {SCRIPT} --self-test-run",
      },
    ],
  },
  {
    templateId: "tmpl-ts-library-mirror",
    templateName: "TypeScript Library Parity & JS Mirroring",
    category: "Library Architecture",
    description: "Create or synchronize 1:1 vanilla JavaScript library mirrors in src/lib/lib_js with zero Node dependencies.",
    jobType: "library",
    jobSubtype: "typescript_js_mirror",
    defaultGoal: "Produce compliant vanilla JavaScript mirror for newly authored TypeScript family library.",
    defaultTarget: "src/lib/lib_bejson_Runner_engine.ts",
    tasks: [
      {
        name: "Analyze TypeScript Export Surface",
        description: "Catalog all exported interfaces, functions, constants, and BEJSON field map caching helpers.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "npm run lint",
      },
      {
        name: "Synthesize Vanilla JavaScript Mirror",
        description: "Generate matching ES module mirror inside src/lib/lib_js without any node_modules dependencies.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "node --check src/lib/lib_js/lib_bejson_Runner_engine.js",
      },
      {
        name: "Browser Portability & Parity Verification",
        description: "Verify that the JS mirror executes cleanly in both Node.js and modern browser environments without bundling.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "node -e 'import(\"./src/lib/lib_js/lib_bejson_Runner_engine.js\")'",
      },
    ],
  },
  {
    templateId: "tmpl-react-component",
    templateName: "React Component Architecture & Spec",
    category: "Frontend & React",
    description: "Author production React components adhering to Tri-Color styling, Inter typography, and ledger documentation.",
    jobType: "ui",
    jobSubtype: "react_component",
    defaultGoal: "Scaffold and integrate high-fidelity React component with comprehensive slot specifications.",
    defaultTarget: "src/App.tsx",
    tasks: [
      {
        name: "Author Component Structure & Type Contracts",
        description: "Implement component container, props interface, and state hooks using Tri-Color palette (#FFFFFF, #000000, #DE2626).",
        auditEnabled: true,
        mandatory: true,
        testCmd: "npm run lint",
      },
      {
        name: "Attach Event Handlers & State Bindings",
        description: "Wire button click handlers, form inputs, copy actions, and download triggers with explicit error feedback.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "npm run lint",
      },
      {
        name: "Update Component Ledger (dev/ui-components.md)",
        description: "Document constituent slots, input controls, and handler mappings exhaustively in dev/ui-components.md.",
        auditEnabled: false,
        mandatory: true,
      },
    ],
  },
  {
    templateId: "tmpl-express-api",
    templateName: "Full-Stack Express API Endpoint & Schema",
    category: "Code Evolution",
    description: "Build robust Express backend routes with BEJSON parsing, status code handling, and CSRF protection.",
    jobType: "backend",
    jobSubtype: "express_route",
    defaultGoal: "Implement and verify backward compatible REST API endpoint in server.ts.",
    defaultTarget: "server.ts",
    tasks: [
      {
        name: "Define Route Handler & Request Validation",
        description: "Mount route under /api/, parse BEJSON document payload, and validate against mandatory schema keys.",
        auditEnabled: true,
        mandatory: true,
        testCmd: "npx tsx --eval 'console.log(\"syntax ok\")'",
      },
      {
        name: "Wire Atomic Storage & Error Envelope",
        description: "Implement atomic write transactions using temp files and return structured JSON responses.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "API Contract & Regression Test",
        description: "Execute automated verification query against endpoint to verify status codes and payload structure.",
        auditEnabled: true,
        mandatory: true,
      },
    ],
  },
  {
    templateId: "tmpl-unit-tests",
    templateName: "Unit Test Suite & Verification Matrix",
    category: "Testing & Audit",
    description: "Generate automated test assertions covering happy path, edge cases, error codes, and boundary conditions.",
    jobType: "test",
    jobSubtype: "unit_test_suite",
    defaultGoal: "Author unit test suite covering BEJSON field map caching, parser error codes, and diff algorithms.",
    defaultTarget: "src/test/runner_test.ts",
    tasks: [
      {
        name: "Define Test Fixtures & In-Memory Schemas",
        description: "Construct valid and malformed BEJSON 104a mock documents to test schema validator boundaries.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Implement Positive & Negative Assertions",
        description: "Assert expected return types, thrown error codes (E.INVALID_FORMAT_VERSION, etc.), and diff outputs.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Run Test Runner & Verify Pass Gate",
        description: "Execute the test runner and verify that all assertions pass cleanly with zero uncaught exceptions.",
        auditEnabled: true,
        mandatory: true,
      },
    ],
  },
  {
    templateId: "tmpl-bejson-migration",
    templateName: "BEJSON 104a Data Migration & Validation",
    category: "Library Architecture",
    description: "Transform legacy JSON documents into valid BEJSON 104a format with cached field maps.",
    jobType: "data",
    jobSubtype: "bejson_migration",
    defaultGoal: "Migrate legacy data payloads to strictly compliant BEJSON 104a documents.",
    defaultTarget: "data/migrated_job.bejson",
    tasks: [
      {
        name: "Schema Extraction & Field Definition",
        description: "Extract field names, infer primitive types (string, integer, number, boolean), and generate 104a header.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Positional Matrix Population",
        description: "Map raw object rows into ordered positional values arrays using field map caching.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Validate Document Against BEJSON 104a Specification",
        description: "Run validate104a() and assertValid() to confirm zero format violations or type collisions.",
        auditEnabled: true,
        mandatory: true,
      },
    ],
  },
  {
    templateId: "tmpl-audit-docs",
    templateName: "Documentation & Audit Ledger Generator",
    category: "Testing & Audit",
    description: "Compile and synchronize dev/ui-notes.md, dev/prompts.md, dev/ui-components.md, and bejson_project.json.",
    jobType: "documentation",
    jobSubtype: "audit_ledger",
    defaultGoal: "Audit and update all historical ledgers, change logs, and component specifications.",
    defaultTarget: "bejson_project.json",
    tasks: [
      {
        name: "Audit AI Prompts & System Directives",
        description: "Ensure all AI prompts and system instructions dispatched by the app are mirrored verbatim into dev/prompts.md.",
        auditEnabled: false,
        mandatory: true,
      },
      {
        name: "Audit Component Specs & Function Mappings",
        description: "Verify that dev/ui-components.md reflects all newly introduced slots, inputs, buttons, and state handlers.",
        auditEnabled: false,
        mandatory: true,
      },
      {
        name: "Append Timestamped Change Log Entry",
        description: "Increment package version in bejson_project.json and record change log entry with author attribution.",
        auditEnabled: true,
        mandatory: true,
      },
    ],
  },
  {
    templateId: "tmpl-creative-book",
    templateName: "Sequential Novel & Chapter Evolve Generator",
    category: "Creative Writing",
    description: "An evolutionary book-writing pipeline. Tasks are executed one step at a time, feeding the previous chapter's completed text and the full blueprint scope as a recursive learning context to generate the next chapter with seamless narrative flow.",
    jobType: "creative",
    jobSubtype: "novel",
    defaultGoal: "Synthesize a high-fidelity narrative novel manuscript. Each chapter is constructed sequentially while preserving narrative continuity, theme coherence, and character arcs by feeding the full outline and prior written chapter as reference material.",
    defaultTarget: "data/manuscript_draft.txt",
    tasks: [
      {
        name: "Narrative Exposition, Premise & Prologue",
        description: "Draft the introductory prologue. Introduce the main protagonist, core world-building principles, and set the mysterious thematic atmosphere. All subsequent chapters will build upon this foundation.",
        auditEnabled: false,
        mandatory: true,
      },
      {
        name: "Chapter 1: The Inciting Incident & Confrontation",
        description: "Evolve the narrative: generate Chapter 1. Introduce the unexpected conflict or call to action. Ensure character dialogue and emotional depth are consistent with the world established in the prologue.",
        auditEnabled: false,
        mandatory: true,
      },
      {
        name: "Chapter 2: Rising Action & Emotional Core Evolution",
        description: "Evolve the narrative: generate Chapter 2. Build tension and raise the stakes. The protagonist must face obstacles that expand on Chapter 1's incident while referencing the main goal.",
        auditEnabled: false,
        mandatory: true,
      },
      {
        name: "Chapter 3: The Climax & Confrontation Resolution",
        description: "Evolve the narrative: generate Chapter 3. Bring the conflict to its peak. Resolve the immediate tactical struggles while leaving space for narrative reflection in the epilogue.",
        auditEnabled: false,
        mandatory: true,
      },
      {
        name: "Epilogue & Narrative Theme Review",
        description: "Draft the final epilogue. Bring closure to the character arc, reflect on the thematic journey, and integrate a complete manuscript audit. Output the final aggregated narrative work.",
        auditEnabled: false,
        mandatory: true,
      },
    ],
  },
  {
    templateId: "tmpl-website-multipage",
    templateName: "Multi-Page Website Blueprint & Navigation Audit Pipeline",
    category: "Frontend & React",
    description: "An architectural website-building pipeline. Establishes the master layout & navigation template first, generates core pages (Index/Landing, Feed/Catalog, Features, About, Contact) derived from the master template to ensure visual coherence, and concludes with an automated Navigation & Cross-Page Hyperlink Integrity Audit verifying 100% route validity and responsive nav across all pages.",
    jobType: "website",
    jobSubtype: "multipage_html",
    defaultGoal: "Architect and generate a complete multi-page website. Construct the master shell layout & navigation template first. Derive subsequent pages from the master template to guarantee styling and brand consistency, concluding with a comprehensive navigation and cross-page hyperlink audit verifying that every page contains identical navigation links with zero dead ends.",
    defaultTarget: "website/index.html",
    tasks: [
      {
        name: "Master Shell Layout & Navigation Template",
        description: "Author the master layout template (header, navigation links for Home, Feed/Catalog, Features, About, Contact, responsive mobile drawer, branding, typography rules, color tokens, and persistent footer). This master template establishes the design system and navigation blueprint that every subsequent page inherits.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Home & Landing Showcase Page (index.html)",
        description: "Derive the primary Landing page off the master layout template. Include a compelling hero section, value proposition grid, primary call-to-actions, and active navigation state for 'Home'. Ensure all navigation links point cleanly to planned sibling pages.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Feed / Catalog / Content Grid Page (feed.html)",
        description: "Derive the dynamic Feed / Catalog page off the master layout template. Implement interactive content cards, category filter tabs, search input, and active navigation state for 'Feed'. Maintain identical header, footer, and navigation architecture.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Features & Deep-Dive Specifications Page (features.html)",
        description: "Derive the Features page off the master layout template. Present technical architecture grids, capability callouts, comparison matrix, and active navigation state for 'Features' with complete cross-page internal linking.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "About & Team Story Page (about.html)",
        description: "Derive the About page off the master layout template. Author the mission narrative, creator attribution (Elton Boehnen), core values, and active navigation state for 'About'.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Contact, Inquiries & Feedback Page (contact.html)",
        description: "Derive the Contact page off the master layout template. Implement structured form fields (Name, Email, Message), validation feedback, and active navigation state for 'Contact' with links back to all primary pages.",
        auditEnabled: true,
        mandatory: true,
      },
      {
        name: "Navigation & Cross-Page Hyperlink Integrity Audit",
        description: "Perform an exhaustive navigation integrity audit across all generated pages: verify every page contains the unified navigation bar, all relative links (index.html, feed.html, features.html, about.html, contact.html) resolve without dead ends, active page markers accurately reflect current route, and mobile responsive menus behave identically.",
        auditEnabled: true,
        mandatory: true,
      },
    ],
  },
];

/**
 * Creates a fresh BEJSON 104a Job document from a template definition.
 */
export function instantiateJobDocFromTemplate(
  template: JobTemplateDefinition,
  customGoal?: string,
  targetFile?: string
): BEJSONDocument {
  const now = new Date().toISOString().slice(0, 10);
  const rows: any[][] = template.tasks.map((t, idx) => {
    return [
      `task-${Date.now().toString(36)}-${idx + 1}`,
      idx + 1,
      t.name,
      t.description,
      false, // task_completed
      t.auditEnabled,
      false, // audit_passed
      "",    // audit_fail_reason
      "[]",  // task_context
      "[]",  // task_reference
      t.mandatory,
      t.testCmd || "",
    ];
  });

  return {
    Format: "BEJSON",
    Format_Version: "104a",
    Format_Creator: "Elton Boehnen",
    Records_Type: ["JobSchema"],
    Job_Goal: customGoal || template.defaultGoal,
    Job_Type: template.jobType,
    Job_Subtype: template.jobSubtype,
    Target_File: targetFile || template.defaultTarget,
    Contextualize_Plan: true,
    Contextualize_Last: true,
    Job_Complete: false,
    Creation_Date: now,
    Completion_Date: "",
    Fields: OFFICIAL_JOB_FIELDS,
    Values: rows,
    Execution_Traces: {},
  } as BEJSONDocument;
}
