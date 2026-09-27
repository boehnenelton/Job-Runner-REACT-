/**
 * Library:         index.ts
 * Family:          Core
 * Module Purpose:  Implements runtime functionality and logic for index.ts.
 * Architecture:    BEJSON 104db provides single-file multi-entity relational storage with positional null-padding, Record_Type_Parent discriminator headers, and plain-text LLM readability.
 * Version:         2.0.3
 * Release_Version: 300
 * Date:            2026-06-28
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   21215340-3605-4581-b05c-f2970f9b1892
 */

// Types & error classes
export * from "./lib_bejson_Core_bejson_types";

// Core operations (parse, serialize, record CRUD)
export * from "./lib_bejson_Core_bejson_core";
export * from "./lib_bejson_Core_bejson_field_map";

// BEJSON validators (104, 104a, 104db)
export {
  validateDocument,
  validate104,
  validate104a,
  validate104db,
  assertValid,
  isValid,
} from "./lib_bejson_Core_bejson_validators";

// MFDB validators
export {
  discoverRole,
  validateManifest,
  validateEntityFile,
  validateDatabase,
  decodeManifestRecords,
  decodeDatabaseMeta,
  isMfdb132Package,
  validateMfdb132Package,
  detectMfdbInChunk,
} from "./lib_bejson_Core_mfdb_validators";

// MFDB core
export {
  createManifest,
  registerEntity,
  unregisterEntity,
  syncRecordCount,
} from "./lib_bejson_Core_mfdb_core";

export type { EntityValidationOptions, DatabaseValidationOptions } from "./lib_bejson_Core_mfdb_validators";
export type { CreateManifestOptions as MFDBCreateManifestOptions } from "./lib_bejson_Core_mfdb_core";

// Schema management
export * from "./lib_bejson_Core_bejson_schema";
