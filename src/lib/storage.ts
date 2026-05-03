import { useState, useEffect, useCallback, useRef } from "react";
import { appDataDir, dirname, join } from "@tauri-apps/api/path";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  JokerData,
  ConsumableData,
  DeckData,
  VoucherData,
  BoosterData,
  SealData,
  EditionData,
  EnhancementData,
  SoundData,
  RarityData,
  ConsumableSetData,
  ModMetadata,
} from "@/lib/types";
import { updateDataRegistry } from "@/lib/balatro-utils";
import { pushGlobalAlert } from "@/lib/global-alerts-bus";
import { clearThemeStorage } from "./theme-manager";

export interface ProjectStats {
  jokers: number;
  consumables: number;
  decks: number;
  enhancements: number;
  seals: number;
  editions: number;
  sounds: number;
  vouchers: number;
  boosters: number;
  rarities: number;
  consumableSets: number;
}

export type RecentActivityEditor = "info" | "rules";

export interface RecentActivityTarget {
  path: string;
  itemId?: string;
  editor?: RecentActivityEditor;
}

export interface RecentActivityEntry {
  id: string;
  message: string;
  timestamp: number;
  target?: RecentActivityTarget;
}

export interface ProjectData {
  stats: ProjectStats;
  metadata: ModMetadata;
  recentActivity: RecentActivityEntry[];
  jokers: JokerData[];
  consumables: ConsumableData[];
  rarities: RarityData[];
  consumableSets: ConsumableSetData[];
  decks: DeckData[];
  vouchers: VoucherData[];
  boosters: BoosterData[];
  seals: SealData[];
  editions: EditionData[];
  enhancements: EnhancementData[];
  sounds: SoundData[];
}

interface ProjectStore {
  version: 2;
  currentProjectId: string;
  projects: Record<string, ProjectData>;
}

const STORAGE_KEY = "joker_forge_project_data";
const STORAGE_FILE_NAME = "joker_forge_project_data.json";
const EVENT_KEY = "joker_forge_update";
const CONFIRM_DELETE_KEY = "joker_forge_confirm_delete";
const UI_SCALE_KEY = "app-ui-scale";
const BALATRO_PATH_KEY = "joker_forge_balatro_path";
const BALATRO_AUTOFIND_KEY = "joker_forge_balatro_autofind";
const BALATRO_AUTOFIND_ALERT_KEY = "joker_forge_balatro_autofind_alert";
const SPLIT_LOCALIZATION_EXPORT_KEY = "joker_forge_split_localization_export";
const EXPORT_DESTINATION_MODE_KEY = "joker_forge_export_destination_mode";
const JOKERFORGE_EXPORT_AS_JSON_KEY = "joker_forge_export_as_json";
const THEME_PREFERENCE_KEY = "joker_forge_theme_preference";
const THEME_CHANGE_EVENT = "joker_forge_theme_change";
const STORAGE_ERROR_ALERT_THROTTLE_MS = 4000;
const RECENT_ACTIVITY_LIMIT = 10;

let lastStorageErrorAlertAt = 0;
let tauriStorePathPromise: Promise<string> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

type StoreUpdateEventDetail = {
  store: ProjectStore;
  sourceId: string;
};

const isTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(tauriWindow.__TAURI_INTERNALS__ || tauriWindow.__TAURI__);
};

const getTauriStorePath = async (): Promise<string> => {
  if (!tauriStorePathPromise) {
    tauriStorePathPromise = appDataDir().then((dir) =>
      join(dir, STORAGE_FILE_NAME),
    );
  }
  return tauriStorePathPromise;
};

const ensureTauriStoreDirectory = async (): Promise<void> => {
  const storePath = await getTauriStorePath();
  const parentDir = await dirname(storePath);
  await mkdir(parentDir, { recursive: true });
};

const isQuotaExceededError = (error: unknown): boolean => {
  if (!(error instanceof DOMException)) return false;
  return error.name === "QuotaExceededError" || error.code === 22;
};

const maybeShowStorageErrorAlert = (error: unknown) => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastStorageErrorAlertAt < STORAGE_ERROR_ALERT_THROTTLE_MS) {
    return;
  }
  lastStorageErrorAlertAt = now;

  if (isQuotaExceededError(error)) {
    pushGlobalAlert({
      type: "danger",
      title: "Save Failed",
      message:
        "Project data is too large for browser storage. Import could not be fully saved. Remove large embedded assets or reduce project size and try again.",
    });
    return;
  }

  pushGlobalAlert({
    type: "danger",
    title: "Save Failed",
    message: "Failed to save project data to local storage.",
  });
};

