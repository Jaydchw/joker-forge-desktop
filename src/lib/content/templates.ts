import { useCallback, useEffect, useMemo, useState } from "react";
import { appDataDir, dirname, join } from "@tauri-apps/api/path";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Rule } from "@/components/rule-builder/types";
import {
  getConsumableSetByKey,
  getConsumableSetByValue,
  getRarityByKey,
  getRarityByValue,
} from "@/lib/balatro/balatro-utils";

export type ItemTemplateItemType =
  | "joker"
  | "consumable"
  | "deck"
  | "voucher"
  | "booster"
  | "enhancement"
  | "seal"
  | "edition"
  | "sound"
  | "rarity"
  | "consumableSet";

export type RuleTemplateItemType =
  | "joker"
  | "consumable"
  | "card"
  | "voucher"
  | "deck";

export type TemplateKind = "item" | "rule";

interface TemplateBase {
  id: string;
  name: string;
  kind: TemplateKind;
  itemType: ItemTemplateItemType | RuleTemplateItemType;
  createdAt: number;
  updatedAt: number;
}

export interface ItemTemplateEntry extends TemplateBase {
  kind: "item";
  itemType: ItemTemplateItemType;
  payload: Record<string, unknown>;
}

export interface RuleTemplateEntry extends TemplateBase {
  kind: "rule";
  itemType: RuleTemplateItemType;
  payload: Rule;
}

export type TemplateEntry = ItemTemplateEntry | RuleTemplateEntry;

interface TemplateStore {
  version: 1;
  templates: TemplateEntry[];
}

export interface TemplateBundle {
  format: "jokerforge-template";
  version: 1;
  exportedAt: string;
  templates: TemplateEntry[];
}

const STORAGE_KEY = "joker_forge_template_store";
const LEGACY_STORAGE_FILE_NAME = "joker_forge_templates.json";
const TAURI_STORAGE_DIR_NAME = "joker_forge_storage";
const STORAGE_FILE_NAME = "templates.json";
const TEMPLATE_EVENT_KEY = "joker_forge_template_update";

let tauriStorePathPromise: Promise<{
  rootDir: string;
  currentStorePath: string;
  legacyStorePath: string;
}> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

const DEFAULT_TEMPLATE_STORE: TemplateStore = {
  version: 1,
  templates: [],
};

type TemplateStoreUpdateEventDetail = {
  store: TemplateStore;
  sourceId: string;
};

const ITEM_TEMPLATE_TYPES = new Set<ItemTemplateItemType>([
  "joker",
  "consumable",
  "deck",
  "voucher",
  "booster",
  "enhancement",
  "seal",
  "edition",
  "sound",
  "rarity",
  "consumableSet",
]);

