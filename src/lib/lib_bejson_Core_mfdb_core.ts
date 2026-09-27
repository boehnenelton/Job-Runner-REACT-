/**
 * Library:         lib_bejson_Core_mfdb_core.ts
 * Family:          Core
 * Module Purpose:  Implements runtime functionality and logic for lib_bejson_Core_mfdb_core.ts.
 * Architecture:    MFDB provides multi-file database federation coordinating a 104a central manifest (104a.mfdb.bejson) with dense 104 entity tables, supporting atomic transaction locks and cross-disk relational foreign keys.
 * Version:         2.2.0
 * Release_Version: 300
 * Date:            2026-07-31
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   9f3c2a85-6d1e-4b7a-c4f0-2e8b5d3a1c96
 */

import {
  BEJSONDocument,
  BEJSONField,
  BEJSONValue,
  MFDBManifestRecord,
  MFDBDatabaseMeta,
  MFDBCoreError,
  MFDB_CORE_CODES as E,
} from "./lib_bejson_Core_bejson_types";
import { decodeManifestRecords } from "./lib_bejson_Core_mfdb_validators";
import {
  appendRecord,
  deleteRecord,
  getFieldIndex,
  setFieldValue,
  createEmpty104a,
} from "./lib_bejson_Core_bejson_core";

export interface MFDBArchiveInterface {
  mount(zipFile: File | Blob, dirHandle: any): Promise<string>;
  commit(dirHandle: any): Promise<Blob>;
}

export type NetworkRole = "Master" | "Slave" | "Standalone";

export interface CreateManifestOptions extends MFDBDatabaseMeta {
  includeOptionalFields?: boolean;
  network_role?: NetworkRole;
}

export function createManifest(opts: CreateManifestOptions): BEJSONDocument {
  if (!opts.db_name || opts.db_name.trim() === "") {
    throw new MFDBCoreError(E.MISSING_DB_NAME, "DB_Name is required when creating a manifest.");
  }

  const includeOptional = opts.includeOptionalFields !== false;
  const networkRole: NetworkRole = opts.network_role ?? "Standalone";

  const fields: BEJSONField[] = [
    { name: "entity_name", type: "string" },
    { name: "file_path", type: "string" },
  ];
  if (includeOptional) {
    fields.push(
      { name: "description", type: "string" },
      { name: "record_count", type: "integer" },
      { name: "schema_version", type: "string" },
      { name: "primary_key", type: "string" }
    );
  }

  const customHeaders: Record<string, string> = {
    MFDB_Version:  opts.mfdb_version ?? "1.31",
    Network_Role:  networkRole,
    DB_Name:       opts.db_name,
  };
  if (opts.db_description) customHeaders["DB_Description"] = opts.db_description;
  if (opts.schema_version) customHeaders["Schema_Version"] = opts.schema_version;
  if (opts.author)         customHeaders["Author"]         = opts.author;
  if (opts.created_at)     customHeaders["Created_At"]     = opts.created_at;

  return createEmpty104a("mfdb", fields, customHeaders);
}

export function registerEntity(
  manifest: BEJSONDocument,
  record: MFDBManifestRecord
): BEJSONDocument {
  _assertManifest(manifest);

  const existing = decodeManifestRecords(manifest);
  if (existing.some((r) => r.entity_name === record.entity_name)) {
    throw new MFDBCoreError(
      E.DUPLICATE_ENTITY_NAME,
      "Entity \"" + record.entity_name + "\" is already registered."
    );
  }

  const fieldNames = manifest.Fields.map((f) => f.name);
  const row: BEJSONValue[] = fieldNames.map((name) => {
    switch (name) {
      case "entity_name": return record.entity_name;
      case "file_path": return record.file_path;
      case "description": return record.description ?? null;
      case "record_count": return record.record_count ?? null;
      case "schema_version": return record.schema_version ?? null;
      case "primary_key": return record.primary_key ?? null;
      default: return null;
    }
  });

  return appendRecord(manifest, row);
}

export function unregisterEntity(
  manifest: BEJSONDocument,
  entityName: string
): BEJSONDocument {
  _assertManifest(manifest);
  const idx = _findEntityIndex(manifest, entityName);
  return deleteRecord(manifest, idx);
}

export function syncRecordCount(
  manifest: BEJSONDocument,
  entityName: string,
  count: number
): BEJSONDocument {
  _assertManifest(manifest);
  const idx = _findEntityIndex(manifest, entityName);

  try {
    getFieldIndex(manifest, "record_count");
  } catch {
    throw new MFDBCoreError(
      E.RECORD_COUNT_SYNC_FAILED,
      "Manifest lacks \"record_count\" field."
    );
  }

  return setFieldValue(manifest, idx, "record_count", count);
}

function _assertManifest(doc: BEJSONDocument): void {
  if (!doc) {
    throw new MFDBCoreError(E.NULL_MANIFEST, "Manifest is null or undefined.");
  }
}

function _findEntityIndex(manifest: BEJSONDocument, entityName: string): number {
  const enIdx = getFieldIndex(manifest, "entity_name");
  for (let i = 0; i < manifest.Values.length; i++) {
    if (manifest.Values[i][enIdx] === entityName) return i;
  }
  throw new MFDBCoreError(
    E.ENTITY_NOT_IN_MANIFEST,
    "Entity \"" + entityName + "\" not found."
  );
}

export interface ConnectedSlaveSchema {
  slave_id:           string;
  label:              string;
  url:                string;
  role:               string;
  status:             string;
  supported_entities: string[];
}

export const CONNECTED_SLAVE_SCHEMA: BEJSONField[] = [
  { name: "slave_id",           type: "string" },
  { name: "label",              type: "string" },
  { name: "url",                type: "string" },
  { name: "role",               type: "string" },
  { name: "status",             type: "string" },
  { name: "supported_entities", type: "array"  },
];

export function createConnectedSlaveEntity(manifest: BEJSONDocument): BEJSONDocument {
  const role = (manifest as any)["Network_Role"] ?? "";
  if (role !== "Master") {
    throw new MFDBCoreError(
      E.INVALID_OPERATION ?? "INVALID_OPERATION",
      `ConnectedSlave may only be created on a Master node. Got: '${role}'`
    );
  }
  return registerEntity(manifest, {
    entity_name:    "ConnectedSlave",
    file_path:      "data/connectedslave.bejson",
    description:    "Registry of Slave nodes connected to this Master.",
    primary_key:    "slave_id",
    record_count:   0,
    schema_version: "1.0",
  });
}
