/**
 * Library:         lib_bejson_Core_mfdb_validators.ts
 * Family:          Core
 * Module Purpose:  Implements runtime functionality and logic for lib_bejson_Core_mfdb_validators.ts.
 * Architecture:    MFDB provides multi-file database federation coordinating a 104a central manifest (104a.mfdb.bejson) with dense 104 entity tables, supporting atomic transaction locks and cross-disk relational foreign keys.
 * Version:         2.1.0
 * Release_Version: 300
 * Date:            2026-07-13
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   4f430045-e128-4f5a-bdd5-98cc97a6d08e
 */

import {
  BEJSONDocument,
  BEJSONValue,
  MFDBManifestRecord,
  MFDBDatabaseMeta,
  MFDBFileRole,
  ValidationResult,
  MFDBValidationError,
  MFDB_VALIDATION_CODES as E,
  MFDB_CORE_CODES,
} from "./lib_bejson_Core_bejson_types";
import { validateDocument as validateBEJSON } from "./lib_bejson_Core_bejson_validators";
import { _emitError, _emitWarning, _makeResult } from "./lib_bejson_Core_bejson_validators";

export function discoverRole(doc: unknown, filename: string): MFDBFileRole {
  if (doc === null || doc === undefined || typeof doc !== "object" || Array.isArray(doc)) {
    return "standalone";
  }
  const d = doc as BEJSONDocument;
  if (d.Format_Version === "104a" && filename.endsWith(".mfdb.bejson")) {
    return "manifest";
  }
  if (d.Format_Version === "104" && "Parent_Hierarchy" in d) {
    return "entity";
  }
  return "standalone";
}

export function validateManifest(
  doc: unknown,
  options: {
    resolvedPaths?: Set<string>;
  } = {}
): ValidationResult {
  const r = _makeResult();

  const bejsonResult = validateBEJSON(doc);
  if (!bejsonResult.valid) {
    for (const e of bejsonResult.errors) {
      _emitError(r, e.code, "[BEJSON] " + e.message, e.field, e.recordIndex);
    }
    return r;
  }

  const manifest = doc as BEJSONDocument;

  if (manifest.Format_Version !== "104a") {
    _emitError(r, E.NOT_A_MANIFEST, "Manifest must be Format_Version \"104a\", got \"" + manifest.Format_Version + "\".");
    return r;
  }

  if (
    !Array.isArray(manifest.Records_Type) ||
    manifest.Records_Type.length !== 1 ||
    manifest.Records_Type[0] !== "mfdb"
  ) {
    _emitError(r, E.MANIFEST_RECORDS_TYPE_INVALID, "Manifest Records_Type must be exactly [\"mfdb\"].", "Records_Type");
  }

  if (typeof manifest["MFDB_Version"] !== "string" || (manifest["MFDB_Version"] as string).trim() === "") {
    _emitError(r, MFDB_CORE_CODES.INVALID_MFDB_VERSION,
      "Manifest is missing required header MFDB_Version.", "MFDB_Version");
  }
  if (typeof manifest["DB_Name"] !== "string" || (manifest["DB_Name"] as string).trim() === "") {
    _emitError(r, MFDB_CORE_CODES.MISSING_DB_NAME,
      "Manifest is missing required header DB_Name.", "DB_Name");
  }

  const fieldNames = manifest.Fields.map((f) => f.name);
  if (!fieldNames.includes("entity_name")) {
    _emitError(r, E.MISSING_REQUIRED_MANIFEST_FIELD, "Manifest Fields must include \"entity_name\".", "entity_name");
  }
  if (!fieldNames.includes("file_path")) {
    _emitError(r, E.MISSING_REQUIRED_MANIFEST_FIELD, "Manifest Fields must include \"file_path\".", "file_path");
  }

  if (!r.valid) return r;

  const enIdx = fieldNames.indexOf("entity_name");
  const fpIdx = fieldNames.indexOf("file_path");

  const seenNames = new Set<string>();
  const seenPaths = new Set<string>();

  for (let i = 0; i < manifest.Values.length; i++) {
    const row = manifest.Values[i];

    const entityName = row[enIdx];
    const filePath = row[fpIdx];

    if (entityName === null) {
      _emitError(r, E.NULL_IN_REQUIRED_MANIFEST_FIELD,
        "Values[" + i + "].entity_name must not be null.", "entity_name", i);
    }
    if (filePath === null) {
      _emitError(r, E.NULL_IN_REQUIRED_MANIFEST_FIELD,
        "Values[" + i + "].file_path must not be null.", "file_path", i);
    }

    if (typeof entityName === "string") {
      if (seenNames.has(entityName)) {
        _emitError(r, E.DUPLICATE_ENTRY,
          "Duplicate entity_name: \"" + entityName + "\".", "entity_name", i);
      } else {
        seenNames.add(entityName);
      }
    }
    if (typeof filePath === "string") {
      if (seenPaths.has(filePath)) {
        _emitError(r, E.DUPLICATE_ENTRY,
          "Duplicate file_path: \"" + filePath + "\".", "file_path", i);
      } else {
        seenPaths.add(filePath);
      }

      if (options.resolvedPaths && !options.resolvedPaths.has(filePath)) {
        _emitError(r, E.ENTITY_FILE_NOT_FOUND,
          "file_path \"" + filePath + "\" does not exist on disk.", "file_path", i);
      }
    }
  }

  return r;
}

