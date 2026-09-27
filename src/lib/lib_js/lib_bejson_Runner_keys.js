/**
 * Library:         lib_bejson_Runner_keys.js
 * Family:          Runner
 * Module Purpose:  API key management, BEJSON 104a key store schema, and round-robin key rotation.
 * Architecture:    Browser-only BEJSON 104a key store with up to 20 slots and round-robin dispatch.
 * Version:         3.1.6
 * Release_Version: 300
 * Date:            2026-09-27
 * Author:          Elton Boehnen · boehnenelton2024@gmail.com · boehnenelton2024.pages.dev · github.com/boehnenelton
 * Format_Creator:  Elton Boehnen
 * RELATIONAL_ID:   b199842a-a9e2-4917-8149-16013a2901cd
 */

export const SUPPORTED_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
];

export const DEFAULT_MODEL = "gemini-3.6-flash";

export const KEY_STORE_FIELDS = [
  { name: "slot_index", type: "integer" },
  { name: "slot_label", type: "string" },
  { name: "api_key", type: "string" },
  { name: "is_active", type: "boolean" },
  { name: "last_used_date", type: "string" },
  { name: "call_count", type: "integer" },
  { name: "error_count", type: "integer" },
];

export function bejson_core_get_field_map(doc) {
  if (!doc || !doc.Fields) return {};
  const fieldMap = {};
  doc.Fields.forEach((f, i) => {
    fieldMap[f.name] = i;
  });
  return fieldMap;
}

export function createEmptyKeyStoreDoc() {
  const values = [];
  for (let i = 1; i <= 20; i++) {
    values.push([
      i,
      `Key Slot ${i}`,
      "",
      true,
      "",
      0,
      0,
    ]);
  }

  return {
    Format: "BEJSON",
    Format_Version: "104a",
    Format_Creator: "Elton Boehnen",
    Records_Type: ["KeyStore"],
    Schema_Name: "API Key Store",
    Schema_Version: "1.0",
    Max_Slots: 20,
    Active_Slot_Index: 1,
    Selected_Model: DEFAULT_MODEL,
    Fields: KEY_STORE_FIELDS,
    Values: values,
  };
}

export function extractKeySlots(doc) {
  const fmap = bejson_core_get_field_map(doc);
  const rows = doc.Values || [];
  return rows.map((r) => ({
    slotIndex: Number(r[fmap["slot_index"]] ?? 0),
    slotLabel: String(r[fmap["slot_label"]] ?? ""),
    apiKey: String(r[fmap["api_key"]] ?? ""),
    isActive: Boolean(r[fmap["is_active"]]),
    lastUsedDate: String(r[fmap["last_used_date"]] ?? ""),
    callCount: Number(r[fmap["call_count"]] ?? 0),
    errorCount: Number(r[fmap["error_count"]] ?? 0),
  }));
}

export function getNextRoundRobinKey(doc) {
  const slots = extractKeySlots(doc);
  const validSlots = slots.filter((s) => s.isActive && s.apiKey && s.apiKey.trim().length > 0);

  if (validSlots.length === 0) return null;

  const currentActive = Number(doc["Active_Slot_Index"] || 1);
  let chosen = validSlots.find((s) => s.slotIndex >= currentActive);
  if (!chosen) {
    chosen = validSlots[0];
  }

  const chosenIdxInValid = validSlots.indexOf(chosen);
  const nextIdxInValid = (chosenIdxInValid + 1) % validSlots.length;
  const nextSlotIndex = validSlots[nextIdxInValid].slotIndex;

  const clonedDoc = JSON.parse(JSON.stringify(doc));
  const fmap = bejson_core_get_field_map(clonedDoc);
  clonedDoc["Active_Slot_Index"] = nextSlotIndex;

  for (const row of clonedDoc.Values || []) {
    if (Number(row[fmap["slot_index"]]) === chosen.slotIndex) {
      row[fmap["call_count"]] = Number(row[fmap["call_count"]] || 0) + 1;
      row[fmap["last_used_date"]] = new Date().toISOString();
      break;
    }
  }

  return {
    key: chosen.apiKey.trim(),
    slotIndex: chosen.slotIndex,
    updatedDoc: clonedDoc,
  };
}

export function updateKeySlot(doc, slotIndex, apiKey, slotLabel, isActive) {
  const clonedDoc = JSON.parse(JSON.stringify(doc));
  const fmap = bejson_core_get_field_map(clonedDoc);

  for (const row of clonedDoc.Values || []) {
    if (Number(row[fmap["slot_index"]]) === slotIndex) {
      row[fmap["api_key"]] = apiKey;
      if (slotLabel !== undefined) row[fmap["slot_label"]] = slotLabel;
      if (isActive !== undefined) row[fmap["is_active"]] = isActive;
      break;
    }
  }

  return clonedDoc;
}