export type ExportDestinationMode = "downloads" | "balatro-mods";
export type ThemePreference = "light" | "dark";

const DEFAULT_STATS: ProjectStats = {
  jokers: 0,
  consumables: 0,
  decks: 0,
  enhancements: 0,
  seals: 0,
  editions: 0,
  sounds: 0,
  vouchers: 0,
  boosters: 0,
  rarities: 0,
  consumableSets: 0,
};

const DEFAULT_METADATA: ModMetadata = {
  id: "my_custom_mod",
  name: "My Custom Mod",
  author: ["Anonymous"],
  description: "A Balatro mod created with Joker Forge.",
  prefix: "jkr",
  version: "1.0.0",
  main_file: "main.lua",
  priority: 0,
  badge_colour: "4584fa",
  badge_text_colour: "ffffff",
  display_name: "My Mod",
  dependencies: [],
  conflicts: [],
  provides: [],
  iconImage: "",
  gameImage: "",
  hasUserUploadedIcon: false,
  hasUserUploadedGameIcon: false,
};

const DEFAULT_DATA: ProjectData = {
  stats: DEFAULT_STATS,
  metadata: DEFAULT_METADATA,
  recentActivity: [],
  jokers: [],
  consumables: [],
  rarities: [],
  consumableSets: [],
  decks: [],
  vouchers: [],
  boosters: [],
  seals: [],
  editions: [],
  enhancements: [],
  sounds: [],
};

type TrackableCollectionKey =
  | "jokers"
  | "consumables"
  | "rarities"
  | "consumableSets"
  | "decks"
  | "vouchers"
  | "boosters"
  | "seals"
  | "editions"
  | "enhancements"
  | "sounds";

type TrackableItem = { id: string } & Record<string, unknown>;

type CollectionActivityConfig = {
  path: string;
  singular: string;
  plural: string;
  supportsRules: boolean;
  nameKey: string;
};

const COLLECTION_ACTIVITY_CONFIG: Record<
  TrackableCollectionKey,
  CollectionActivityConfig
> = {
  jokers: {
    path: "/jokers",
    singular: "Joker",
    plural: "Jokers",
    supportsRules: true,
    nameKey: "name",
  },
  consumables: {
    path: "/consumables",
    singular: "Consumable",
    plural: "Consumables",
    supportsRules: true,
    nameKey: "name",
  },
  rarities: {
    path: "/rarities",
    singular: "Rarity",
    plural: "Rarities",
    supportsRules: false,
    nameKey: "name",
  },
  consumableSets: {
    path: "/consumable-sets",
    singular: "Consumable Set",
    plural: "Consumable Sets",
    supportsRules: false,
    nameKey: "name",
  },
  decks: {
    path: "/decks",
    singular: "Deck",
    plural: "Decks",
    supportsRules: true,
    nameKey: "name",
  },
  vouchers: {
    path: "/vouchers",
    singular: "Voucher",
    plural: "Vouchers",
    supportsRules: true,
    nameKey: "name",
  },
  boosters: {
    path: "/boosters",
    singular: "Booster",
    plural: "Boosters",
    supportsRules: false,
    nameKey: "name",
  },
  seals: {
    path: "/seals",
    singular: "Seal",
    plural: "Seals",
    supportsRules: true,
    nameKey: "name",
  },
  editions: {
    path: "/editions",
    singular: "Edition",
    plural: "Editions",
    supportsRules: true,
    nameKey: "name",
  },
  enhancements: {
    path: "/enhancements",
    singular: "Enhancement",
    plural: "Enhancements",
    supportsRules: true,
    nameKey: "name",
  },
  sounds: {
    path: "/sounds",
    singular: "Sound",
    plural: "Sounds",
    supportsRules: false,
    nameKey: "key",
  },
};

const isTrackableCollectionKey = (
  key: keyof ProjectData,
): key is TrackableCollectionKey =>
  Object.prototype.hasOwnProperty.call(COLLECTION_ACTIVITY_CONFIG, key);

const toTrackableItems = (value: unknown): TrackableItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is TrackableItem =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string",
    )
    .map((item) => item);
};

const areValuesEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;

  const isObjectLike = (value: unknown): boolean =>
    value !== null && typeof value === "object";

  if (isObjectLike(a) || isObjectLike(b)) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  return false;
};

const formatFieldLabel = (key: string): string =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();

const formatFieldSummary = (keys: string[]): string => {
  if (keys.length === 0) return "";
  if (keys.length === 1) return `${formatFieldLabel(keys[0])} changed`;

  const preview = keys.slice(0, 3).map(formatFieldLabel).join(", ");
  const remaining = keys.length - 3;
  const tail = remaining > 0 ? `, +${remaining} more` : "";
  return `${keys.length} fields changed (${preview}${tail})`;
};