export interface EntityValidationOptions {
  expectedEntityName: string;
  expectedParentHierarchy?: string;
  manifestRelativePath?: string;
  entityRelativePath?: string;
}

export function validateEntityFile(
  doc: unknown,
  options: EntityValidationOptions
): ValidationResult {
  const r = _makeResult();

  const bejsonResult = validateBEJSON(doc);
  if (!bejsonResult.valid) {
    for (const e of bejsonResult.errors) {
      _emitError(r, e.code, "[BEJSON] " + e.message, e.field, e.recordIndex);
    }
    return r;
  }

  const entity = doc as BEJSONDocument;

  if (entity.Format_Version !== "104") {
    _emitError(r, E.NOT_AN_ENTITY, "Entity file must be Format_Version \"104\", got \"" + entity.Format_Version + "\".");
    return r;
  }

  if (!("Parent_Hierarchy" in entity) || entity.Parent_Hierarchy === undefined || entity.Parent_Hierarchy === null) {
    _emitError(r, E.MISSING_PARENT_HIERARCHY, "Entity file must contain Parent_Hierarchy key.", "Parent_Hierarchy");
  } else if (typeof entity.Parent_Hierarchy !== "string" || entity.Parent_Hierarchy.trim() === "") {
    _emitError(r, E.MISSING_PARENT_HIERARCHY, "Parent_Hierarchy must be a non-empty string.", "Parent_Hierarchy");
  }

  if (!Array.isArray(entity.Records_Type) || entity.Records_Type.length !== 1) {
    _emitError(r, E.NOT_AN_ENTITY, "Entity file Records_Type must contain exactly one entry.", "Records_Type");
    return r;
  }

  const actualName = entity.Records_Type[0];
  if (actualName !== options.expectedEntityName) {
    _emitError(r, E.ENTITY_NAME_MISMATCH,
      "Entity file Records_Type[0] is \"" + actualName + "\" but manifest expects \"" + options.expectedEntityName + "\".",
      "Records_Type");
  }

  if (
    options.expectedParentHierarchy !== undefined &&
    typeof entity.Parent_Hierarchy === "string" &&
    entity.Parent_Hierarchy !== options.expectedParentHierarchy
  ) {
    _emitError(r, E.MANIFEST_FILE_NOT_FOUND,
      "Parent_Hierarchy \"" + entity.Parent_Hierarchy + "\" does not match expected \"" + options.expectedParentHierarchy + "\".",
      "Parent_Hierarchy");
  }

  if (options.entityRelativePath !== undefined && options.manifestRelativePath !== undefined) {
    if (typeof entity.Parent_Hierarchy === "string") {
      _emitWarning(r, E.BIDIRECTIONAL_PATH_FAILED,
        "Bidirectional path check: verify that \"" + options.entityRelativePath +
        "\" + Parent_Hierarchy \"" + entity.Parent_Hierarchy +
        "\" resolves to manifest at \"" + options.manifestRelativePath + "\".",
        "Parent_Hierarchy");
    }
  }

  if (typeof entity.Parent_Hierarchy === "string") {
    if (entity.Parent_Hierarchy.includes("..") && _escapesRoot(entity.Parent_Hierarchy)) {
      _emitError(r, E.MISSING_PARENT_HIERARCHY,
        "Parent_Hierarchy must not escape the database root directory.", "Parent_Hierarchy");
    }
  }

  return r;
}

