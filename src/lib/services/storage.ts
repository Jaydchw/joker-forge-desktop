import { useState, useEffect, useCallback, useRef } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
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
} from "@/lib/core/types";
import {
  DEFAULT_LOCALIZATION_LANGUAGE,
  ensureLocalizableWithLanguage,
  normalizeLanguageValue,
} from "@/lib/core/localization";
import { updateDataRegistry } from "@/lib/balatro/balatro-utils";
import { pushGlobalAlert } from "@/lib/app/global-alerts-bus";
import { clearThemeStorage } from "@/lib/app/theme-manager";

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
const LEGACY_STORAGE_FILE_NAME = "joker_forge_project_data.json";
const TAURI_STORAGE_DIR_NAME = "joker_forge_storage";
const SETTINGS_FILE_NAME = "settings.json";
const PROJECTS_DIR_NAME = "projects";
const EVENT_KEY = "joker_forge_update";
const CONFIRM_DELETE_KEY = "joker_forge_confirm_delete";
const BALATRO_APPDATA_PATH_KEY = "joker_forge_balatro_appdata_path";
const BALATRO_GAME_PATH_KEY = "joker_forge_balatro_game_path";
// Legacy key kept for migration compatibility.
const BALATRO_PATH_KEY = "joker_forge_balatro_path";
const BALATRO_AUTOFIND_KEY = "joker_forge_balatro_autofind";
const BALATRO_AUTOFIND_ALERT_KEY = "joker_forge_balatro_autofind_alert";
const SPLIT_LOCALIZATION_EXPORT_KEY = "joker_forge_split_localization_export";
const DEFAULT_LOCALIZATION_LANGUAGE_KEY =
  "joker_forge_default_localization_language";
const EXPORT_DESTINATION_MODE_KEY = "joker_forge_export_destination_mode";
const JOKERFORGE_EXPORT_AS_JSON_KEY = "joker_forge_export_as_json";
const SINGLE_MANAGED_MOD_EXPORT_KEY =
  "joker_forge_single_managed_mod_export";
const JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY =
  "joker_forge_auto_save_downloads";
const LAUNCH_GAME_ON_EXPORT_KEY = "joker_forge_launch_game_on_export";
const AUTO_OPEN_NEW_ITEM_DIALOG_KEY = "joker_forge_auto_open_new_item_dialog";
const DESCRIPTION_VARIABLE_PLACEHOLDERS_KEY =
  "joker_forge_description_variable_placeholders";
const RULE_BUILDER_SETTINGS_KEY = "joker_forge_rule_builder_settings";
const THEME_PREFERENCE_KEY = "joker_forge_theme_preference";
const THEME_CHANGE_EVENT = "joker_forge_theme_change";
const STORAGE_ERROR_ALERT_THROTTLE_MS = 4000;
const RECENT_ACTIVITY_LIMIT = 10;

let lastStorageErrorAlertAt = 0;
let tauriStorePathsPromise: Promise<{
  rootDir: string;
  legacyStorePath: string;
  settingsPath: string;
  projectsDir: string;
}> | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let pendingLocalStoreUpdate: StoreUpdateEventDetail | null = null;
let localStoreUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
let cachedProjectStore: ProjectStore | null = null;
let loadStoredStorePromise: Promise<ProjectStore> | null = null;

type StoreUpdateEventDetail = {
  store: ProjectStore;
  sourceId: string;
};

const scheduleLocalStoreUpdate = (detail: StoreUpdateEventDetail) => {
  pendingLocalStoreUpdate = detail;
  if (localStoreUpdateTimeout !== null) return;

  localStoreUpdateTimeout = setTimeout(() => {
    localStoreUpdateTimeout = null;
    const pendingUpdate = pendingLocalStoreUpdate;
    pendingLocalStoreUpdate = null;
    if (!pendingUpdate || typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent<StoreUpdateEventDetail>(EVENT_KEY, {
        detail: pendingUpdate,
      }),
    );
  }, 0);
};

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
  legacyStorePath: string;
  settingsPath: string;
  projectsDir: string;
}> => {
  if (!tauriStorePathsPromise) {
    tauriStorePathsPromise = appDataDir().then(async (dir) => {
      const rootDir = await join(dir, TAURI_STORAGE_DIR_NAME);
      return {
        rootDir,
        legacyStorePath: await join(dir, LEGACY_STORAGE_FILE_NAME),
        settingsPath: await join(rootDir, SETTINGS_FILE_NAME),
        projectsDir: await join(rootDir, PROJECTS_DIR_NAME),
      };
    });
  }
  return tauriStorePathsPromise;
};