const getItemDisplayName = (
  item: TrackableItem | undefined,
  config: CollectionActivityConfig,
): string => {
  if (!item) return `Unknown ${config.singular}`;
  const nameCandidate = item[config.nameKey];
  if (typeof nameCandidate === "string" && nameCandidate.trim()) {
    return nameCandidate.trim();
  }
  if (typeof item.name === "string" && item.name.trim()) return item.name.trim();
  if (typeof item.objectKey === "string" && item.objectKey.trim()) {
    return item.objectKey.trim();
  }
  return item.id;
};

const createActivityEntry = (input: {
  message: string;
  target?: RecentActivityTarget;
  timestamp?: number;
}): RecentActivityEntry => ({
  id: createRecentActivityId(),
  message: input.message,
  timestamp:
    typeof input.timestamp === "number" && Number.isFinite(input.timestamp)
      ? input.timestamp
      : Date.now(),
  ...(input.target ? { target: input.target } : {}),
});

const prependRecentActivity = (
  existing: RecentActivityEntry[],
  entries: RecentActivityEntry[],
): RecentActivityEntry[] =>
  entries.length === 0
    ? existing
    : [...entries, ...existing].slice(0, RECENT_ACTIVITY_LIMIT);

const buildCollectionActivityEntries = (
  key: TrackableCollectionKey,
  previousItems: unknown,
  nextItems: unknown,
): RecentActivityEntry[] => {
  const config = COLLECTION_ACTIVITY_CONFIG[key];
  const previous = toTrackableItems(previousItems);
  const next = toTrackableItems(nextItems);

  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));

  const added = next.filter((item) => !previousById.has(item.id));
  const deleted = previous.filter((item) => !nextById.has(item.id));

  const updated = next
    .map((item) => {
      const before = previousById.get(item.id);
      if (!before) return null;

      const keys = Array.from(
        new Set([...Object.keys(before), ...Object.keys(item)]),
      ).filter((field) => field !== "id");

      const changedFields = keys.filter(
        (field) => !areValuesEqual(before[field], item[field]),
      );

      if (changedFields.length === 0) return null;

      const rulesChanged = changedFields.includes("rules");
      const nonRuleChanges = changedFields.filter((field) => field !== "rules");

      const beforeRules = Array.isArray(before.rules)
        ? before.rules.length
        : 0;
      const afterRules = Array.isArray(item.rules) ? item.rules.length : 0;
      const addedRules = Math.max(0, afterRules - beforeRules);
      const deletedRules = Math.max(0, beforeRules - afterRules);
      const ruleSummary = rulesChanged
        ? addedRules > 0 || deletedRules > 0
          ? `rules +${addedRules}/-${deletedRules}`
          : "rules modified"
        : "";

      const totalChangeCount = nonRuleChanges.length + (rulesChanged ? 1 : 0);
      const itemName = getItemDisplayName(item, config);
      const editor: RecentActivityEditor =
        rulesChanged && nonRuleChanges.length === 0 && config.supportsRules
          ? "rules"
          : "info";

      const message =
        editor === "rules"
          ? `Rules for ${config.singular} "${itemName}" changed (${ruleSummary})`
          : totalChangeCount === 1
            ? `Info for ${config.singular} "${itemName}" changed (${formatFieldSummary(nonRuleChanges) || ruleSummary})`
            : `Info for ${config.singular} "${itemName}" changed (${totalChangeCount} changes: ${[formatFieldSummary(nonRuleChanges), ruleSummary].filter(Boolean).join("; ")})`;

      return createActivityEntry({
        message,
        target: {
          path: config.path,
          itemId: item.id,
          editor,
        },
      });
    })
    .filter((entry): entry is RecentActivityEntry => entry !== null);

  if (added.length === 0 && deleted.length === 0 && updated.length === 0) {
    return [];
  }

  if (added.length > 0 && deleted.length === 0 && updated.length === 0) {
    if (added.length === 1) {
      const addedItem = added[0];
      return [
        createActivityEntry({
          message: `${config.singular} "${getItemDisplayName(addedItem, config)}" added`,
          target: {
            path: config.path,
            itemId: addedItem.id,
            editor: "info",
          },
        }),
      ];
    }
    return [
      createActivityEntry({
        message: `${added.length} ${config.plural} added`,
        target: { path: config.path },
      }),
    ];
  }

  if (deleted.length > 0 && added.length === 0 && updated.length === 0) {
    if (deleted.length === 1) {
      const deletedItem = deleted[0];
      return [
        createActivityEntry({
          message: `${config.singular} "${getItemDisplayName(deletedItem, config)}" deleted`,
          target: { path: config.path },
        }),
      ];
    }
    return [
      createActivityEntry({
        message: `${deleted.length} ${config.plural} deleted`,
        target: { path: config.path },
      }),
    ];
  }

  if (updated.length > 0 && added.length === 0 && deleted.length === 0) {
    if (updated.length === 1) {
      return updated;
    }
    return [
      createActivityEntry({
        message: `${updated.length} ${config.plural} changed`,
        target: { path: config.path },
      }),
    ];
  }

  return [
    createActivityEntry({
      message: `${config.plural} updated (${added.length} added, ${deleted.length} deleted, ${updated.length} changed)`,
      target: { path: config.path },
    }),
  ];
};