export interface DatabaseValidationOptions {
  strict?: boolean;
  resolvedPaths?: Set<string>;
}

export function validateDatabase(
  manifest: unknown,
  entityDocs?: Map<string, unknown>,
  options: DatabaseValidationOptions = {}
): ValidationResult {
  const r = _makeResult();

  const l1 = validateManifest(manifest, { resolvedPaths: options.resolvedPaths });
  for (const e of l1.errors) _emitError(r, e.code, "[L1] " + e.message, e.field, e.recordIndex);
  for (const w of l1.warnings) _emitWarning(r, w.code, "[L1] " + w.message, w.field, w.recordIndex);
  if (!r.valid) return r;

  const manifestDoc = manifest as BEJSONDocument;
  const records = decodeManifestRecords(manifestDoc);

  if (entityDocs) {
    for (const record of records) {
      const entityDoc = entityDocs.get(record.file_path);
      if (!entityDoc) {
        _emitError(r, E.ENTITY_FILE_NOT_FOUND,
          "[L2] Entity document not provided for file_path \"" + record.file_path + "\".", "file_path");
        continue;
      }

      const l2 = validateEntityFile(entityDoc, {
        expectedEntityName: record.entity_name,
        entityRelativePath: record.file_path,
      });
      for (const e of l2.errors) _emitError(r, e.code, "[L2:" + record.entity_name + "] " + e.message, e.field, e.recordIndex);
      for (const w of l2.warnings) _emitWarning(r, w.code, "[L2:" + record.entity_name + "] " + w.message, w.field, w.recordIndex);
    }

    _checkRecordCounts(manifestDoc, records, entityDocs, r);
    _checkFKResolution(records, entityDocs, options.strict === true, r);
  }

  return r;
}

export function decodeManifestRecords(manifest: BEJSONDocument): MFDBManifestRecord[] {
  const fieldNames = manifest.Fields.map((f) => f.name);
  return manifest.Values.map((row) => {
    const obj: Record<string, BEJSONValue> = {};
    for (let i = 0; i < fieldNames.length; i++) {
      obj[fieldNames[i]] = row[i];
    }
    return {
      entity_name: obj["entity_name"] as string,
      file_path: obj["file_path"] as string,
      description: (obj["description"] as string | null) ?? null,
      record_count: (obj["record_count"] as number | null) ?? null,
      schema_version: (obj["schema_version"] as string | null) ?? null,
      primary_key: (obj["primary_key"] as string | null) ?? null,
    } as MFDBManifestRecord;
  });
}

export function decodeDatabaseMeta(manifest: BEJSONDocument): MFDBDatabaseMeta {
  return {
    mfdb_version: (manifest["MFDB_Version"] as string) ?? "",
    db_name: (manifest["DB_Name"] as string) ?? "",
    db_description: (manifest["DB_Description"] as string) ?? undefined,
    schema_version: (manifest["Schema_Version"] as string) ?? undefined,
    author: (manifest["Author"] as string) ?? undefined,
    created_at: (manifest["Created_At"] as string) ?? undefined,
  };
}

function _checkRecordCounts(
  manifestDoc: BEJSONDocument,
  records: MFDBManifestRecord[],
  entityDocs: Map<string, unknown>,
  r: ValidationResult
): void {
  const rcIdx = manifestDoc.Fields.findIndex((f) => f.name === "record_count");
  if (rcIdx === -1) return;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.record_count === null) continue;

    const entityDoc = entityDocs.get(record.file_path) as BEJSONDocument | undefined;
    if (!entityDoc) continue;

    const actualCount = entityDoc.Values.length;
    if (actualCount !== record.record_count) {
      _emitWarning(r, 0,
        "[L3] record_count mismatch for \"" + record.entity_name + "\": manifest says " +
        record.record_count + ", file has " + actualCount + " rows.",
        "record_count", i);
    }
  }
}

