import { useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DescriptionEditorItemContext,
  DescriptionEditor,
} from "@/components/pages/description-editor";
import {
  LOCALIZATION_LANGUAGE_OPTIONS,
  getLocalizationEntryByLanguage,
  normalizeLanguageValue,
  sanitizeLocalizationEntries,
  type LocalizationEntry,
} from "@/lib/core/localization";
import {
  CheckCircle,
  CheckSquare,
  GlobeHemisphereWest,
  Square,
} from "@phosphor-icons/react";

interface LocalizationEditorProps {
  value?: LocalizationEntry[];
  onChange: (entries: LocalizationEntry[]) => void;
  baseName: string;
  baseDescription: string;
  itemContext?: DescriptionEditorItemContext;
  activeLanguage: string;
  onActiveLanguageChange: (language: string) => void;
  defaultLanguage: string;
}

export function LocalizationEditor({
  value,
  onChange,
  baseName,
  baseDescription,
  itemContext,
  activeLanguage,
  onActiveLanguageChange,
  defaultLanguage,
}: LocalizationEditorProps) {
  const entries = useMemo(() => sanitizeLocalizationEntries(value), [value]);
  const normalizedRequestedLanguage =
    normalizeLanguageValue(activeLanguage) || null;
  const selectableLanguageOptions = useMemo(() => {
    if (!normalizedRequestedLanguage) {
      return LOCALIZATION_LANGUAGE_OPTIONS;
    }
    const exists = LOCALIZATION_LANGUAGE_OPTIONS.some(
      (option) =>
        option.value.toLowerCase() === normalizedRequestedLanguage.toLowerCase(),
    );
    if (exists) return LOCALIZATION_LANGUAGE_OPTIONS;
    return [
      ...LOCALIZATION_LANGUAGE_OPTIONS,
      {
        value: normalizedRequestedLanguage,
        label: `${normalizedRequestedLanguage} (custom)`,
      },
    ];
  }, [normalizedRequestedLanguage]);
  const normalizedDefaultLanguage =
    normalizeLanguageValue(defaultLanguage) || "en-us";
  const resolvedActiveLanguage =
    normalizedRequestedLanguage || normalizedDefaultLanguage;
  const normalizedActiveLanguage = resolvedActiveLanguage;
  const isDefaultLanguage =
    normalizedActiveLanguage.toLowerCase() ===
    normalizedDefaultLanguage.toLowerCase();

  const activeEntry = getLocalizationEntryByLanguage(
    entries,
    normalizedActiveLanguage,
  );
  const hasOverride = Boolean(
    activeEntry &&
      (activeEntry.name.trim().length > 0 ||
        activeEntry.description.trim().length > 0),
  );
  const activeEntryName = activeEntry?.name || "";
  const activeEntryDescription = activeEntry?.description || "";
  const mirrorsBaseForNonDefault =
    !isDefaultLanguage &&
    Boolean(activeEntry) &&
    activeEntryName === baseName &&
    activeEntryDescription === baseDescription;
  const effectiveHasOverride = hasOverride && !mirrorsBaseForNonDefault;

  const displayedName = effectiveHasOverride
    ? activeEntryName
    : isDefaultLanguage
      ? baseName
      : "";
  const displayedDescription = effectiveHasOverride
    ? activeEntryDescription
    : isDefaultLanguage
      ? baseDescription
      : "";

  useEffect(() => {
    if (normalizedRequestedLanguage !== resolvedActiveLanguage) {
      onActiveLanguageChange(resolvedActiveLanguage);
    }
  }, [
    normalizedRequestedLanguage,
    onActiveLanguageChange,
    resolvedActiveLanguage,
  ]);

  const commitEntries = (nextEntries: LocalizationEntry[]) => {
    onChange(sanitizeLocalizationEntries(nextEntries));
  };

  const updateActiveEntry = (name: string, description: string) => {
    const nextName = typeof name === "string" ? name : "";
    const nextDescription = typeof description === "string" ? description : "";
    const shouldKeepEntry =
      nextName.trim().length > 0 || nextDescription.trim().length > 0;
    const languageKey = normalizedActiveLanguage.toLowerCase();
    const existingIndex = entries.findIndex(
      (entry) => entry.language.toLowerCase() === languageKey,
    );

    if (!shouldKeepEntry) {
      if (existingIndex === -1) return;
      const nextEntries = entries.filter((_, index) => index !== existingIndex);
      commitEntries(nextEntries);
      return;
    }

    if (existingIndex === -1) {
      commitEntries([
        ...entries,
        {
          language: normalizedActiveLanguage,
          name: nextName,
          description: nextDescription,
        },
      ]);
      return;
    }

    const nextEntries = [...entries];
    nextEntries[existingIndex] = {
      ...nextEntries[existingIndex],
      language: normalizedActiveLanguage,
      name: nextName,
      description: nextDescription,
    };
    commitEntries(nextEntries);
  };

  const activeLanguageLabel =
    selectableLanguageOptions.find(
      (option) => option.value === normalizedActiveLanguage,
    )?.label || normalizedActiveLanguage;
  const localizedLanguageSet = useMemo(() => {
    const localized = new Set<string>();
    for (const entry of entries) {
      if (
        entry.name.trim().length > 0 ||
        entry.description.trim().length > 0
      ) {
        localized.add(entry.language.toLowerCase());
      }
    }
    return localized;
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Active Language
        </Label>
        <Select
          value={normalizedActiveLanguage}
          onValueChange={(nextLanguage) => {
            onActiveLanguageChange(nextLanguage);
          }}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select language">
              {activeLanguageLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {selectableLanguageOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                textValue={option.label}
                className="cursor-pointer"
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    {localizedLanguageSet.has(option.value.toLowerCase()) ? (
                      <CheckSquare
                        className="h-4 w-4 text-emerald-500"
                        weight="fill"
                      />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground/70" />
                    )}
                    <span>{option.label}</span>
                  </span>
                  <span
                    className={
                      localizedLanguageSet.has(option.value.toLowerCase())
                        ? "text-[10px] font-semibold uppercase tracking-wide text-emerald-500"
                        : "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70"
                    }
                  >
                    {localizedLanguageSet.has(option.value.toLowerCase())
                      ? "localized"
                      : "empty"}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GlobeHemisphereWest className="h-3.5 w-3.5" />
            Localized
          </span>
          {Array.from(localizedLanguageSet).length > 0 ? (
            selectableLanguageOptions.filter((option) =>
              localizedLanguageSet.has(option.value.toLowerCase()),
            ).map((option) => (
              <span
                key={`locale-chip-${option.value}`}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px]"
              >
                <CheckCircle className="h-3 w-3 text-emerald-500" weight="fill" />
                {option.value}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">none</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {effectiveHasOverride
            ? `${activeLanguageLabel} has custom localization values.`
            : isDefaultLanguage
              ? "Showing your base name and description."
              : "No localization set for this language yet. Enter values to add one."}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold text-foreground/80 block">
            Localized Name
          </Label>
          {effectiveHasOverride && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => updateActiveEntry("", "")}
            >
              Clear Localization
            </Button>
          )}
        </div>
        <Input
          key={`localization-name-${normalizedActiveLanguage}`}
          value={displayedName}
          onChange={(event) => {
            const nextName = event.target.value;
            updateActiveEntry(nextName, displayedDescription);
          }}
          placeholder={baseName || "Localized name"}
          className="cursor-text"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground/80 block">
          Localized Description
        </Label>
        <DescriptionEditor
          key={`localization-description-${normalizedActiveLanguage}`}
          value={displayedDescription}
          onChange={(nextDescription) => {
            updateActiveEntry(displayedName, nextDescription);
          }}
          placeholder={
            baseDescription || "Localized description"
          }
          item={itemContext}
        />
      </div>
    </div>
  );
}