const buildMetadataActivityEntry = (
  previousMetadata: ModMetadata,
  nextMetadata: ModMetadata,
): RecentActivityEntry | null => {
  const previousRecord = previousMetadata as unknown as Record<string, unknown>;
  const nextRecord = nextMetadata as unknown as Record<string, unknown>;
  const changedKeys = Array.from(
    new Set([...Object.keys(previousMetadata), ...Object.keys(nextMetadata)]),
  ).filter((field) => !areValuesEqual(previousRecord[field], nextRecord[field]));

  if (changedKeys.length === 0) return null;

  const message =
    changedKeys.length === 1
      ? `Project metadata changed (${formatFieldSummary(changedKeys)})`
      : `Project metadata changed (${changedKeys.length} changes: ${formatFieldSummary(changedKeys)})`;

  return createActivityEntry({
    message,
    target: { path: "/metadata", editor: "info" },
  });
};

const createDefaultStore = (): ProjectStore => ({
  version: 2,
  currentProjectId: DEFAULT_METADATA.id,
  projects: { [DEFAULT_METADATA.id]: DEFAULT_DATA },
});

// --- Sanitization Logic ---

const forceStringArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val.trim() !== "") return [val];
  return [];
};

const createRecentActivityId = (): string =>
  `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const sanitizeRecentActivity = (value: unknown): RecentActivityEntry[] => {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((entry, index): RecentActivityEntry | null => {
      if (typeof entry === "string") {
        const message = entry.trim();
        if (!message) return null;
        return {
          id: `legacy_activity_${index}`,
          message,
          timestamp: Date.now(),
        };
      }

      if (!entry || typeof entry !== "object") return null;

      const obj = entry as Partial<RecentActivityEntry> & {
        target?: Partial<RecentActivityTarget>;
      };
      const message =
        typeof obj.message === "string" ? obj.message.trim() : "";
      if (!message) return null;

      const maybeTarget = obj.target;
      const hasValidTarget =
        maybeTarget &&
        typeof maybeTarget.path === "string" &&
        maybeTarget.path.trim();

      const maybeItemId =
        maybeTarget &&
        typeof maybeTarget.itemId === "string" &&
        maybeTarget.itemId.trim()
          ? maybeTarget.itemId
          : undefined;
      const maybeEditor =
        maybeTarget &&
        (maybeTarget.editor === "info" || maybeTarget.editor === "rules")
          ? maybeTarget.editor
          : undefined;

      return {
        id:
          typeof obj.id === "string" && obj.id.trim()
            ? obj.id
            : `legacy_activity_${index}`,
        message,
        timestamp:
          typeof obj.timestamp === "number" && Number.isFinite(obj.timestamp)
            ? obj.timestamp
            : Date.now(),
        ...(hasValidTarget
          ? {
              target: {
                path: maybeTarget.path as string,
                ...(maybeItemId ? { itemId: maybeItemId } : {}),
                ...(maybeEditor ? { editor: maybeEditor } : {}),
              },
            }
          : {}),
      };
    })
    .filter((entry): entry is RecentActivityEntry => entry !== null);

  return normalized.slice(0, RECENT_ACTIVITY_LIMIT);
};

const sanitizeMetadata = (input: any): ModMetadata => {
  if (!input || typeof input !== "object") return DEFAULT_METADATA;

  return {
    ...DEFAULT_METADATA,
    ...input,
    // Fix string vs array mismatches from old saves
    author: forceStringArray(input.author || DEFAULT_METADATA.author),
    dependencies: forceStringArray(input.dependencies),
    conflicts: forceStringArray(input.conflicts),
    provides: forceStringArray(input.provides),
    // Ensure numeric types
    priority:
      typeof input.priority === "number"
        ? input.priority
        : parseInt(input.priority) || 0,
  };
};

const sanitizeProjectData = (input: any): ProjectData => {
  if (!input || typeof input !== "object") return DEFAULT_DATA;

  const toArray = <T>(val: T[] | undefined) => (Array.isArray(val) ? val : []);

  return {
    ...DEFAULT_DATA,
    ...input,
    metadata: sanitizeMetadata(input.metadata),
    stats: { ...DEFAULT_DATA.stats, ...(input.stats || {}) },
    recentActivity: sanitizeRecentActivity(input.recentActivity),
    jokers: toArray(input.jokers),
    consumables: toArray(input.consumables),
    rarities: toArray(input.rarities),
    consumableSets: toArray(input.consumableSets),
    decks: toArray(input.decks),
    vouchers: toArray(input.vouchers),
    boosters: toArray(input.boosters),
    seals: toArray(input.seals),
    editions: toArray(input.editions),
    enhancements: toArray(input.enhancements),
    sounds: toArray(input.sounds),
  };
};

const ensureUniqueProjectId = (
  baseId: string,
  projects: Record<string, ProjectData>,
) => {
  if (!projects[baseId]) return baseId;
  let suffix = 2;
  let nextId = `${baseId}_${suffix}`;
  while (projects[nextId]) {
    suffix += 1;
    nextId = `${baseId}_${suffix}`;
  }
  return nextId;
};

const sanitizeStoreFromUnknown = (parsed: unknown): ProjectStore => {
  if (!parsed || typeof parsed !== "object") return createDefaultStore();

  const parsedObject = parsed as {
    version?: unknown;
    projects?: unknown;
    currentProjectId?: unknown;
    metadata?: unknown;
  };

  if (
    parsedObject.version === 2 &&
    parsedObject.projects &&
    typeof parsedObject.currentProjectId === "string"
  ) {
    const sanitizedProjects: Record<string, ProjectData> = {};
    Object.entries(
      parsedObject.projects as Record<string, ProjectData>,
    ).forEach(([key, value]) => {
      const sanitized = sanitizeProjectData(value);
      sanitizedProjects[key] = {
        ...sanitized,
        metadata: { ...sanitized.metadata, id: key },
      };
    });

    const fallbackId = Object.keys(sanitizedProjects)[0];
    return {
      version: 2,
      currentProjectId:
        parsedObject.currentProjectId &&
        sanitizedProjects[parsedObject.currentProjectId]
          ? parsedObject.currentProjectId
          : fallbackId || DEFAULT_METADATA.id,
      projects:
        Object.keys(sanitizedProjects).length > 0
          ? sanitizedProjects
          : { [DEFAULT_METADATA.id]: DEFAULT_DATA },
    };
  }

  if (parsedObject.metadata) {
    const legacyProject = sanitizeProjectData(parsedObject);
    const legacyId = legacyProject.metadata.id || DEFAULT_METADATA.id;
    return {
      version: 2,
      currentProjectId: legacyId,
      projects: { [legacyId]: legacyProject },
    };
  }

  return createDefaultStore();
};

const loadStoreFromLocalStorage = (): ProjectStore => {
  if (typeof window === "undefined") {
    return createDefaultStore();
  }

  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (!item) return createDefaultStore();
    return sanitizeStoreFromUnknown(JSON.parse(item));
  } catch (error) {
    console.warn("Error reading/sanitizing localStorage", error);
    return createDefaultStore();
  }
};

const loadStoreFromTauriFile = async (): Promise<ProjectStore | null> => {
  if (!isTauriRuntime()) return null;

  try {
    const path = await getTauriStorePath();
    const raw = await readTextFile(path);
    return sanitizeStoreFromUnknown(JSON.parse(raw));
  } catch {
    return null;
  }
};

const loadStoredStore = async (): Promise<ProjectStore> => {
  const tauriStore = await loadStoreFromTauriFile();
  if (tauriStore) return tauriStore;
  return loadStoreFromLocalStorage();
};

const getStoredStore = (): ProjectStore => loadStoreFromLocalStorage();

export const useProjectData = () => {
  const [store, setStore] = useState<ProjectStore>(getStoredStore());
  const [isHydrating, setIsHydrating] = useState<boolean>(isTauriRuntime());
  const sourceIdRef = useRef(
    `project-store-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    const handleStorageChange = (event?: Event) => {
      if (event?.type === EVENT_KEY) {
        const custom = event as CustomEvent<StoreUpdateEventDetail>;
        const nextStore = custom.detail?.store;
        if (nextStore) {
          setStore(nextStore);
          setIsHydrating(false);
          return;
        }
      }

      void loadStoredStore().then((nextStore) => {
        setStore(nextStore);
        setIsHydrating(false);
      });
    };

    let isMounted = true;
    void loadStoredStore().then((nextStore) => {
      if (!isMounted) return;
      setStore(nextStore);
      setIsHydrating(false);
    });

    window.addEventListener(EVENT_KEY, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener(EVENT_KEY, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const currentProject = store.projects[store.currentProjectId] || DEFAULT_DATA;

  useEffect(() => {
    updateDataRegistry(
      currentProject.jokers,
      currentProject.rarities,
      currentProject.consumableSets,
      currentProject.sounds,
      currentProject.consumables,
      currentProject.boosters,
      currentProject.enhancements,
      currentProject.seals,
      currentProject.editions,
      currentProject.vouchers,
      currentProject.decks,
      currentProject.metadata.prefix || "",
    );
  }, [currentProject]);

  const saveStore = useCallback((nextStore: ProjectStore) => {
    const emitLocalStoreUpdate = () => {
      window.dispatchEvent(
        new CustomEvent<StoreUpdateEventDetail>(EVENT_KEY, {
          detail: { store: nextStore, sourceId: sourceIdRef.current },
        }),
      );
    };

    persistQueue = persistQueue
      .then(async () => {
        if (isTauriRuntime()) {
          try {
            const path = await getTauriStorePath();
            await ensureTauriStoreDirectory();
            await writeTextFile(path, JSON.stringify(nextStore));
            setTimeout(emitLocalStoreUpdate, 0);
            return;
          } catch (error) {
            console.warn("Error saving store to file", error);
            maybeShowStorageErrorAlert(error);
          }
        }

        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
          setTimeout(emitLocalStoreUpdate, 0);
        } catch (error) {
          console.warn("Error saving to localStorage", error);
          maybeShowStorageErrorAlert(error);
        }
      })
      .catch((error) => {
        console.warn("Unhandled persistence error", error);
      });
  }, []);

  const updateMetadata = useCallback(
    (updates: Partial<ModMetadata>) => {
      setStore((prev) => {
        const currentId = prev.currentProjectId;
        const current = prev.projects[currentId] || DEFAULT_DATA;
        const nextMetadata: ModMetadata = { ...current.metadata, ...updates };
        const metadataActivity = buildMetadataActivityEntry(
          current.metadata,
          nextMetadata,
        );
        const updatedProject: ProjectData = {
          ...current,
          metadata: nextMetadata,
          recentActivity: prependRecentActivity(
            current.recentActivity,
            metadataActivity ? [metadataActivity] : [],
          ),
        };

        if (updates.id && updates.id !== currentId) {
          const { [currentId]: _removed, ...remaining } = prev.projects;
          const uniqueId = ensureUniqueProjectId(updates.id, remaining);
          updatedProject.metadata.id = uniqueId;
          const nextStore = {
            ...prev,
            currentProjectId: uniqueId,
            projects: { ...remaining, [uniqueId]: updatedProject },
          };
          saveStore(nextStore);
          return nextStore;
        }

        const nextStore = {
          ...prev,
          projects: { ...prev.projects, [currentId]: updatedProject },
        };
        saveStore(nextStore);
        return nextStore;
      });
    },
    [saveStore],
  );

  const updateCollection = useCallback(
    <K extends keyof ProjectData>(key: K, items: ProjectData[K]) => {
      setStore((prev) => {
        const currentId = prev.currentProjectId;
        const current = prev.projects[currentId] || DEFAULT_DATA;
        const activityEntries =
          isTrackableCollectionKey(key) &&
          Array.isArray(current[key]) &&
          Array.isArray(items)
            ? buildCollectionActivityEntries(key, current[key], items)
            : [];
        const updatedProject: ProjectData = {
          ...current,
          [key]: items,
          recentActivity: prependRecentActivity(
            current.recentActivity,
            activityEntries,
          ),
          stats: {
            ...current.stats,
            [key]: Array.isArray(items)
              ? items.length
              : current.stats[key as keyof ProjectStats],
          },
        };
        const nextStore = {
          ...prev,
          projects: { ...prev.projects, [currentId]: updatedProject },
        };
        saveStore(nextStore);
        return nextStore;
      });
    },
    [saveStore],
  );

  const switchProject = useCallback(
    (projectId: string) => {
      setStore((prev) => {
        if (!prev.projects[projectId]) return prev;
        const nextStore = { ...prev, currentProjectId: projectId };
        saveStore(nextStore);
        return nextStore;
      });
    },
    [saveStore],
  );

  const createProject = useCallback(
    (metadataOverrides: Partial<ModMetadata> = {}) => {
      let createdId = "";
      setStore((prev) => {
        const baseMetadata = sanitizeMetadata({
          ...DEFAULT_METADATA,
          ...metadataOverrides,
        });
        const baseId = baseMetadata.id || DEFAULT_METADATA.id;
        const uniqueId = ensureUniqueProjectId(baseId, prev.projects);
        const finalMetadata = {
          ...baseMetadata,
          id: uniqueId,
          prefix: baseMetadata.prefix || uniqueId.toLowerCase().slice(0, 8),
          display_name: baseMetadata.display_name || baseMetadata.name,
        };
        const newProject: ProjectData = {
          ...DEFAULT_DATA,
          metadata: finalMetadata,
        };
        const nextStore: ProjectStore = {
          ...prev,
          currentProjectId: uniqueId,
          projects: { ...prev.projects, [uniqueId]: newProject },
        };
        createdId = uniqueId;
        saveStore(nextStore);
        return nextStore;
      });
      return createdId;
    },
    [saveStore],
  );

  const deleteProject = useCallback(
    (projectId: string) => {
      setStore((prev) => {
        if (!prev.projects[projectId]) return prev;

        const { [projectId]: _removed, ...remaining } = prev.projects;
        const remainingIds = Object.keys(remaining);

        if (remainingIds.length === 0) {
          const fallbackId = DEFAULT_METADATA.id;
          const fallbackProject: ProjectData = {
            ...DEFAULT_DATA,
            metadata: { ...DEFAULT_METADATA, id: fallbackId },
          };
          const nextStore: ProjectStore = {
            version: 2,
            currentProjectId: fallbackId,
            projects: { [fallbackId]: fallbackProject },
          };
          saveStore(nextStore);
          return nextStore;
        }

        const nextCurrentId =
          prev.currentProjectId === projectId
            ? remainingIds[0]
            : prev.currentProjectId;

        const nextStore: ProjectStore = {
          ...prev,
          currentProjectId: nextCurrentId,
          projects: remaining,
        };
        saveStore(nextStore);
        return nextStore;
      });
    },
    [saveStore],
  );

  // Atomically replace an entire project in one setStore call.
  // Avoids the glitchy sequential-update pattern of calling each updateX
  // separately, which caused multiple save → event → setState cycles.
  const importProject = useCallback(
    (projectData: ProjectData) => {
      setStore((prev) => {
        const importedName = (projectData.metadata?.name || "").trim().toLowerCase();
        const existingId = Object.keys(prev.projects).find(
          (id) =>
            (prev.projects[id].metadata.name || "").trim().toLowerCase() ===
            importedName,
        );

        let nextCurrentId: string;
        let nextProjects: Record<string, ProjectData>;

        if (existingId) {
          nextCurrentId = existingId;
          nextProjects = {
            ...prev.projects,
            [existingId]: {
              ...projectData,
              metadata: { ...projectData.metadata, id: existingId },
            },
          };
        } else {
          const baseId = projectData.metadata.id || DEFAULT_METADATA.id;
          const uniqueId = ensureUniqueProjectId(baseId, prev.projects);
          const finalProject: ProjectData = {
            ...projectData,
            metadata: { ...projectData.metadata, id: uniqueId },
          };
          nextCurrentId = uniqueId;
          nextProjects = { ...prev.projects, [uniqueId]: finalProject };
        }

        const nextStore: ProjectStore = {
          ...prev,
          currentProjectId: nextCurrentId,
          projects: nextProjects,
        };
        saveStore(nextStore);
        return nextStore;
      });
    },
    [saveStore],
  );

  const projects = Object.values(store.projects).map((project) => ({
    id: project.metadata.id,
    name: project.metadata.name,
    version: project.metadata.version,
  }));

  return {
    isHydrating,
    data: currentProject,
    projects,
    currentProjectId: store.currentProjectId,
    switchProject,
    createProject,
    deleteProject,
    importProject,
    updateMetadata,
    updateJokers: (items: JokerData[]) => updateCollection("jokers", items),
    updateConsumables: (items: ConsumableData[]) =>
      updateCollection("consumables", items),
    updateRarities: (items: RarityData[]) =>
      updateCollection("rarities", items),
    updateConsumableSets: (items: ConsumableSetData[]) =>
      updateCollection("consumableSets", items),
    updateDecks: (items: DeckData[]) => updateCollection("decks", items),
    updateVouchers: (items: VoucherData[]) =>
      updateCollection("vouchers", items),
    updateBoosters: (items: BoosterData[]) =>
      updateCollection("boosters", items),
    updateSeals: (items: SealData[]) => updateCollection("seals", items),
    updateEditions: (items: EditionData[]) =>
      updateCollection("editions", items),
    updateEnhancements: (items: EnhancementData[]) =>
      updateCollection("enhancements", items),
    updateSounds: (items: SoundData[]) => updateCollection("sounds", items),
  };
};

