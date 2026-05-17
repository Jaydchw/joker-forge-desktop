export interface LocalizationEntry {
  language: string;
  name: string;
  description: string;
}

export interface LocalizationLanguageOption {
  value: string;
  label: string;
}

export const DEFAULT_LOCALIZATION_LANGUAGE = "en-us";

export const LOCALIZATION_LANGUAGE_OPTIONS: LocalizationLanguageOption[] = [
  { value: "de", label: "German (de)" },
  { value: "en-us", label: "English (en-us)" },
  { value: "es_419", label: "Spanish Latin America (es_419)" },
  { value: "es_ES", label: "Spanish Spain (es_ES)" },
  { value: "fr", label: "French (fr)" },
  { value: "id", label: "Indonesian (id)" },
  { value: "it", label: "Italian (it)" },
  { value: "ja", label: "Japanese (ja)" },
  { value: "ko", label: "Korean (ko)" },
  { value: "nl", label: "Dutch (nl)" },
  { value: "pl", label: "Polish (pl)" },
  { value: "pt_BR", label: "Portuguese Brazil (pt_BR)" },
  { value: "ru", label: "Russian (ru)" },
  { value: "zh_CN", label: "Chinese Simplified (zh_CN)" },
  { value: "zh_TW", label: "Chinese Traditional (zh_TW)" },
];

const LANGUAGE_VALUE_MAP = new Map(
  LOCALIZATION_LANGUAGE_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]),
);

export const normalizeLanguageValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower === "default") return DEFAULT_LOCALIZATION_LANGUAGE;
  return LANGUAGE_VALUE_MAP.get(lower) || raw;
};

export const sanitizeLocalizationEntries = (
  value: unknown,
): LocalizationEntry[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const sanitized: LocalizationEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;

    const language = normalizeLanguageValue((entry as { language?: unknown }).language);
    if (!language) continue;

    const dedupeKey = language.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    const rawName = (entry as { name?: unknown }).name;
    const rawDescription = (entry as { description?: unknown }).description;
    sanitized.push({
      language,
      name: typeof rawName === "string" ? rawName : "",
      description: typeof rawDescription === "string" ? rawDescription : "",
    });
  }

  return sanitized;
};

export const getLocalizationEntryByLanguage = (
  entries: LocalizationEntry[],
  language: string,
): LocalizationEntry | null => {
  const normalizedLanguage = normalizeLanguageValue(language);
  if (!normalizedLanguage) return null;

  const target = normalizedLanguage.toLowerCase();
  return (
    entries.find((entry) => entry.language.toLowerCase() === target) || null
  );
};

type LocalizableBase = {
  name?: unknown;
  description?: unknown;
  localizations?: unknown;
};

export type LocalizableResolved<T extends LocalizableBase> = T & {
  name: string;
  description: string;
  localizations: LocalizationEntry[];
};

export const ensureLocalizableWithLanguage = <T extends LocalizableBase>(
  item: T,
  language: string,
): LocalizableResolved<T> => {
  const normalizedLanguage =
    normalizeLanguageValue(language) || DEFAULT_LOCALIZATION_LANGUAGE;
  const hasNameField = Object.prototype.hasOwnProperty.call(item, "name");
  const hasDescriptionField = Object.prototype.hasOwnProperty.call(
    item,
    "description",
  );
  const rawName = typeof item.name === "string" ? item.name : "";
  const rawDescription =
    typeof item.description === "string" ? item.description : "";
  const sanitized = sanitizeLocalizationEntries(item.localizations);
  const existing = getLocalizationEntryByLanguage(sanitized, normalizedLanguage);

  const mergedEntry: LocalizationEntry = {
    language: normalizedLanguage,
    name: hasNameField ? rawName : existing?.name || "",
    description: hasDescriptionField
      ? rawDescription
      : existing?.description || "",
  };

  const nextLocalizations = sanitized
    .filter(
      (entry) => entry.language.toLowerCase() !== normalizedLanguage.toLowerCase(),
    )
    .concat(mergedEntry);

  return {
    ...item,
    name: mergedEntry.name,
    description: mergedEntry.description,
    localizations: nextLocalizations,
  } as LocalizableResolved<T>;
};
