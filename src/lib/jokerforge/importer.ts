import type { ProjectData } from "@/lib/services/storage";
import {
  isLegacyJokerforgePayload,
  normalizeProjectData,
  transpileLegacyJokerforge,
} from "@/lib/jokerforge/legacy-transpiler";

export type JokerforgeImportSource = "v2" | "legacy";

export interface JokerforgeImportResult {
  project: ProjectData;
  source: JokerforgeImportSource;
}

interface JokerforgeV2Payload {
  format: "jokerforge";
  version: 2;
  exportedAt: string;
  project: unknown;
}

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const isV2Payload = (payload: unknown): payload is JokerforgeV2Payload => {
  const obj = asObject(payload);
  if (!obj) return false;

  return (
    obj.format === "jokerforge" &&
    obj.version === 2 &&
    Object.prototype.hasOwnProperty.call(obj, "project")
  );
};

const looksLikeProjectData = (payload: unknown): boolean => {
  const obj = asObject(payload);
  if (!obj) return false;

  return asObject(obj.metadata) !== null && asObject(obj.stats) !== null;
};

export const importJokerforgeFromText = (
  text: string,
): JokerforgeImportResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  if (isV2Payload(parsed)) {
    return {
      project: normalizeProjectData(parsed.project),
      source: "v2",
    };
  }

  if (looksLikeProjectData(parsed)) {
    return {
      project: normalizeProjectData(parsed),
      source: "v2",
    };
  }

  if (isLegacyJokerforgePayload(parsed)) {
    return {
      project: transpileLegacyJokerforge(parsed),
      source: "legacy",
    };
  }

  throw new Error(
    "Unsupported file format. Expected a Joker Forge v2 export or a legacy .jokerforge file.",
  );
};