const RULE_TEMPLATE_TYPES = new Set<RuleTemplateItemType>([
  "joker",
  "consumable",
  "card",
  "voucher",
  "deck",
]);

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createTemplateId = (): string =>
  `template_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const isTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(tauriWindow.__TAURI_INTERNALS__ || tauriWindow.__TAURI__);
};

const getTauriStorePaths = async (): Promise<{
  rootDir: string;
  currentStorePath: string;
  legacyStorePath: string;
}> => {
  if (!tauriStorePathPromise) {
    tauriStorePathPromise = appDataDir().then(async (dir) => {
      const rootDir = await join(dir, TAURI_STORAGE_DIR_NAME);
      return {
        rootDir,
        currentStorePath: await join(rootDir, STORAGE_FILE_NAME),
        legacyStorePath: await join(dir, LEGACY_STORAGE_FILE_NAME),
      };
    });
  }
  return tauriStorePathPromise;
};

const ensureTauriStoreDirectory = async (): Promise<void> => {
  const paths = await getTauriStorePaths();
  const parentDir = await dirname(paths.currentStorePath);
  await mkdir(parentDir, { recursive: true });
};

const isTemplateBundleObject = (candidate: unknown): candidate is TemplateBundle => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }
  const value = candidate as Partial<TemplateBundle>;
  return (
    value.format === "jokerforge-template" &&
    value.version === 1 &&
    Array.isArray(value.templates)
  );
};

const toValidItemType = (
  value: unknown,
): ItemTemplateItemType | RuleTemplateItemType | null => {
  if (typeof value !== "string") return null;
  if (ITEM_TEMPLATE_TYPES.has(value as ItemTemplateItemType)) {
    return value as ItemTemplateItemType;
  }
  if (RULE_TEMPLATE_TYPES.has(value as RuleTemplateItemType)) {
    return value as RuleTemplateItemType;
  }
  return null;
};

const sanitizeRulePayload = (value: unknown): Rule => {
  const fallback: Rule = {
    id: crypto.randomUUID(),
    trigger: "on_play",
    blueprintCompatible: true,
    position: { x: 0, y: 0 },
    conditionGroups: [],
    effects: [],
    randomGroups: [],
    loops: [],
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  try {
    const cloned = deepClone(value as Rule);
    if (!cloned.position || typeof cloned.position !== "object") {
      cloned.position = { x: 0, y: 0 };
    }
    if (!Array.isArray(cloned.conditionGroups)) cloned.conditionGroups = [];
    if (!Array.isArray(cloned.effects)) cloned.effects = [];
    if (!Array.isArray(cloned.randomGroups)) cloned.randomGroups = [];
    if (!Array.isArray(cloned.loops)) cloned.loops = [];
    if (typeof cloned.trigger !== "string") cloned.trigger = "on_play";
    if (typeof cloned.blueprintCompatible !== "boolean") {
      cloned.blueprintCompatible = true;
    }
    if (typeof cloned.id !== "string" || !cloned.id.trim()) {
      cloned.id = crypto.randomUUID();
    }
    return cloned;
  } catch {
    return fallback;
  }
};

const sanitizeTemplateEntry = (candidate: unknown): TemplateEntry | null => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const value = candidate as Partial<TemplateEntry>;
  const kind = value.kind;
  const itemType = toValidItemType(value.itemType);

  if ((kind !== "item" && kind !== "rule") || !itemType) return null;

  const now = Date.now();
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;

  const base: TemplateBase = {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : createTemplateId(),
    name,
    kind,
    itemType,
    createdAt:
      typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
        ? value.createdAt
        : now,
    updatedAt:
      typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
        ? value.updatedAt
        : now,
  };

  if (kind === "item") {
    if (!ITEM_TEMPLATE_TYPES.has(itemType as ItemTemplateItemType)) return null;
    const payload =
      value.payload && typeof value.payload === "object" && !Array.isArray(value.payload)
        ? deepClone(value.payload as Record<string, unknown>)
        : {};
    return {
      ...base,
      kind: "item",
      itemType: itemType as ItemTemplateItemType,
      payload,
    };
  }

  if (!RULE_TEMPLATE_TYPES.has(itemType as RuleTemplateItemType)) return null;

  return {
    ...base,
    kind: "rule",
    itemType: itemType as RuleTemplateItemType,
    payload: sanitizeRulePayload(value.payload),
  };
};

const sanitizeTemplateStore = (candidate: unknown): TemplateStore => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return DEFAULT_TEMPLATE_STORE;
  }

  const value = candidate as Partial<TemplateStore>;
  const templates = Array.isArray(value.templates)
    ? value.templates
        .map((entry) => sanitizeTemplateEntry(entry))
        .filter((entry): entry is TemplateEntry => entry !== null)
    : [];

  return {
    version: 1,
    templates,
  };
};

const parseRawTemplateText = (text: string): TemplateStore | null => {
  try {
    const parsed = JSON.parse(text);

    if (isTemplateBundleObject(parsed)) {
      return sanitizeTemplateStore({ templates: parsed.templates });
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Partial<TemplateStore>).templates)
    ) {
      return sanitizeTemplateStore(parsed);
    }

    if (Array.isArray(parsed)) {
      return sanitizeTemplateStore({ templates: parsed });
    }

    const maybeTemplate = sanitizeTemplateEntry(parsed);
    if (maybeTemplate) {
      return sanitizeTemplateStore({ templates: [maybeTemplate] });
    }

    return null;
  } catch {
    return null;
  }
};

const persistStore = async (store: TemplateStore): Promise<void> => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  if (!isTauriRuntime()) return;

  const { currentStorePath } = await getTauriStorePaths();
  await ensureTauriStoreDirectory();
  await writeTextFile(currentStorePath, JSON.stringify(store));
};

const loadStoreFromDisk = async (): Promise<TemplateStore> => {
  if (isTauriRuntime()) {
    try {
      const { currentStorePath } = await getTauriStorePaths();
      const fileContent = await readTextFile(currentStorePath);
      return sanitizeTemplateStore(JSON.parse(fileContent));
    } catch {
      try {
        const { legacyStorePath } = await getTauriStorePaths();
        const legacyContent = await readTextFile(legacyStorePath);
        const migrated =
          parseRawTemplateText(legacyContent) ?? DEFAULT_TEMPLATE_STORE;
        await persistStore(migrated);
        return migrated;
      } catch {
        // fallback to local storage below
      }
    }
  }

  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parseRawTemplateText(raw);
      if (parsed) return parsed;
    }
  }

  return DEFAULT_TEMPLATE_STORE;
};

const dispatchTemplateStoreEvent = (store: TemplateStore, sourceId: string) => {
  if (typeof window === "undefined") return;
  const detail: TemplateStoreUpdateEventDetail = { store, sourceId };
  window.dispatchEvent(new CustomEvent(TEMPLATE_EVENT_KEY, { detail }));
};

const normalizeTemplateName = (value: string, fallback: string): string => {
  const next = value.trim();
  return next || fallback;
};

const sanitizeItemPayloadForTemplate = (
  payload: object,
): Record<string, unknown> => {
  const cloned = deepClone(payload);
  const normalized = cloned as Record<string, unknown>;
  delete normalized.id;
  delete normalized.orderValue;
  return normalized;
};

export const buildTemplateBundle = (templates: TemplateEntry[]): TemplateBundle => ({
  format: "jokerforge-template",
  version: 1,
  exportedAt: new Date().toISOString(),
  templates: templates.map((template) => deepClone(template)),
});

export const serializeTemplateBundle = (templates: TemplateEntry[]): string =>
  JSON.stringify(buildTemplateBundle(templates), null, 2);

export const parseTemplateBundleText = (text: string): TemplateEntry[] => {
  const parsed = parseRawTemplateText(text);
  if (!parsed) {
    throw new Error(
      "Unsupported template file. Expected a .jftemplate bundle exported by Joker Forge.",
    );
  }
  return parsed.templates;
};

export const instantiateItemFromTemplate = <T extends object>(
  baseItem: T,
  template: ItemTemplateEntry,
): T => {
  const baseRecord = baseItem as Record<string, unknown>;
  const templated = deepClone(template.payload) as Record<string, unknown>;
  delete templated.id;
  delete templated.orderValue;

  const merged: Record<string, unknown> = { ...baseRecord };

  // Never let null/undefined template fields wipe out valid base defaults.
  Object.entries(templated).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    merged[key] = value;
  });

  // Explicit fallback defaults for common dependent/custom fields.
  const resolveRarityValue = (candidate: unknown): number | string | null => {
    if (
      candidate === null ||
      candidate === undefined ||
      candidate === ""
    ) {
      return null;
    }

    if (
      (typeof candidate === "number" || typeof candidate === "string") &&
      getRarityByValue(candidate as number | string)
    ) {
      return candidate as number | string;
    }

    if (typeof candidate === "string") {
      if (getRarityByKey(candidate)) {
        return candidate;
      }

      // Imported templates may include a different mod prefix (e.g. oldmod_my_rarity).
      // If the suffix key exists locally, remap to that local rarity key.
      const underscoreIndex = candidate.indexOf("_");
      if (underscoreIndex >= 0 && underscoreIndex < candidate.length - 1) {
        const localKeyCandidate = candidate.slice(underscoreIndex + 1);
        if (getRarityByKey(localKeyCandidate)) {
          return localKeyCandidate;
        }
      }
    }

    return null;
  };

  const resolvedRarity =
    resolveRarityValue(merged.rarity) ?? resolveRarityValue(baseRecord.rarity);
  if (resolvedRarity !== null) {
    merged.rarity = resolvedRarity;
  } else {
    merged.rarity = 1; // Common
  }

  const resolveSetValue = (candidate: unknown): string | null => {
    if (typeof candidate !== "string" || !candidate.trim()) {
      return null;
    }

    if (getConsumableSetByValue(candidate)) {
      return candidate;
    }

    if (getConsumableSetByKey(candidate)) {
      return candidate;
    }

    // Imported templates may include a different mod prefix (e.g. oldmod_custom_set).
    const underscoreIndex = candidate.indexOf("_");
    if (underscoreIndex >= 0 && underscoreIndex < candidate.length - 1) {
      const localKeyCandidate = candidate.slice(underscoreIndex + 1);
      if (getConsumableSetByKey(localKeyCandidate)) {
        return localKeyCandidate;
      }
    }

    return null;
  };

  const resolvedSet =
    resolveSetValue(merged.set) ?? resolveSetValue(baseRecord.set);
  if (resolvedSet) {
    merged.set = resolvedSet;
  } else if ("set" in merged || "set" in baseRecord) {
    merged.set = "Tarot";
  }

  if (merged.variable === null || merged.variable === undefined) {
    merged.variable =
      typeof baseRecord.variable === "string" ? baseRecord.variable : "";
  }

  return {
    ...merged,
    id: baseRecord.id,
    orderValue: baseRecord.orderValue,
    objectType: baseRecord.objectType,
  } as T;
};

const remapRuleIds = (rule: Rule): Rule => {
  const nextRule = deepClone(rule);
  nextRule.id = crypto.randomUUID();
  nextRule.position = { x: 0, y: 0 };

  nextRule.conditionGroups = nextRule.conditionGroups.map((group) => ({
    ...group,
    id: crypto.randomUUID(),
    conditions: group.conditions.map((condition) => ({
      ...condition,
      id: crypto.randomUUID(),
    })),
  }));

  nextRule.effects = nextRule.effects.map((effect) => ({
    ...effect,
    id: crypto.randomUUID(),
  }));

  nextRule.randomGroups = nextRule.randomGroups.map((group) => ({
    ...group,
    id: crypto.randomUUID(),
    effects: group.effects.map((effect) => ({
      ...effect,
      id: crypto.randomUUID(),
    })),
  }));

  nextRule.loops = nextRule.loops.map((group) => ({
    ...group,
    id: crypto.randomUUID(),
    effects: group.effects.map((effect) => ({
      ...effect,
      id: crypto.randomUUID(),
    })),
  }));

  return nextRule;
};

export const instantiateRuleFromTemplate = (
  template: RuleTemplateEntry,
  position: { x: number; y: number },
): Rule => {
  const rule = remapRuleIds(template.payload);
  rule.position = position;
  return rule;
};

export interface TemplateStoreApi {
  isHydrating: boolean;
  templates: TemplateEntry[];
  itemTemplates: ItemTemplateEntry[];
  ruleTemplates: RuleTemplateEntry[];
  createItemTemplate: (input: {
    name: string;
    itemType: ItemTemplateItemType;
    payload: object;
  }) => void;
  createRuleTemplate: (input: {
    name: string;
    itemType: RuleTemplateItemType;
    rule: Rule;
  }) => void;
  deleteTemplate: (templateId: string) => void;
  deleteTemplates: (templateIds: string[]) => void;
  updateTemplateName: (templateId: string, nextName: string) => void;
  updateItemTemplate: (
    templateId: string,
    input: { name: string; payload: object },
  ) => void;
  duplicateTemplate: (templateId: string) => void;
  upsertImportedTemplates: (templates: TemplateEntry[]) => number;
  getItemTemplatesForType: (itemType: ItemTemplateItemType) => ItemTemplateEntry[];
  getRuleTemplatesForType: (itemType: RuleTemplateItemType) => RuleTemplateEntry[];
}

export const useTemplateStore = (): TemplateStoreApi => {
  const [store, setStore] = useState<TemplateStore>(DEFAULT_TEMPLATE_STORE);
  const [isHydrating, setIsHydrating] = useState(true);

  const sourceId = useMemo(
    () => `template_source_${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  const saveStore = useCallback(
    (nextStore: TemplateStore) => {
      persistQueue = persistQueue
        .then(() => persistStore(nextStore))
        .catch((error) => {
          console.error("Failed to persist templates", error);
        });
      queueMicrotask(() => {
        dispatchTemplateStoreEvent(nextStore, sourceId);
      });
    },
    [sourceId],
  );

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      const nextStore = await loadStoreFromDisk();
      if (!isMounted) return;
      setStore(nextStore);
      setIsHydrating(false);
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStoreUpdate = (event: Event) => {
      const custom = event as CustomEvent<TemplateStoreUpdateEventDetail>;
      if (!custom.detail || custom.detail.sourceId === sourceId) return;
      setStore(custom.detail.store);
    };

    window.addEventListener(TEMPLATE_EVENT_KEY, handleStoreUpdate);
    return () => {
      window.removeEventListener(TEMPLATE_EVENT_KEY, handleStoreUpdate);
    };
  }, [sourceId]);

  const createItemTemplate = useCallback(
    (input: {
      name: string;
      itemType: ItemTemplateItemType;
      payload: object;
    }) => {
      const now = Date.now();
      const nextTemplate: ItemTemplateEntry = {
        id: createTemplateId(),
        kind: "item",
        itemType: input.itemType,
        name: normalizeTemplateName(input.name, "New Item Template"),
        createdAt: now,
        updatedAt: now,
        payload: sanitizeItemPayloadForTemplate(input.payload),
      };

      setStore((prev) => {
        const next = {
          ...prev,
          templates: [nextTemplate, ...prev.templates],
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const createRuleTemplate = useCallback(
    (input: { name: string; itemType: RuleTemplateItemType; rule: Rule }) => {
      const now = Date.now();
      const nextTemplate: RuleTemplateEntry = {
        id: createTemplateId(),
        kind: "rule",
        itemType: input.itemType,
        name: normalizeTemplateName(input.name, "New Rule Template"),
        createdAt: now,
        updatedAt: now,
        payload: sanitizeRulePayload(input.rule),
      };

      setStore((prev) => {
        const next = {
          ...prev,
          templates: [nextTemplate, ...prev.templates],
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const deleteTemplate = useCallback(
    (templateId: string) => {
      setStore((prev) => {
        const next = {
          ...prev,
          templates: prev.templates.filter((template) => template.id !== templateId),
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const deleteTemplates = useCallback(
    (templateIds: string[]) => {
      const idSet = new Set(templateIds);
      setStore((prev) => {
        const next = {
          ...prev,
          templates: prev.templates.filter((template) => !idSet.has(template.id)),
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const updateTemplateName = useCallback(
    (templateId: string, nextName: string) => {
      const normalized = normalizeTemplateName(nextName, "");
      if (!normalized) return;
      setStore((prev) => {
        const next = {
          ...prev,
          templates: prev.templates.map((template) =>
            template.id === templateId
              ? { ...template, name: normalized, updatedAt: Date.now() }
              : template,
          ),
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const updateItemTemplate = useCallback(
    (templateId: string, input: { name: string; payload: object }) => {
      const normalized = normalizeTemplateName(input.name, "");
      if (!normalized) return;
      setStore((prev) => {
        const next = {
          ...prev,
          templates: prev.templates.map((template) => {
            if (template.id !== templateId || template.kind !== "item") return template;
            return {
              ...template,
              name: normalized,
              payload: sanitizeItemPayloadForTemplate(input.payload),
              updatedAt: Date.now(),
            } satisfies ItemTemplateEntry;
          }),
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const duplicateTemplate = useCallback(
    (templateId: string) => {
      setStore((prev) => {
        const source = prev.templates.find((entry) => entry.id === templateId);
        if (!source) return prev;
        const now = Date.now();
        const duplicated: TemplateEntry = {
          ...deepClone(source),
          id: createTemplateId(),
          name: `${source.name} Copy`,
          createdAt: now,
          updatedAt: now,
        };
        const next = {
          ...prev,
          templates: [duplicated, ...prev.templates],
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });
    },
    [saveStore],
  );

  const upsertImportedTemplates = useCallback(
    (templates: TemplateEntry[]): number => {
      if (templates.length === 0) return 0;

      let importedCount = 0;
      setStore((prev) => {
        const now = Date.now();
        const existing = [...prev.templates];

        templates.forEach((template) => {
          const baseName = template.name.trim().toLowerCase();
          const duplicateIndex = existing.findIndex(
            (entry) =>
              entry.kind === template.kind &&
              entry.itemType === template.itemType &&
              entry.name.trim().toLowerCase() === baseName,
          );

          const importedTemplate: TemplateEntry = {
            ...deepClone(template),
            id: createTemplateId(),
            createdAt:
              typeof template.createdAt === "number" ? template.createdAt : now,
            updatedAt: now,
            name: normalizeTemplateName(template.name, "Imported Template"),
          } as TemplateEntry;

          if (duplicateIndex >= 0) {
            existing.splice(duplicateIndex, 1, importedTemplate);
          } else {
            existing.unshift(importedTemplate);
          }
          importedCount += 1;
        });

        const next = {
          ...prev,
          templates: existing,
        } satisfies TemplateStore;
        saveStore(next);
        return next;
      });

      return importedCount;
    },
    [saveStore],
  );

  const itemTemplates = useMemo(
    () => store.templates.filter((template): template is ItemTemplateEntry => template.kind === "item"),
    [store.templates],
  );

  const ruleTemplates = useMemo(
    () => store.templates.filter((template): template is RuleTemplateEntry => template.kind === "rule"),
    [store.templates],
  );

  const getItemTemplatesForType = useCallback(
    (itemType: ItemTemplateItemType) =>
      itemTemplates.filter((template) => template.itemType === itemType),
    [itemTemplates],
  );

  const getRuleTemplatesForType = useCallback(
    (itemType: RuleTemplateItemType) =>
      ruleTemplates.filter((template) => template.itemType === itemType),
    [ruleTemplates],
  );

  return {
    isHydrating,
    templates: store.templates,
    itemTemplates,
    ruleTemplates,
    createItemTemplate,
    createRuleTemplate,
    deleteTemplate,
    deleteTemplates,
    updateTemplateName,
    updateItemTemplate,
    duplicateTemplate,
    upsertImportedTemplates,
    getItemTemplatesForType,
    getRuleTemplatesForType,
  };
};

export const TEMPLATE_FILE_EXTENSION = "jftemplate";