function _checkFKResolution(
  records: MFDBManifestRecord[],
  entityDocs: Map<string, unknown>,
  strict: boolean,
  r: ValidationResult
): void {
  const pkMap = new Map<string, string>();
  for (const rec of records) {
    if (rec.primary_key) {
      pkMap.set(rec.primary_key, rec.entity_name);
    }
  }

  for (const rec of records) {
    const entityDoc = entityDocs.get(rec.file_path) as BEJSONDocument | undefined;
    if (!entityDoc) continue;

    for (const field of entityDoc.Fields) {
      if (!field.name.endsWith("_fk")) continue;

      const expectedPK = field.name.slice(0, -3);
      if (!pkMap.has(expectedPK)) {
        const msg = "[L3] FK field \"" + field.name + "\" in entity \"" + rec.entity_name +
          "\" cannot resolve to any manifest primary_key \"" + expectedPK + "\".";
        if (strict) {
          _emitError(r, E.FK_UNRESOLVED, msg, field.name);
        } else {
          _emitWarning(r, E.FK_UNRESOLVED, msg, field.name);
        }
      }
    }
  }
}

function _escapesRoot(relPath: string): boolean {
  const parts = relPath.replace(/\\/g, "/").split("/");
  let depth = 0;
  for (const part of parts) {
    if (part === "..") {
      depth--;
      if (depth < 0) return true;
    } else if (part !== "." && part !== "") {
      depth++;
    }
  }
  return false;
}

const MFDB_MANIFEST_FILENAME = "104a.mfdb.bejson";

interface MfdbFieldDef {
  name: string;
  type: string;
}

interface MfdbChunkedDoc {
  Format_Version?: string;
  Schema_Name?: string;
  Package_Format?: string;
  MFDB_Version?: string;
  DB_Name?: string;
  Records_Type?: string[];
  Fields?: MfdbFieldDef[];
  Values?: any[][];
  [key: string]: any;
}

export interface MfdbPackageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MfdbEntityCheck {
  entity_name: string;
  file_path: string;
  found_in_chunk: boolean;
  valid: boolean;
  errors: string[];
}

export interface MfdbInChunkDetection {
  mfdb_detected: boolean;
  valid: boolean;
  db_name: string | null;
  mfdb_version: string | null;
  entities: MfdbEntityCheck[];
  errors: string[];
  warnings: string[];
}

export function isMfdb132Package(doc: MfdbChunkedDoc): boolean {
  return (
    doc.Format_Version === "104a" &&
    doc.Schema_Name === "MFDB-132" &&
    doc.Package_Format === "MFDB-Chunked-104a" &&
    !!doc.MFDB_Version &&
    !!doc.DB_Name
  );
}

