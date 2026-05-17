export type BasicFieldType =
  | "text"
  | "number"
  | "slider"
  | "textarea"
  | "rich-textarea"
  | "select"
  | "list"
  | "switch"
  | "image"
  | "custom";

export type BasicValidationResult = {
  sanitizedValue: unknown;
  error: string | null;
};

const KEY_SEGMENT_PATTERN = /(^|\.)(objectKey|key|group_key|custom_key)$/i;

const looksLikeKeyField = (fieldId: string): boolean =>
  KEY_SEGMENT_PATTERN.test(fieldId.trim());

export const sanitizeKeyLikeValue = (value: string): string => {
  const normalized = value.toLowerCase();
  return normalized
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_");
};

const sanitizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry)))
    .filter((entry) => entry.length > 0);
};

export const sanitizeFieldValue = (
  fieldType: BasicFieldType,
  fieldId: string,
  value: unknown,
): unknown => {
  if (fieldType === "text" || fieldType === "textarea" || fieldType === "rich-textarea") {
    if (typeof value !== "string") return value;
    return looksLikeKeyField(fieldId) ? sanitizeKeyLikeValue(value) : value;
  }

  if (fieldType === "number" || fieldType === "slider") {
    if (value === "" || value === null || value === undefined) return undefined;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }

  if (fieldType === "list") {
    return sanitizeStringList(value);
  }

  return value;
};

export const validateFieldValueBasic = (
  fieldType: BasicFieldType,
  fieldId: string,
  value: unknown,
  options?: Array<{ value: string | number }>,
  min?: number,
  max?: number,
): BasicValidationResult => {
  const sanitizedValue = sanitizeFieldValue(fieldType, fieldId, value);

  if (looksLikeKeyField(fieldId)) {
    const asString = String(sanitizedValue ?? "");
    if (!asString.trim()) {
      return {
        sanitizedValue: asString,
        error: "Key is required.",
      };
    }
    if (!/^[a-z0-9_]+$/.test(asString)) {
      return {
        sanitizedValue: sanitizeKeyLikeValue(asString),
        error: "Key can only include lowercase letters, numbers, and underscores.",
      };
    }
  }

  if (fieldType === "number" || fieldType === "slider") {
    if (sanitizedValue === undefined) {
      return { sanitizedValue, error: null };
    }
    const num = Number(sanitizedValue);
    if (!Number.isFinite(num)) {
      return { sanitizedValue, error: "Value must be a valid number." };
    }
    if (typeof min === "number" && num < min) {
      return { sanitizedValue: min, error: `Value must be at least ${min}.` };
    }
    if (typeof max === "number" && num > max) {
      return { sanitizedValue: max, error: `Value must be at most ${max}.` };
    }
  }

  if (fieldType === "select" && options && options.length > 0) {
    if (sanitizedValue === undefined || sanitizedValue === null) {
      return { sanitizedValue, error: null };
    }
    const normalizedValue = String(sanitizedValue);
    const allowed = new Set(options.map((option) => String(option.value)));
    if (!allowed.has(normalizedValue)) {
      return { sanitizedValue, error: "Please choose a valid option." };
    }
  }

  if (fieldType === "list") {
    const normalized = sanitizedValue as string[];
    const hasInvalid = normalized.some((entry) => entry.length === 0);
    if (hasInvalid) {
      return {
        sanitizedValue: normalized.filter((entry) => entry.length > 0),
        error: "List items cannot be empty.",
      };
    }
  }

  if (fieldType === "image" && sanitizedValue) {
    if (typeof sanitizedValue !== "string") {
      return { sanitizedValue, error: "Image value must be a valid string." };
    }
  }

  return { sanitizedValue, error: null };
};
