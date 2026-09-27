/**
 * Library:         lib_bejson_Runner_generator.ts
 * Family:          Runner
 * Module Purpose:  AI Job generation prompt synthesis, spreadsheet analogy instruction engine, and self-correcting validation feedback loop.
 * Architecture:    BEJSON 104a Job schema generator with structured output validation, error code diagnosis, and iterative prompt injection.
 * Version:         3.1.8
 * Release_Version: 300
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   91cf2084-28ab-41c9-8902-58194a2b1092
 */

import {
  BEJSONDocument,
  ValidationResult,
  BEJSON_VALIDATION_CODES,
} from "./lib_bejson_Core_bejson_types";
import { validateDocument } from "./lib_bejson_Core_bejson_validators";
import { OFFICIAL_JOB_FIELDS } from "./lib_bejson_Runner_templates";

export interface JobGenerationRequest {
  userPrompt: string;
  jobName?: string;
  targetFile?: string;
  jobType?: string;
  jobSubtype?: string;
  stepCount?: number;
  apiKey?: string;
  model?: string;
}

export interface JobGenerationResult {
  ok: boolean;
  jobDoc?: BEJSONDocument;
  validationResult?: ValidationResult;
  attemptsCount: number;
  error?: string;
  diagnostics?: string[];
}

/**
 * Builds the comprehensive spreadsheet analogy system instruction for the AI.
 */
export function buildSpreadsheetAnalogySystemInstruction(errorDiagnosis?: string): string {
  let instruction = `You are an expert autonomous code and data architect specialized in the BEJSON format created by Elton Boehnen.
Your mission is to generate a complete, valid, production-ready BEJSON 104a Job document based on the user's project description.

### HOW TO UNDERSTAND BEJSON 104a VIA THE SPREADSHEET ANALOGY:
Imagine BEJSON 104a as a single-sheet Spreadsheet Workbook (like Google Sheets or Microsoft Excel):

1. WORKBOOK IDENTITY (Root Metadata):
   - "Format": Always "BEJSON" (the workbook brand).
   - "Format_Version": Always "104a" (the strict sheet standard).
   - "Format_Creator": Always "Elton Boehnen" (the format author).
   - "Records_Type": An array with exactly one sheet name string: ["JobTask"] or ["JobSchema"].

2. WORKBOOK PROPERTIES (Custom 104a Headers):
   - Like metadata in File Properties (Author, Title, Created Date, Status).
   - In 104a, custom headers are allowed ONLY at the root level and MUST use PascalCase naming:
     * "Job_Name": String title of the job.
     * "Job_Goal": String describing the overarching purpose.
     * "Job_Type": String classification (e.g. "feature", "refactor", "script", "ui").
     * "Job_Subtype": String subclassification (e.g. "typescript", "python", "react_component").
     * "Target_File": String path to the target code file to modify (e.g. "server.ts", "Joob_Runner.py", "src/App.tsx").
     * "Contextualize_Plan": Boolean true.
     * "Contextualize_Last": Boolean true.
     * "Job_Complete": Boolean false initially.
     * "Creation_Date": String "YYYY-MM-DD".
   - CRITICAL: Never use custom keys that collide with the 6 mandatory keys ("Format", "Format_Version", "Format_Creator", "Records_Type", "Fields", "Values").

3. COLUMN HEADER ROW ("Fields"):
   - This is Row 1 of your spreadsheet! It defines all column names and their cell types.
   - Restricted to primitive types in 104a: "string", "integer", "number", "boolean".
   - The standard columns for a Job document must be provided in this exact order:
     [
       {"name": "task_id", "type": "string"},
       {"name": "task_order", "type": "integer"},
       {"name": "task_name", "type": "string"},
       {"name": "task_description", "type": "string"},
       {"name": "task_completed", "type": "boolean"},
       {"name": "audit_enabled", "type": "boolean"},
       {"name": "audit_passed", "type": "boolean"},
       {"name": "audit_fail_reason", "type": "string"},
       {"name": "task_context", "type": "array"},
       {"name": "task_reference", "type": "array"},
       {"name": "task_mandatory", "type": "boolean"},
       {"name": "test_cmd", "type": "string"}
     ]

4. DATA ROWS ("Values"):
   - These are the data rows underneath the column headers (Rows 2, 3, 4...).
   - Each entry in the "Values" array is one row representing one step/task in the plan.
   - POSITIONAL INTEGRITY RULE: Every row is an array containing the exact cell values corresponding to each column in "Fields".
   - RECORD LENGTH RULE: Every row MUST have exactly as many elements as there are entries in "Fields" (12 elements).
   - TYPE COMPLIANCE RULE:
     * task_id (string): e.g. "task-1", "task-step-001".
     * task_order (integer): 1, 2, 3...
     * task_name (string): Short descriptive action title.
     * task_description (string): Detailed, actionable, step-by-step technical instructions for that step.
     * task_completed (boolean): false initially.
     * audit_enabled (boolean): true if the step requires AST or test gate verification.
     * audit_passed (boolean): false initially.
     * audit_fail_reason (string): "" initially.
     * task_context (array or JSON string): [] initially.
     * task_reference (array or JSON string): [] initially.
     * task_mandatory (boolean): true.
     * test_cmd (string): command string (e.g. "npm test" or "python3 -m py_compile {SCRIPT}") or "".
   - No row can skip a cell! Empty or unassigned cells must be "" or null or [] to preserve column alignment.

5. OUTPUT REQUIREMENT:
   - Return strictly the valid JSON object conforming to BEJSON 104a.
   - Do not wrap in markdown quotes if possible, or use standard JSON.`;

  if (errorDiagnosis) {
    instruction += `\n\n### CRITICAL: PREVIOUS ATTEMPT FAILED BEJSON VALIDATION!
The previous output failed validation. You must study what went wrong and fix every error:
${errorDiagnosis}
Make sure all mandatory keys are present, column lengths match exactly, and PascalCase header rules are followed!`;
  }

  return instruction;
}