export const resetProjectData = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(CONFIRM_DELETE_KEY);
  window.localStorage.removeItem(UI_SCALE_KEY);
  window.localStorage.removeItem(BALATRO_PATH_KEY);
  window.localStorage.removeItem(BALATRO_AUTOFIND_KEY);
  window.localStorage.removeItem(BALATRO_AUTOFIND_ALERT_KEY);
  window.localStorage.removeItem(SPLIT_LOCALIZATION_EXPORT_KEY);
  window.localStorage.removeItem(EXPORT_DESTINATION_MODE_KEY);
  window.localStorage.removeItem(JOKERFORGE_EXPORT_AS_JSON_KEY);
  window.localStorage.removeItem(THEME_PREFERENCE_KEY);
  clearThemeStorage();
  if (isTauriRuntime()) {
    const defaultStore = createDefaultStore();
    persistQueue = persistQueue
      .then(async () => {
        try {
          const path = await getTauriStorePath();
          await ensureTauriStoreDirectory();
          await writeTextFile(path, JSON.stringify(defaultStore));
        } catch (error) {
          console.warn("Error resetting file-backed store", error);
        }
      })
      .catch((error) => {
        console.warn("Unhandled reset persistence error", error);
      });
  }
  window.dispatchEvent(new Event(EVENT_KEY));
};

