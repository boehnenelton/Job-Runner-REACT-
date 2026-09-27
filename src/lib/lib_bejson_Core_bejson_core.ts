/**
 * Library:         lib_bejson_Core_bejson_core.ts
 * Family:          Core
 * Module Purpose:  Implements runtime functionality and logic for lib_bejson_Core_bejson_core.ts.
 * Architecture:    BEJSON 104db provides single-file multi-entity relational storage with positional null-padding, Record_Type_Parent discriminator headers, and plain-text LLM readability.
 * Version:         2.1.4
 * Release_Version: 300
 * Date:            2026-08-08
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   295ffcca-282b-4e69-958e-14a225499ad0
 */

import {
  BEJSONDocument,
  BEJSONField,
  BEJSONValue,
  BEJSONCoreError,
  BEJSON_CORE_CODES,
} from "./lib_bejson_Core_bejson_types";

export const RELEASE_VERSION: number = 300;

// ---------------------------------------------------------------------------
// Parse & Serialize
// ---------------------------------------------------------------------------

export function parse(text: string): BEJSONDocument {
  if (typeof text !== 'string') {
    throw new BEJSONCoreError(BEJSON_CORE_CODES.PARSE_ERROR, 'Input must be a string.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new BEJSONCoreError(
      BEJSON_CORE_CODES.PARSE_ERROR,
      "Invalid JSON: " + String(e)
    );
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BEJSONCoreError(
      BEJSON_CORE_CODES.PARSE_ERROR,
      "Parsed JSON root must be an object."
    );
  }

  return raw as BEJSONDocument;
}

export function serialize(doc: BEJSONDocument, indent: number = 2): string {
  if (doc === null || doc === undefined) {
    throw new BEJSONCoreError(
      BEJSON_CORE_CODES.NULL_DOCUMENT,
      "Cannot serialize null or undefined document."
    );
  }
  try {
    const cleanDoc: Record<string, any> = {};
    for (const key in doc) {
      if (Object.prototype.hasOwnProperty.call(doc, key) && !key.startsWith("_")) {
        cleanDoc[key] = doc[key];
      }
    }
    return JSON.stringify(cleanDoc, null, indent || undefined);
  } catch (e) {
    throw new BEJSONCoreError(
      BEJSON_CORE_CODES.SERIALIZATION_ERROR,
      "Serialization failed: " + String(e)
    );
  }
}

// ---------------------------------------------------------------------------
// Field index helpers
// ---------------------------------------------------------------------------

export function getFieldIndex(doc: BEJSONDocument, name: string): number {
  _assertDoc(doc);
  const idx = doc.Fields.findIndex((f) => f.name === name);
  if (idx === -1) {
    throw new BEJSONCoreError(
      BEJSON_CORE_CODES.FIELD_NOT_FOUND,
      "Field not found: " + name
    );
  }
  return idx;
}

export function getFieldNames(doc: BEJSONDocument): string[] {
  _assertDoc(doc);
  return doc.Fields.map((f) => f.name);
}

export function getFields(doc: BEJSONDocument): BEJSONField[] {
  _assertDoc(doc);
  return doc.Fields.map((f) => Object.assign({}, f));
}

// ---------------------------------------------------------------------------
// Record accessors
// ---------------------------------------------------------------------------

export function getRecord(
  doc: BEJSONDocument,
  index: number
): Record<string, BEJSONValue> {
  _assertDoc(doc);
  _assertIndex(doc, index);
  return _rowToObject(doc.Fields, doc.Values[index]);
}

export function getAllRecords(
  doc: BEJSONDocument
): Record<string, BEJSONValue>[] {
  _assertDoc(doc);
  return doc.Values.map((row) => _rowToObject(doc.Fields, row));
}

export function getFieldValue(
  doc: BEJSONDocument,
  index: number,
  fieldName: string
): BEJSONValue {
  _assertDoc(doc);
  _assertIndex(doc, index);
  const fi = getFieldIndex(doc, fieldName);
  return doc.Values[index][fi];
}