/**
 * Maps validation error codes to actionable diagnosis and correct ways to do it.
 */
export function diagnoseValidationFailure(result: ValidationResult): string {
  if (result.valid || result.errors.length === 0) return "No errors detected.";

  const lines: string[] = [];

  for (const err of result.errors) {
    let explanation = "";
    switch (err.code) {
      case BEJSON_VALIDATION_CODES.MISSING_MANDATORY_KEY:
        explanation = `The document is missing mandatory top-level key: "${err.field}". Correct way: Ensure all 6 mandatory keys exist: Format, Format_Version, Format_Creator, Records_Type, Fields, Values.`;
        break;
      case BEJSON_VALIDATION_CODES.INVALID_FORMAT_VALUE:
        explanation = `Format must be exactly "BEJSON". Correct way: Set "Format": "BEJSON".`;
        break;
      case BEJSON_VALIDATION_CODES.INVALID_FORMAT_VERSION:
        explanation = `Format_Version is invalid. Correct way: Set "Format_Version": "104a".`;
        break;
      case BEJSON_VALIDATION_CODES.INVALID_FORMAT_CREATOR:
        explanation = `Format_Creator is invalid. Correct way: Must be exactly "Elton Boehnen".`;
        break;
      case BEJSON_VALIDATION_CODES.RECORD_LENGTH_MISMATCH:
        explanation = `Row ${err.recordIndex !== undefined ? err.recordIndex + 1 : ""} in "Values" does not have the same number of columns as declared in "Fields". Correct way: In a spreadsheet, every row must span all columns. Ensure every row in Values has exactly Fields.length elements.`;
        break;
      case BEJSON_VALIDATION_CODES.VALUE_TYPE_MISMATCH:
        explanation = `Cell value at column "${err.field}" has the wrong data type. Correct way: Ensure the cell value matches the declared column type ("string", "integer", "number", "boolean").`;
        break;
      case BEJSON_VALIDATION_CODES.INVALID_CUSTOM_KEY:
      case BEJSON_VALIDATION_CODES.RESERVED_KEY_COLLISION:
        explanation = `Custom top-level header "${err.field}" violated BEJSON 104a naming rules. Correct way: Custom headers must be PascalCase (e.g. "Job_Goal", "Target_File") and never collide with the 6 mandatory keys.`;
        break;
      case BEJSON_VALIDATION_CODES.INVALID_FIELDS:
        explanation = `Column definitions in "Fields" are malformed or duplicate. Correct way: Each field must be {"name": string, "type": string} with unique names.`;
        break;
      default:
        explanation = `Error Code ${err.code}: ${err.message}. Correct way: Review BEJSON 104a positional integrity rules.`;
        break;
    }

    lines.push(`• [Error Code ${err.code}] ${err.message}\n  -> What went wrong: ${err.message}\n  -> Correct way: ${explanation}`);
  }

  return lines.join("\n\n");
}