export const getUiScalePreference = (): string => {
  if (typeof window === "undefined") return "1";
  return window.localStorage.getItem(UI_SCALE_KEY) || "1";
};

export const applyUiScalePreference = (value: string) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const parsed = Number.parseFloat(value);
  const safeScale = Number.isFinite(parsed) ? parsed : 1;
  root.style.fontSize = `${safeScale * 16}px`;
  document.body.style.transform = "";
  document.body.style.width = "";
  document.body.style.height = "";
  document.body.style.transformOrigin = "";
};

export const setUiScalePreference = (value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UI_SCALE_KEY, value);
  applyUiScalePreference(value);
};

export const getThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
};

export const setThemePreference = (value: ThemePreference) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_PREFERENCE_KEY, value);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

export const getConfirmDeleteEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(CONFIRM_DELETE_KEY);
  if (stored === null) return true;
  return stored === "true";
};

export const setConfirmDeleteEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIRM_DELETE_KEY, value ? "true" : "false");
};

export const getBalatroInstallPath = (): string => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(BALATRO_PATH_KEY) || "";
};

export const setBalatroInstallPath = (value: string) => {
  if (typeof window === "undefined") return;
  const normalizedValue = /^[a-zA-Z]:\\+/.test(value)
    ? value.replace(/\\{2,}/g, "\\")
    : value;
  window.localStorage.setItem(BALATRO_PATH_KEY, normalizedValue);
};