export function getRecordCount(doc: BEJSONDocument): number {
  _assertDoc(doc);
  return doc.Values.length;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function createEmpty104(
  recordType: string,
  fields: BEJSONField[],
  values: BEJSONValue[][] = [],
  parentHierarchy?: string
): BEJSONDocument {
  const doc: BEJSONDocument = {
    Format: "BEJSON",
    Format_Version: "104",
    Format_Creator: "Elton Boehnen",
    Records_Type: [recordType],
    Fields: fields,
    Values: values,
  };
  if (parentHierarchy !== undefined) {
    (doc as Record<string, unknown>)["Parent_Hierarchy"] = parentHierarchy;
  }
  return doc;
}

export function createEmpty104a(
  recordType: string,
  fields: BEJSONField[],
  customHeaders: Record<string, string | number | boolean> = {}
): BEJSONDocument {
  return {
    Format: "BEJSON",
    Format_Version: "104a",
    Format_Creator: "Elton Boehnen",
    Records_Type: [recordType],
    Fields: fields,
    Values: [],
    ...customHeaders,
  };
}

export function createEmpty104db(
  recordTypes: [string, string, ...string[]],
  fields: BEJSONField[]
): BEJSONDocument {
  return {
    Format: "BEJSON",
    Format_Version: "104db",
    Format_Creator: "Elton Boehnen",
    Records_Type: recordTypes,
    Fields: fields,
    Values: [],
  };
}

export function getRecordsByType(
  doc: BEJSONDocument,
  type: string
): Record<string, BEJSONValue>[] {
  _assertDoc(doc);
  if (doc.Format_Version !== "104db") {
    throw new BEJSONCoreError(
      BEJSON_CORE_CODES.UNSUPPORTED_OPERATION,
      "getRecordsByType is only valid on BEJSON 104db documents."
    );
  }
  return doc.Values.filter((row) => row[0] === type).map((row) =>
    _rowToObject(doc.Fields, row)
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function appendRecord(
  doc: BEJSONDocument,
  values: BEJSONValue[]
): BEJSONDocument {
  _assertDoc(doc);
  _assertRowLength(doc, values);
  const coerced = values.map((v, i) => _coerceValue(v, doc.Fields[i].type));
  return _cloneWith(doc, { Values: [...doc.Values, coerced] });
}

export function updateRecord(
  doc: BEJSONDocument,
  index: number,
  values: BEJSONValue[]
): BEJSONDocument {
  _assertDoc(doc);
  _assertIndex(doc, index);
  _assertRowLength(doc, values);
  const coerced = values.map((v, i) => _coerceValue(v, doc.Fields[i].type));
  const newValues = doc.Values.map((row, i) =>
    i === index ? coerced : row
  );
  return _cloneWith(doc, { Values: newValues });
}

export function deleteRecord(doc: BEJSONDocument, index: number): BEJSONDocument {
  _assertDoc(doc);
  _assertIndex(doc, index);
  const newValues = doc.Values.filter((_, i) => i !== index);
  return _cloneWith(doc, { Values: newValues });
}

export function setFieldValue(
  doc: BEJSONDocument,
  index: number,
  fieldName: string,
  value: BEJSONValue
): BEJSONDocument {
  _assertDoc(doc);
  _assertIndex(doc, index);
  const fi = getFieldIndex(doc, fieldName);
  const coerced = _coerceValue(value, doc.Fields[fi].type);
  const newRow = [...doc.Values[index]];
  newRow[fi] = coerced;
  const newValues = doc.Values.map((row, i) => (i === index ? newRow : row));
  return _cloneWith(doc, { Values: newValues });
}

// ---------------------------------------------------------------------------
// Encryption Utilities Optimized
// ---------------------------------------------------------------------------

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const _KEY_CACHE_MAX_SLOTS = 12;
const _keyCache: Array<{ password: string; salt: string; key: CryptoKey }> = [];

async function _getOrDeriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltHex = _ab2hex(salt as BufferSource);
  const hitIdx = _keyCache.findIndex((e) => e.password === password && e.salt === saltHex);
  if (hitIdx !== -1) {
    const [hit] = _keyCache.splice(hitIdx, 1);
    _keyCache.push(hit);
    return hit.key;
  }
  const key = await deriveKey(password, salt);
  if (_keyCache.length >= _KEY_CACHE_MAX_SLOTS) {
    _keyCache.shift();
  }
  _keyCache.push({ password, salt: saltHex, key });
  return key;
}

function _toUint8(buf: BufferSource): Uint8Array {
  return ArrayBuffer.isView(buf)
    ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    : new Uint8Array(buf);
}

function _ab2hex(buf: BufferSource): string {
  return Array.from(_toUint8(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function _ab2base64(buf: BufferSource): string {
  return btoa(String.fromCharCode(...Array.from(_toUint8(buf))));
}

function _base642ab(base64: string): Uint8Array {
  const b = atob(base64);
  return new Uint8Array(b.length).map((_, i) => b.charCodeAt(i));
}

export async function encryptRecord(
  doc: BEJSONDocument,
  recordIndex: number,
  password: string,
  providedSalt?: Uint8Array
): Promise<BEJSONDocument> {
  _assertDoc(doc);
  _assertIndex(doc, recordIndex);

  const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));
  const key = await _getOrDeriveKey(password, salt);
  const saltB64 = _ab2base64(salt as BufferSource);

  const row = doc.Values[recordIndex];
  const newRow = [...row];

  for (let j = 0; j < newRow.length; j++) {
    const field = doc.Fields[j];
    if (field.name === "Record_Type_Parent" || field.name === "is_encrypted") continue;
    if (newRow[j] === null || (typeof newRow[j] === "string" && (newRow[j] as string).startsWith("ENC:AES-GCM:"))) continue;

    const dataEnc = new TextEncoder().encode(JSON.stringify(newRow[j]));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, dataEnc);

    newRow[j] = "ENC:AES-GCM:" + saltB64 + ":" + _ab2base64(iv) + ":" + _ab2base64(ciphertext);
  }

  const ieIdx = doc.Fields.findIndex((f) => f.name === "is_encrypted");
  if (ieIdx !== -1) newRow[ieIdx] = true;

  const newValues = doc.Values.map((r, i) => (i === recordIndex ? newRow : r));
  return _cloneWith(doc, { Values: newValues });
}

export async function decryptRecord(
  doc: BEJSONDocument,
  recordIndex: number,
  password: string
): Promise<BEJSONDocument> {
  _assertDoc(doc);
  _assertIndex(doc, recordIndex);

  const row = doc.Values[recordIndex];
  const newRow = [...row];

  for (let j = 0; j < newRow.length; j++) {
    const val = newRow[j];
    if (typeof val !== "string" || !val.startsWith("ENC:AES-GCM:")) continue;

    const parts = val.split(":");
    if (parts.length !== 5) continue;

    const salt = _base642ab(parts[2]);
    const iv = _base642ab(parts[3]);
    const ct = _base642ab(parts[4]);

    const key = await _getOrDeriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
    newRow[j] = JSON.parse(new TextDecoder().decode(decrypted));
  }

  const ieIdx = doc.Fields.findIndex((f) => f.name === "is_encrypted");
  if (ieIdx !== -1) {
    newRow[ieIdx] = newRow.some((v, idx) => doc.Fields[idx].name !== "is_encrypted" && typeof v === "string" && v.startsWith("ENC:AES-GCM:"));
  }

  const newValues = doc.Values.map((r, i) => (i === recordIndex ? newRow : r));
  return _cloneWith(doc, { Values: newValues });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _assertDoc(doc: BEJSONDocument): void {
  if (doc === null || doc === undefined) throw new BEJSONCoreError(BEJSON_CORE_CODES.NULL_DOCUMENT, "Document is null.");
}

function _assertIndex(doc: BEJSONDocument, index: number): void {
  if (index < 0 || index >= doc.Values.length) throw new BEJSONCoreError(BEJSON_CORE_CODES.INDEX_OUT_OF_BOUNDS, "Index out of bounds.");
}

function _assertRowLength(doc: BEJSONDocument, values: BEJSONValue[]): void {
  if (values.length !== doc.Fields.length) throw new BEJSONCoreError(BEJSON_CORE_CODES.WRITE_LENGTH_MISMATCH, "Length mismatch.");
}

function _rowToObject(fields: BEJSONField[], row: BEJSONValue[]): Record<string, BEJSONValue> {
  const obj: Record<string, BEJSONValue> = {};
  for (let i = 0; i < fields.length; i++) obj[fields[i].name] = row[i];
  return obj;
}

function _cloneWith(doc: BEJSONDocument, overrides: Partial<BEJSONDocument>): BEJSONDocument {
  return Object.assign({}, doc, overrides);
}

function _coerceValue(value: any, fieldType: string): BEJSONValue {
  if (fieldType === "string") return String(value);
  if (fieldType === "integer" || fieldType === "number") {
    const num = fieldType === "integer" ? parseInt(value, 10) : parseFloat(value);
    if (isNaN(num)) throw new BEJSONCoreError(BEJSON_CORE_CODES.WRITE_TYPE_MISMATCH, "Coercion failed.");
    return num;
  }
  if (fieldType === "boolean") {
    if (typeof value === "boolean") return value;
    if (String(value).toLowerCase() === "true") return true;
    if (String(value).toLowerCase() === "false") return false;
    throw new BEJSONCoreError(BEJSON_CORE_CODES.WRITE_TYPE_MISMATCH, "Coercion failed.");
  }
  return value as BEJSONValue;
}
