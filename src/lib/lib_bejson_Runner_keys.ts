/**
 * Library:         lib_bejson_Runner_keys.ts
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

import { BEJSONDocument } from "./lib_bejson_Core_bejson_types";
import { bejson_core_get_field_map } from "./lib_bejson_Core_bejson_field_map";

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
] as const;

export type SupportedGeminiModel = typeof SUPPORTED_GEMINI_MODELS[number];
export const DEFAULT_MODEL: SupportedGeminiModel = "gemini-3.6-flash";

export const KEY_STORE_FIELDS = [
  { name: "slot_index", type: "integer" },
  { name: "slot_label", type: "string" },
  { name: "api_key", type: "string" },
  { name: "is_active", type: "boolean" },
  { name: "last_used_date", type: "string" },
  { name: "call_count", type: "integer" },
  { name: "error_count", type: "integer" },
];

export interface KeySlotItem {
  slotIndex: number;
  slotLabel: string;
  apiKey: string;
  isActive: boolean;
  lastUsedDate: string;
  callCount: number;
  errorCount: number;
}

/**
 * Creates an empty BEJSON 104a KeyStore document with 20 slots.
 */
export function createEmptyKeyStoreDoc(): BEJSONDocument {
  const values: any[][] = [];
  for (let i = 1; i <= 20; i++) {
    values.push([
      i,
      `Key Slot ${i}`,
      "", // empty key initially
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
  } as BEJSONDocument;
}

/**
 * Extracts key slot items using cached field map.
 */
export function extractKeySlots(doc: BEJSONDocument): KeySlotItem[] {
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

/**
 * Performs round-robin key selection across active non-empty slots.
 */
export function getNextRoundRobinKey(doc: BEJSONDocument): { key: string; slotIndex: number; updatedDoc: BEJSONDocument } | null {
  const slots = extractKeySlots(doc);
  const validSlots = slots.filter((s) => s.isActive && s.apiKey && s.apiKey.trim().length > 0);

  if (validSlots.length === 0) return null;

  const currentActive = Number((doc as any)["Active_Slot_Index"] || 1);
  // Find index of slot with slotIndex >= currentActive
  let chosen = validSlots.find((s) => s.slotIndex >= currentActive);
  if (!chosen) {
    chosen = validSlots[0];
  }

  // Update next active index to next available slot
  const chosenIdxInValid = validSlots.indexOf(chosen);
  const nextIdxInValid = (chosenIdxInValid + 1) % validSlots.length;
  const nextSlotIndex = validSlots[nextIdxInValid].slotIndex;

  const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(doc));
  const fmap = bejson_core_get_field_map(clonedDoc);
  (clonedDoc as any)["Active_Slot_Index"] = nextSlotIndex;

  // Increment call count for chosen slot
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

/**
 * Updates a specific key slot in the document.
 */
export function updateKeySlot(
  doc: BEJSONDocument,
  slotIndex: number,
  apiKey: string,
  slotLabel?: string,
  isActive?: boolean
): BEJSONDocument {
  const clonedDoc: BEJSONDocument = JSON.parse(JSON.stringify(doc));
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