export function validateMfdb132Package(doc: MfdbChunkedDoc): MfdbPackageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isMfdb132Package(doc)) {
    errors.push(
      "Document is not a recognized MFDB-132 package (missing/incorrect " +
        "Schema_Name/Package_Format/MFDB_Version/DB_Name)."
    );
    return { valid: false, errors, warnings };
  }

  if (JSON.stringify(doc.Records_Type) !== JSON.stringify(["MFDB-132"])) {
    errors.push("Records_Type must be exactly ['MFDB-132'] for an MFDB-132 package.");
  }

  const fields = doc.Fields || [];
  const fm: Record<string, number> = {};
  fields.forEach((f, i) => (fm[f.name] = i));

  let manifestFound = false;
  for (const row of doc.Values || []) {
    if (row[fm["Relative_Path"]] === MFDB_MANIFEST_FILENAME) {
      manifestFound = true;
      break;
    }
  }

  if (!manifestFound) {
    errors.push(
      `Chunked package does not contain the MFDB manifest (${MFDB_MANIFEST_FILENAME}) — ` +
        "not a complete MFDB package."
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

function _findRowByRelPath(doc: MfdbChunkedDoc, relPath: string): any[] | null {
  const fields = doc.Fields || [];
  const fm: Record<string, number> = {};
  fields.forEach((f, i) => (fm[f.name] = i));
  const relIdx = fm["Relative_Path"];
  if (relIdx === undefined) return null;
  for (const row of doc.Values || []) {
    if (row[relIdx] === relPath) return row;
  }
  return null;
}

export function detectMfdbInChunk(doc: MfdbChunkedDoc): MfdbInChunkDetection {
  const result: MfdbInChunkDetection = {
    mfdb_detected: false,
    valid: false,
    db_name: null,
    mfdb_version: null,
    entities: [],
    errors: [],
    warnings: [],
  };

  const fields = doc.Fields || [];
  const fm: Record<string, number> = {};
  fields.forEach((f, i) => (fm[f.name] = i));
  const required = ["Relative_Path", "File_Content", "Is_Binary"];
  if (required.some((k) => fm[k] === undefined)) {
    result.errors.push("Chunk document is missing required Chunked-104 fields.");
    return result;
  }

  const manifestRow = _findRowByRelPath(doc, MFDB_MANIFEST_FILENAME);
  if (manifestRow === null) {
    result.errors.push(`No manifest (${MFDB_MANIFEST_FILENAME}) found in chunk — no MFDB present.`);
    return result;
  }

  if (manifestRow[fm["Is_Binary"]]) {
    result.errors.push("Manifest row is flagged Is_Binary — its content was never stored, cannot validate.");
    return result;
  }

  let manifestDoc: any;
  try {
    manifestDoc = JSON.parse(manifestRow[fm["File_Content"]]);
  } catch (e: any) {
    result.errors.push(`Manifest content is not valid JSON: ${e.message}`);
    return result;
  }

  result.mfdb_detected = true;
  result.db_name = manifestDoc.DB_Name ?? null;
  result.mfdb_version = manifestDoc.MFDB_Version ?? null;

  if (manifestDoc.Format_Version !== "104a") {
    result.errors.push("Manifest Format_Version must be '104a'.");
  }
  if (JSON.stringify(manifestDoc.Records_Type) !== JSON.stringify(["mfdb"])) {
    result.errors.push("Manifest Records_Type must be exactly ['mfdb'].");
  }

  const manifestFields: MfdbFieldDef[] = manifestDoc.Fields || [];
  const manifestFm: Record<string, number> = {};
  manifestFields.forEach((f, i) => (manifestFm[f.name] = i));
  if (manifestFm["entity_name"] === undefined || manifestFm["file_path"] === undefined) {
    result.errors.push("Manifest Fields must include 'entity_name' and 'file_path'.");
    return result;
  }

  const seenEntityNames = new Set<string>();
  const seenFilePaths = new Set<string>();

  for (const entityRow of manifestDoc.Values || []) {
    const entityName = entityRow[manifestFm["entity_name"]];
    const filePath = entityRow[manifestFm["file_path"]];
    const entityResult: MfdbEntityCheck = {
      entity_name: entityName,
      file_path: filePath,
      found_in_chunk: false,
      valid: false,
      errors: [],
    };

    if (!entityName || !filePath) {
      entityResult.errors.push("entity_name/file_path must not be null.");
    }
    if (seenEntityNames.has(entityName)) {
      entityResult.errors.push(`Duplicate entity_name '${entityName}' in manifest.`);
    }
    if (seenFilePaths.has(filePath)) {
      entityResult.errors.push(`Duplicate file_path '${filePath}' in manifest.`);
    }
    seenEntityNames.add(entityName);
    seenFilePaths.add(filePath);

    const entityChunkRow = _findRowByRelPath(doc, filePath);
    if (entityChunkRow === null) {
      entityResult.errors.push(`Entity file '${filePath}' listed in manifest was not found in chunk.`);
      result.entities.push(entityResult);
      continue;
    }

    entityResult.found_in_chunk = true;
    if (entityChunkRow[fm["Is_Binary"]]) {
      entityResult.errors.push("Entity row is flagged Is_Binary — content was never stored, cannot validate.");
      result.entities.push(entityResult);
      continue;
    }

    let entityDoc: any;
    try {
      entityDoc = JSON.parse(entityChunkRow[fm["File_Content"]]);
    } catch (e: any) {
      entityResult.errors.push(`Entity file content is not valid JSON: ${e.message}`);
      result.entities.push(entityResult);
      continue;
    }

    if (entityDoc.Format_Version !== "104") {
      entityResult.errors.push("Entity Format_Version must be '104'.");
    }
    if (JSON.stringify(entityDoc.Records_Type) !== JSON.stringify([entityName])) {
      entityResult.errors.push(`Entity Records_Type must be exactly ['${entityName}'].`);
    }
    if (!("Parent_Hierarchy" in entityDoc)) {
      entityResult.errors.push("Entity is missing mandatory 'Parent_Hierarchy' key.");
    }

    entityResult.valid = entityResult.errors.length === 0;
    result.entities.push(entityResult);
  }

  result.valid = result.errors.length === 0 && result.entities.every((e) => e.valid);
  return result;
}