export const getBalatroAutofindResult = (): "success" | "failure" | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(BALATRO_AUTOFIND_KEY);
  if (stored === "success" || stored === "failure") return stored;
  return null;
};

export const setBalatroAutofindResult = (value: "success" | "failure") => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BALATRO_AUTOFIND_KEY, value);
};

export const getBalatroAutofindAlertShown = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BALATRO_AUTOFIND_ALERT_KEY) === "true";
};

export const setBalatroAutofindAlertShown = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BALATRO_AUTOFIND_ALERT_KEY,
    value ? "true" : "false",
  );
};

export const getSplitLocalizationExportEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SPLIT_LOCALIZATION_EXPORT_KEY) === "true";
};

export const setSplitLocalizationExportEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SPLIT_LOCALIZATION_EXPORT_KEY,
    value ? "true" : "false",
  );
};

export const getExportDestinationMode = (): ExportDestinationMode => {
  if (typeof window === "undefined") return "downloads";
  const stored = window.localStorage.getItem(EXPORT_DESTINATION_MODE_KEY);
  if (stored === "balatro-mods") return "balatro-mods";
  return "downloads";
};

export const setExportDestinationMode = (mode: ExportDestinationMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPORT_DESTINATION_MODE_KEY, mode);
};

export const getJokerforgeExportAsJsonEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(JOKERFORGE_EXPORT_AS_JSON_KEY) === "true";
};

export const setJokerforgeExportAsJsonEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    JOKERFORGE_EXPORT_AS_JSON_KEY,
    value ? "true" : "false",
  );
};

export const useModName = () => {
  const { data } = useProjectData();
  return data.metadata.name;
};