const ensureTauriStoreDirectories = async (): Promise<void> => {
  const paths = await getTauriStorePaths();
  await mkdir(paths.rootDir, { recursive: true });
  await mkdir(paths.projectsDir, { recursive: true });
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
export type JokerforgeExportSaveMode = "ask" | "downloads" | "balatro-mods";
export type ThemePreference = "light" | "dark";
export type RuleBuilderShortcutId =
  | "undo"
  | "redo"
  | "selectAll"
  | "copySelection"
  | "pasteSelection"
  | "duplicateSelection"
  | "deleteSelection"
  | "clearSelection"
  | "autoLayout"
  | "toggleBlockPalette"
  | "toggleVariables"
  | "toggleGameVariables"
  | "toggleInspector"
  | "toggleLiveCode"
  | "toggleHistory"
  | "toggleGridSnap"
  | "zoomIn"
  | "zoomOut";

export type RuleBuilderShortcutMap = Record<RuleBuilderShortcutId, string>;

export interface RuleBuilderSettings {
  defaultGridSnap: boolean;
  showDotsBackground: boolean;
  enableLiveCodeHighlighting: boolean;
  confirmDeleteRule: boolean;
  confirmDeleteBlock: boolean;
  enableDragBoxSelection: boolean;
  enableLeftMousePan: boolean;
  enableRightMousePan: boolean;
  enableMiddleMousePan: boolean;
  enableWheelZoom: boolean;
  enablePinchZoom: boolean;
  openInspectorOnFirstSelection: boolean;
  shortcuts: RuleBuilderShortcutMap;
}

export const DEFAULT_RULE_BUILDER_SETTINGS: RuleBuilderSettings = {
  defaultGridSnap: false,
  showDotsBackground: true,
  enableLiveCodeHighlighting: true,
  confirmDeleteRule: false,
  confirmDeleteBlock: false,
  enableDragBoxSelection: true,
  enableLeftMousePan: false,
  enableRightMousePan: false,
  enableMiddleMousePan: true,
  enableWheelZoom: true,
  enablePinchZoom: true,
  openInspectorOnFirstSelection: true,
  shortcuts: {
    undo: "ctrl+z",
    redo: "ctrl+y",
    selectAll: "ctrl+a",
    copySelection: "ctrl+c",
    pasteSelection: "ctrl+v",
    duplicateSelection: "ctrl+d",
    deleteSelection: "delete",
    clearSelection: "esc",
    autoLayout: "ctrl+shift+l",
    toggleBlockPalette: "b",
    toggleVariables: "v",
    toggleGameVariables: "g",
    toggleInspector: "p",
    toggleLiveCode: "l",
    toggleHistory: "h",
    toggleGridSnap: "s",
    zoomIn: "+",
    zoomOut: "-",
  },
};

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

type LocalizableCollectionKey =
  | "jokers"
  | "consumables"
  | "decks"
  | "vouchers"
  | "boosters"
  | "seals"
  | "editions"
  | "enhancements";

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

const LOCALIZABLE_COLLECTION_KEYS: Record<LocalizableCollectionKey, true> = {
  jokers: true,
  consumables: true,
  decks: true,
  vouchers: true,
  boosters: true,
  seals: true,
  editions: true,
  enhancements: true,
};

const isLocalizableCollectionKey = (
  key: keyof ProjectData,
): key is LocalizableCollectionKey =>
  Object.prototype.hasOwnProperty.call(LOCALIZABLE_COLLECTION_KEYS, key);

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
      if (before === item) return null;

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

type SegmentedSettingsStore = {
  version: 1;
  currentProjectId: string;
};

const serializeStoreToSegmented = (
  store: ProjectStore,
): {
  settings: SegmentedSettingsStore;
  projects: Record<string, ProjectData>;
} => ({
  settings: {
    version: 1,
    currentProjectId: store.currentProjectId,
  },
  projects: store.projects,
});

const toSafeFileStem = (value: string): string => {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return normalized || "project";
};

const persistStoreToTauriFiles = async (store: ProjectStore): Promise<void> => {
  const paths = await getTauriStorePaths();
  await ensureTauriStoreDirectories();

  const segmented = serializeStoreToSegmented(store);
  await writeTextFile(paths.settingsPath, JSON.stringify(segmented.settings));

  const existingEntries = await readDir(paths.projectsDir);
  const existingProjectFiles = existingEntries
    .filter((entry) => !entry.isDirectory && typeof entry.name === "string")
    .map((entry) => entry.name as string)
    .filter((name) => name.toLowerCase().endsWith(".json"));

  const expectedFiles = new Set<string>();
  for (const [projectId, project] of Object.entries(segmented.projects)) {
    const fileName = `${toSafeFileStem(projectId)}.json`;
    expectedFiles.add(fileName);
    const path = await join(paths.projectsDir, fileName);
    await writeTextFile(
      path,
      JSON.stringify({
        version: 1,
        projectId,
        project,
      }),
    );
  }

  for (const existingFile of existingProjectFiles) {
    if (expectedFiles.has(existingFile)) continue;
    const obsoletePath = await join(paths.projectsDir, existingFile);
    try {
      await remove(obsoletePath);
    } catch {
      // Ignore cleanup failures.
    }
  }
};

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
  const toLocalizedArray = <
    T extends { name?: unknown; description?: unknown; localizations?: unknown },
  >(
    val: T[] | undefined,
  ): T[] =>
    (Array.isArray(val) ? val : []).map((item) =>
      ensureLocalizableWithLanguage(item, DEFAULT_LOCALIZATION_LANGUAGE),
    ) as T[];

  return {
    ...DEFAULT_DATA,
    ...input,
    metadata: sanitizeMetadata(input.metadata),
    stats: { ...DEFAULT_DATA.stats, ...(input.stats || {}) },
    recentActivity: sanitizeRecentActivity(input.recentActivity),
    jokers: toLocalizedArray(input.jokers),
    consumables: toLocalizedArray(input.consumables),
    rarities: toArray(input.rarities),
    consumableSets: toArray(input.consumableSets),
    decks: toLocalizedArray(input.decks),
    vouchers: toLocalizedArray(input.vouchers),
    boosters: toLocalizedArray(input.boosters),
    seals: toLocalizedArray(input.seals),
    editions: toLocalizedArray(input.editions),
    enhancements: toLocalizedArray(input.enhancements),
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
    const paths = await getTauriStorePaths();
    const settingsRaw = await readTextFile(paths.settingsPath);
    const settingsParsed = JSON.parse(settingsRaw) as Partial<SegmentedSettingsStore>;

    const projectEntries = await readDir(paths.projectsDir);
    const projects: Record<string, ProjectData> = {};

    for (const entry of projectEntries) {
      if (entry.isDirectory || !entry.name || !entry.name.endsWith(".json")) continue;
      try {
        const filePath = await join(paths.projectsDir, entry.name);
        const raw = await readTextFile(filePath);
        const parsed = JSON.parse(raw) as {
          projectId?: unknown;
          project?: unknown;
        };
        if (typeof parsed.projectId !== "string") continue;
        const project = sanitizeProjectData(parsed.project);
        projects[parsed.projectId] = {
          ...project,
          metadata: { ...project.metadata, id: parsed.projectId },
        };
      } catch {
        // Ignore broken project files and continue loading others.
      }
    }

    const projectIds = Object.keys(projects);
    if (projectIds.length === 0) return null;
    const fallbackId = projectIds[0];
    const currentProjectId =
      typeof settingsParsed.currentProjectId === "string" &&
      projects[settingsParsed.currentProjectId]
        ? settingsParsed.currentProjectId
        : fallbackId;

    return {
      version: 2,
      currentProjectId,
      projects,
    };
  } catch {
    return null;
  }
};

const loadStoredStore = async (): Promise<ProjectStore> => {
  if (loadStoredStorePromise) return loadStoredStorePromise;

  loadStoredStorePromise = (async () => {
    const tauriStore = await loadStoreFromTauriFile();
    if (tauriStore) return tauriStore;

    if (isTauriRuntime()) {
      try {
        const paths = await getTauriStorePaths();
        const legacyRaw = await readTextFile(paths.legacyStorePath);
        const migrated = sanitizeStoreFromUnknown(JSON.parse(legacyRaw));
        await persistStoreToTauriFiles(migrated);
        return migrated;
      } catch {
        // No legacy file or invalid legacy data.
      }
    }

    return loadStoreFromLocalStorage();
  })()
    .then((nextStore) => {
      cachedProjectStore = nextStore;
      return nextStore;
    })
    .finally(() => {
      loadStoredStorePromise = null;
    });

  return loadStoredStorePromise;
};

const getStoredStore = (): ProjectStore =>
  cachedProjectStore ?? loadStoreFromLocalStorage();

export const useProjectData = () => {
  const [store, setStore] = useState<ProjectStore>(getStoredStore());
  const [isHydrating, setIsHydrating] = useState<boolean>(
    isTauriRuntime() && cachedProjectStore === null,
  );
  const sourceIdRef = useRef(
    `project-store-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    const handleStorageChange = (event?: Event) => {
      if (event?.type === EVENT_KEY) {
        const custom = event as CustomEvent<StoreUpdateEventDetail>;
        const nextStore = custom.detail?.store;
        if (nextStore) {
          cachedProjectStore = nextStore;
          setStore(nextStore);
          setIsHydrating(false);
          return;
        }
      }

      void loadStoredStore().then((nextStore) => {
        cachedProjectStore = nextStore;
        setStore(nextStore);
        setIsHydrating(false);
      });
    };

    let isMounted = true;
    void loadStoredStore().then((nextStore) => {
      if (!isMounted) return;
      cachedProjectStore = nextStore;
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
    cachedProjectStore = nextStore;
    scheduleLocalStoreUpdate({
      store: nextStore,
      sourceId: sourceIdRef.current,
    });

    persistQueue = persistQueue
      .then(async () => {
        if (isTauriRuntime()) {
          try {
            await persistStoreToTauriFiles(nextStore);
            return;
          } catch (error) {
            console.warn("Error saving store to file", error);
            maybeShowStorageErrorAlert(error);
          }
        }

        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
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
    <K extends keyof ProjectData>(
      key: K,
      itemsOrUpdater:
        | ProjectData[K]
        | ((previous: ProjectData[K]) => ProjectData[K]),
    ) => {
      setStore((prev) => {
        const currentId = prev.currentProjectId;
        const current = prev.projects[currentId] || DEFAULT_DATA;
        const resolvedItems =
          typeof itemsOrUpdater === "function"
            ? (
                itemsOrUpdater as (previous: ProjectData[K]) => ProjectData[K]
              )(current[key])
            : itemsOrUpdater;
        const previousItemReferences = Array.isArray(current[key])
          ? new Set(current[key] as unknown[])
          : null;
        const normalizedItems =
          isLocalizableCollectionKey(key) && Array.isArray(resolvedItems)
            ? (resolvedItems.map((item) =>
                previousItemReferences?.has(item)
                  ? item
                  : ensureLocalizableWithLanguage(
                      item as {
                        name?: unknown;
                        description?: unknown;
                        localizations?: unknown;
                      },
                      DEFAULT_LOCALIZATION_LANGUAGE,
                    ),
              ) as ProjectData[K])
            : resolvedItems;
        const activityEntries =
          isTrackableCollectionKey(key) &&
          Array.isArray(current[key]) &&
          Array.isArray(normalizedItems)
            ? buildCollectionActivityEntries(key, current[key], normalizedItems)
            : [];
        const updatedProject: ProjectData = {
          ...current,
          [key]: normalizedItems,
          recentActivity: prependRecentActivity(
            current.recentActivity,
            activityEntries,
          ),
          stats: {
            ...current.stats,
            [key]: Array.isArray(normalizedItems)
              ? normalizedItems.length
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

  type CollectionUpdateArg<T> = T[] | ((previous: T[]) => T[]);
  const updateJokers = useCallback(
    (items: CollectionUpdateArg<JokerData>) => updateCollection("jokers", items),
    [updateCollection],
  );
  const updateConsumables = useCallback(
    (items: CollectionUpdateArg<ConsumableData>) =>
      updateCollection("consumables", items),
    [updateCollection],
  );
  const updateRarities = useCallback(
    (items: CollectionUpdateArg<RarityData>) =>
      updateCollection("rarities", items),
    [updateCollection],
  );
  const updateConsumableSets = useCallback(
    (items: CollectionUpdateArg<ConsumableSetData>) =>
      updateCollection("consumableSets", items),
    [updateCollection],
  );
  const updateDecks = useCallback(
    (items: CollectionUpdateArg<DeckData>) => updateCollection("decks", items),
    [updateCollection],
  );
  const updateVouchers = useCallback(
    (items: CollectionUpdateArg<VoucherData>) =>
      updateCollection("vouchers", items),
    [updateCollection],
  );
  const updateBoosters = useCallback(
    (items: CollectionUpdateArg<BoosterData>) =>
      updateCollection("boosters", items),
    [updateCollection],
  );
  const updateSeals = useCallback(
    (items: CollectionUpdateArg<SealData>) => updateCollection("seals", items),
    [updateCollection],
  );
  const updateEditions = useCallback(
    (items: CollectionUpdateArg<EditionData>) =>
      updateCollection("editions", items),
    [updateCollection],
  );
  const updateEnhancements = useCallback(
    (items: CollectionUpdateArg<EnhancementData>) =>
      updateCollection("enhancements", items),
    [updateCollection],
  );
  const updateSounds = useCallback(
    (items: CollectionUpdateArg<SoundData>) => updateCollection("sounds", items),
    [updateCollection],
  );

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
    updateJokers,
    updateConsumables,
    updateRarities,
    updateConsumableSets,
    updateDecks,
    updateVouchers,
    updateBoosters,
    updateSeals,
    updateEditions,
    updateEnhancements,
    updateSounds,
  };
};

export const resetProjectData = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(CONFIRM_DELETE_KEY);
  window.localStorage.removeItem(BALATRO_APPDATA_PATH_KEY);
  window.localStorage.removeItem(BALATRO_GAME_PATH_KEY);
  window.localStorage.removeItem(BALATRO_PATH_KEY);
  window.localStorage.removeItem(BALATRO_AUTOFIND_KEY);
  window.localStorage.removeItem(BALATRO_AUTOFIND_ALERT_KEY);
  window.localStorage.removeItem(SPLIT_LOCALIZATION_EXPORT_KEY);
  window.localStorage.removeItem(DEFAULT_LOCALIZATION_LANGUAGE_KEY);
  window.localStorage.removeItem(EXPORT_DESTINATION_MODE_KEY);
  window.localStorage.removeItem(JOKERFORGE_EXPORT_AS_JSON_KEY);
  window.localStorage.removeItem(SINGLE_MANAGED_MOD_EXPORT_KEY);
  window.localStorage.removeItem(JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY);
  window.localStorage.removeItem(LAUNCH_GAME_ON_EXPORT_KEY);
  window.localStorage.removeItem(DESCRIPTION_VARIABLE_PLACEHOLDERS_KEY);
  window.localStorage.removeItem(RULE_BUILDER_SETTINGS_KEY);
  window.localStorage.removeItem(THEME_PREFERENCE_KEY);
  clearThemeStorage();
  if (isTauriRuntime()) {
    const defaultStore = createDefaultStore();
    persistQueue = persistQueue
      .then(async () => {
        try {
          const paths = await getTauriStorePaths();
          if (await exists(paths.projectsDir)) {
            await remove(paths.projectsDir, { recursive: true });
          }
          await persistStoreToTauriFiles(defaultStore);
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

const normalizeWindowsSeparators = (value: string): string =>
  /^[a-zA-Z]:\\+/.test(value) ? value.replace(/\\{2,}/g, "\\") : value;

const deriveBalatroAppdataRoot = (rawValue: string): string => {
  const normalized = normalizeWindowsSeparators(rawValue.trim());
  if (!normalized) return "";

  const segments = normalized.split(/[/\\]+/).filter(Boolean);
  if (segments.length === 0) return "";

  const balatroIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === "balatro",
  );
  if (balatroIndex === -1) return normalized;

  return segments.slice(0, balatroIndex + 1).join("\\");
};

const getLegacyBalatroPath = (): string => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(BALATRO_PATH_KEY) || "";
};

export const getBalatroAppdataPath = (): string => {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(BALATRO_APPDATA_PATH_KEY);
  if (stored && stored.trim()) return normalizeWindowsSeparators(stored);
  const legacy = getLegacyBalatroPath();
  if (!legacy.trim()) return "";
  return deriveBalatroAppdataRoot(legacy);
};

export const setBalatroAppdataPath = (value: string) => {
  if (typeof window === "undefined") return;
  const normalizedValue = deriveBalatroAppdataRoot(value);
  window.localStorage.setItem(BALATRO_APPDATA_PATH_KEY, normalizedValue);
  // Keep legacy key in sync for older paths/migrations.
  window.localStorage.setItem(BALATRO_PATH_KEY, normalizedValue);
};

export const getBalatroGamePath = (): string => {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(BALATRO_GAME_PATH_KEY) || "";
  return normalizeWindowsSeparators(stored);
};

export const setBalatroGamePath = (value: string) => {
  if (typeof window === "undefined") return;
  const normalizedValue = normalizeWindowsSeparators((value || "").trim());
  window.localStorage.setItem(BALATRO_GAME_PATH_KEY, normalizedValue);
};

// Backward-compatible alias: "install path" now refers to Balatro AppData folder.
export const getBalatroInstallPath = (): string => {
  return getBalatroAppdataPath();
};

// Backward-compatible alias: maps to AppData folder setter.
export const setBalatroInstallPath = (value: string) => {
  setBalatroAppdataPath(value);
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

export const getDefaultLocalizationLanguage = (): string => {
  if (typeof window === "undefined") return DEFAULT_LOCALIZATION_LANGUAGE;
  const stored = window.localStorage.getItem(DEFAULT_LOCALIZATION_LANGUAGE_KEY);
  const normalized = normalizeLanguageValue(stored);
  if (!normalized) return DEFAULT_LOCALIZATION_LANGUAGE;
  if (normalized.toLowerCase() === "default") return DEFAULT_LOCALIZATION_LANGUAGE;
  return normalized;
};

export const setDefaultLocalizationLanguage = (value: string) => {
  if (typeof window === "undefined") return;
  const normalizedRaw =
    normalizeLanguageValue(value) || DEFAULT_LOCALIZATION_LANGUAGE;
  const normalized =
    normalizedRaw.toLowerCase() === "default"
      ? DEFAULT_LOCALIZATION_LANGUAGE
      : normalizedRaw;
  window.localStorage.setItem(DEFAULT_LOCALIZATION_LANGUAGE_KEY, normalized);
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

export const getJokerforgeExportSaveMode = (): JokerforgeExportSaveMode => {
  if (typeof window === "undefined") return "ask";
  const stored = window.localStorage.getItem(EXPORT_DESTINATION_MODE_KEY);
  if (
    stored === "ask" ||
    stored === "downloads" ||
    stored === "balatro-mods"
  ) {
    return stored;
  }

  // Migrate from legacy auto-save downloads toggle.
  if (window.localStorage.getItem(JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY) === "true") {
    return "downloads";
  }

  return "ask";
};

export const setJokerforgeExportSaveMode = (mode: JokerforgeExportSaveMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPORT_DESTINATION_MODE_KEY, mode);
  window.localStorage.setItem(
    JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY,
    mode === "downloads" ? "true" : "false",
  );
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

const toShortcutString = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
};

const sanitizeRuleBuilderSettings = (
  candidate: unknown,
): RuleBuilderSettings => {
  const safe =
    candidate && typeof candidate === "object"
      ? (candidate as Partial<RuleBuilderSettings>)
      : {};

  const safeShortcuts =
    safe.shortcuts && typeof safe.shortcuts === "object"
      ? (safe.shortcuts as Partial<RuleBuilderShortcutMap>)
      : {};

  return {
    defaultGridSnap:
      typeof safe.defaultGridSnap === "boolean"
        ? safe.defaultGridSnap
        : DEFAULT_RULE_BUILDER_SETTINGS.defaultGridSnap,
    showDotsBackground:
      typeof safe.showDotsBackground === "boolean"
        ? safe.showDotsBackground
        : DEFAULT_RULE_BUILDER_SETTINGS.showDotsBackground,
    enableLiveCodeHighlighting:
      typeof safe.enableLiveCodeHighlighting === "boolean"
        ? safe.enableLiveCodeHighlighting
        : DEFAULT_RULE_BUILDER_SETTINGS.enableLiveCodeHighlighting,
    confirmDeleteRule:
      typeof safe.confirmDeleteRule === "boolean"
        ? safe.confirmDeleteRule
        : DEFAULT_RULE_BUILDER_SETTINGS.confirmDeleteRule,
    confirmDeleteBlock:
      typeof safe.confirmDeleteBlock === "boolean"
        ? safe.confirmDeleteBlock
        : DEFAULT_RULE_BUILDER_SETTINGS.confirmDeleteBlock,
    enableDragBoxSelection:
      typeof safe.enableDragBoxSelection === "boolean"
        ? safe.enableDragBoxSelection
        : DEFAULT_RULE_BUILDER_SETTINGS.enableDragBoxSelection,
    enableLeftMousePan:
      typeof safe.enableLeftMousePan === "boolean"
        ? safe.enableLeftMousePan
        : DEFAULT_RULE_BUILDER_SETTINGS.enableLeftMousePan,
    enableRightMousePan:
      typeof safe.enableRightMousePan === "boolean"
        ? safe.enableRightMousePan
        : DEFAULT_RULE_BUILDER_SETTINGS.enableRightMousePan,
    enableMiddleMousePan:
      typeof safe.enableMiddleMousePan === "boolean"
        ? safe.enableMiddleMousePan
        : DEFAULT_RULE_BUILDER_SETTINGS.enableMiddleMousePan,
    enableWheelZoom:
      typeof safe.enableWheelZoom === "boolean"
        ? safe.enableWheelZoom
        : DEFAULT_RULE_BUILDER_SETTINGS.enableWheelZoom,
    enablePinchZoom:
      typeof safe.enablePinchZoom === "boolean"
        ? safe.enablePinchZoom
        : DEFAULT_RULE_BUILDER_SETTINGS.enablePinchZoom,
    openInspectorOnFirstSelection:
      typeof safe.openInspectorOnFirstSelection === "boolean"
        ? safe.openInspectorOnFirstSelection
        : DEFAULT_RULE_BUILDER_SETTINGS.openInspectorOnFirstSelection,
    shortcuts: {
      undo: toShortcutString(
        safeShortcuts.undo,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.undo,
      ),
      redo: toShortcutString(
        safeShortcuts.redo,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.redo,
      ),
      selectAll: toShortcutString(
        safeShortcuts.selectAll,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.selectAll,
      ),
      copySelection: toShortcutString(
        safeShortcuts.copySelection,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.copySelection,
      ),
      pasteSelection: toShortcutString(
        safeShortcuts.pasteSelection,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.pasteSelection,
      ),
      duplicateSelection: toShortcutString(
        safeShortcuts.duplicateSelection,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.duplicateSelection,
      ),
      deleteSelection: toShortcutString(
        safeShortcuts.deleteSelection,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.deleteSelection,
      ),
      clearSelection: toShortcutString(
        safeShortcuts.clearSelection,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.clearSelection,
      ),
      autoLayout: toShortcutString(
        safeShortcuts.autoLayout,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.autoLayout,
      ),
      toggleBlockPalette: toShortcutString(
        safeShortcuts.toggleBlockPalette,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleBlockPalette,
      ),
      toggleVariables: toShortcutString(
        safeShortcuts.toggleVariables,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleVariables,
      ),
      toggleGameVariables: toShortcutString(
        safeShortcuts.toggleGameVariables,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleGameVariables,
      ),
      toggleInspector: toShortcutString(
        safeShortcuts.toggleInspector,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleInspector,
      ),
      toggleLiveCode: toShortcutString(
        safeShortcuts.toggleLiveCode,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleLiveCode,
      ),
      toggleHistory: toShortcutString(
        safeShortcuts.toggleHistory,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleHistory,
      ),
      toggleGridSnap: toShortcutString(
        safeShortcuts.toggleGridSnap,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.toggleGridSnap,
      ),
      zoomIn: toShortcutString(
        safeShortcuts.zoomIn,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.zoomIn,
      ),
      zoomOut: toShortcutString(
        safeShortcuts.zoomOut,
        DEFAULT_RULE_BUILDER_SETTINGS.shortcuts.zoomOut,
      ),
    },
  };
};

export const getRuleBuilderSettings = (): RuleBuilderSettings => {
  if (typeof window === "undefined") return DEFAULT_RULE_BUILDER_SETTINGS;
  const stored = window.localStorage.getItem(RULE_BUILDER_SETTINGS_KEY);
  if (!stored) return DEFAULT_RULE_BUILDER_SETTINGS;
  try {
    return sanitizeRuleBuilderSettings(JSON.parse(stored));
  } catch {
    return DEFAULT_RULE_BUILDER_SETTINGS;
  }
};

export const setRuleBuilderSettings = (
  settings: Partial<RuleBuilderSettings>,
) => {
  if (typeof window === "undefined") return;
  const merged = sanitizeRuleBuilderSettings({
    ...getRuleBuilderSettings(),
    ...settings,
    shortcuts: {
      ...getRuleBuilderSettings().shortcuts,
      ...(settings.shortcuts ?? {}),
    },
  });
  window.localStorage.setItem(RULE_BUILDER_SETTINGS_KEY, JSON.stringify(merged));
};

export const getJokerforgeAutoSaveDownloadsEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY) === "true"
  );
};

export const setJokerforgeAutoSaveDownloadsEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY,
    value ? "true" : "false",
  );
};

export const getAutoOpenNewItemDialogEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(AUTO_OPEN_NEW_ITEM_DIALOG_KEY);
  if (stored === null) return true;
  return stored === "true";
};

export const setAutoOpenNewItemDialogEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    AUTO_OPEN_NEW_ITEM_DIALOG_KEY,
    value ? "true" : "false",
  );
};

export const getDescriptionVariablePlaceholdersEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(DESCRIPTION_VARIABLE_PLACEHOLDERS_KEY);
  if (stored === null) return true;
  return stored === "true";
};

export const setDescriptionVariablePlaceholdersEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DESCRIPTION_VARIABLE_PLACEHOLDERS_KEY,
    value ? "true" : "false",
  );
};

export const getSingleManagedModExportEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(SINGLE_MANAGED_MOD_EXPORT_KEY);
  if (stored === null) return true;
  return stored === "true";
};

export const setSingleManagedModExportEnabled = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SINGLE_MANAGED_MOD_EXPORT_KEY,
    value ? "true" : "false",
  );
};

export const useModName = () => {
  const { data } = useProjectData();
  return data.metadata.name;
};
