import { useState, useEffect, useCallback, useRef } from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readFile,
  readDir,
  readTextFile,
  remove,
  rename,
  writeFile,
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
import { ensureUniqueItemOrderValues } from "@/lib/items/item-order";
import { ProjectFileStore } from "@/lib/services/project-file-store";
import { normalizeSounds } from "@/lib/sounds/sound-data";

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
const JOKERFORGE_EXPORT_SAVE_MODE_KEY =
  "joker_forge_jokerforge_export_save_mode";
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
const RULE_BUILDER_CANVAS_NAVIGATION_VERSION = 1;
const THEME_PREFERENCE_KEY = "joker_forge_theme_preference";
const THEME_CHANGE_EVENT = "joker_forge_theme_change";
const STORAGE_ERROR_ALERT_THROTTLE_MS = 4000;
const RECENT_ACTIVITY_LIMIT = 10;
const ASSET_REF_PREFIX = "asset://";

let lastStorageErrorAlertAt = 0;
let tauriStorePathsPromise: Promise<{
  rootDir: string;
  legacyStorePath: string;
  settingsPath: string;
  projectsDir: string;
}> | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let persistedStoreRevision = 0;
let pendingLocalStoreUpdate: StoreUpdateEventDetail | null = null;
let localStoreUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
let cachedProjectStore: ProjectStore | null = null;
let loadStoredStorePromise: Promise<ProjectStore> | null = null;
let storeRevision = 0;
const pendingDeletedProjectIds = new Map<string, number>();
let isResettingProjectData = false;
let projectResetEpoch = 0;
const reportedStorageWarnings = new Set<string>();

type StoreUpdateEventDetail = {
  store: ProjectStore;
  sourceId: string;
};

type MetadataUpdateArg =
  | Partial<ModMetadata>
  | ((previous: ModMetadata) => Partial<ModMetadata> | null | undefined);

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
    message: isTauriRuntime()
      ? "Your latest changes could not be saved. The previous saved projects have been kept. Keep the app open and try again."
      : "Failed to save project data to local storage.",
  });
};

const showStorageWarning = (message: string, error?: unknown) => {
  console.warn(message, error ?? "");
  if (reportedStorageWarnings.has(message)) return;
  reportedStorageWarnings.add(message);
  pushGlobalAlert({
    type: "caution",
    title: "Project Recovery",
    message,
  });
};

export type ExportDestinationMode = "downloads" | "balatro-mods";
export type JokerforgeExportSaveMode = "ask" | "downloads";
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
  enableLeftMousePan: true,
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

const createRecoveryStore = (): ProjectStore => {
  // Keep the editor's temporary project distinct from any unreadable disk ID.
  const id = `recovery_${crypto.randomUUID()}`;
  return {
    version: 2,
    currentProjectId: id,
    projects: { [id]: { ...DEFAULT_DATA, metadata: { ...DEFAULT_METADATA, id } } },
  };
};

const toSafeFileStem = (value: string): string => {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return normalized || "project";
};

const toSafeAssetSegment = (value: string): string =>
  toSafeFileStem(value).replace(/\.+$/g, "") || "asset";

const getAssetKeyCandidate = (item: Record<string, unknown>): string => {
  for (const field of ["objectKey", "key", "id"]) {
    const value = item[field];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "item";
};

const allocateAssetSegment = (
  candidate: string,
  usedSegments: Set<string>,
): string => {
  const baseSegment = toSafeAssetSegment(candidate);
  let nextSegment = baseSegment;
  let suffix = 2;

  while (usedSegments.has(nextSegment.toLowerCase())) {
    nextSegment = `${baseSegment}-${suffix}`;
    suffix += 1;
  }

  usedSegments.add(nextSegment.toLowerCase());
  return nextSegment;
};

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);

const isAssetRef = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(ASSET_REF_PREFIX);

const mimeToExtension = (mime: string): string => {
  const normalized = mime.toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/bmp") return "bmp";
  return "png";
};

const parseImageDataUrl = (
  value: string,
): { mime: string; bytes: Uint8Array } | null => {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return null;

  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { mime: match[1], bytes };
  } catch {
    return null;
  }
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const assetRefToRelativePath = (value: string): string | null => {
  if (!isAssetRef(value)) return null;
  const relativePath = value.slice(ASSET_REF_PREFIX.length);
  if (
    !relativePath ||
    relativePath.includes("..") ||
    !relativePath.split("/").every((part) =>
      Boolean(part) && !/[<>:"\\|?*\x00-\x1F]/.test(part),
    )
  ) {
    return null;
  }
  return relativePath;
};

const getMimeFromAssetPath = (path: string): string => {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  return "image/png";
};

const cloneProjectData = (project: ProjectData): ProjectData =>
  JSON.parse(JSON.stringify(project)) as ProjectData;

const collectionAssetKeys: TrackableCollectionKey[] = [
  "jokers",
  "consumables",
  "rarities",
  "consumableSets",
  "decks",
  "vouchers",
  "boosters",
  "seals",
  "editions",
  "enhancements",
  "sounds",
];

const writeImageAsset = async (
  assetsRoot: string,
  relativeStem: string,
  dataUrl: string,
): Promise<string> => {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  const relativePath = `${relativeStem}.${mimeToExtension(parsed.mime)}`;
  const pathParts = relativePath.split("/");
  let currentDir = assetsRoot;
  for (const part of pathParts.slice(0, -1)) {
    currentDir = await join(currentDir, part);
    await mkdir(currentDir, { recursive: true });
  }
  const assetPath = await join(assetsRoot, ...pathParts);
  await writeFile(assetPath, parsed.bytes);
  return `${ASSET_REF_PREFIX}${relativePath}`;
};

const resolveImageAsset = async (
  assetsRoot: string,
  value: string,
): Promise<string> => {
  const relativePath = assetRefToRelativePath(value);
  if (!relativePath) throw new Error("Invalid saved artwork reference.");

  // A missing asset makes this snapshot incomplete. Let the loader recover the
  // previous snapshot instead of saving an empty image over the reference.
  const bytes = await readFile(await join(assetsRoot, ...relativePath.split("/")));
  return `data:${getMimeFromAssetPath(relativePath)};base64,${bytesToBase64(bytes)}`;
};

const externalizeProjectImages = async (
  project: ProjectData,
  assetsRoot: string,
): Promise<ProjectData> => {
  const next = cloneProjectData(project);
  const assertHydratedImage = (value: unknown): void => {
    if (isAssetRef(value)) throw new Error("Unresolved saved artwork reference.");
  };
  assertHydratedImage(next.metadata.iconImage);
  assertHydratedImage(next.metadata.gameImage);

  if (isImageDataUrl(next.metadata.iconImage)) {
    next.metadata.iconImage = await writeImageAsset(
      assetsRoot,
      "metadata/mod-icon",
      next.metadata.iconImage,
    );
  }
  if (isImageDataUrl(next.metadata.gameImage)) {
    next.metadata.gameImage = await writeImageAsset(
      assetsRoot,
      "metadata/game-logo",
      next.metadata.gameImage,
    );
  }

  for (const key of collectionAssetKeys) {
    const items = next[key];
    if (!Array.isArray(items)) continue;
    const usedItemSegments = new Set<string>();

    for (const item of items as unknown as Array<Record<string, unknown>>) {
      const itemSegment = allocateAssetSegment(
        getAssetKeyCandidate(item),
        usedItemSegments,
      );
      const basePath = `${key}/${itemSegment}`;

      assertHydratedImage(item.image);
      assertHydratedImage(item.overlayImage);
      if (isImageDataUrl(item.image)) {
        item.image = await writeImageAsset(assetsRoot, `${basePath}/image`, item.image);
      }
      if (isImageDataUrl(item.overlayImage)) {
        item.overlayImage = await writeImageAsset(
          assetsRoot,
          `${basePath}/overlay-image`,
          item.overlayImage,
        );
      }

      const layers = item.imageLayers;
      if (Array.isArray(layers)) {
        const usedLayerSegments = new Set<string>();
        for (const layer of layers as Array<Record<string, unknown>>) {
          assertHydratedImage(layer.imageDataUrl);
          if (!isImageDataUrl(layer.imageDataUrl)) continue;
          const layerId = allocateAssetSegment(
            typeof layer.id === "string" ? layer.id : "layer",
            usedLayerSegments,
          );
          layer.imageDataUrl = await writeImageAsset(
            assetsRoot,
            `${basePath}/layers/${layerId}`,
            layer.imageDataUrl,
          );
        }
      }
    }
  }

  return next;
};

const hydrateProjectImages = async (
  project: ProjectData,
  assetsRoot: string,
): Promise<ProjectData> => {
  const next = cloneProjectData(project);

  if (isAssetRef(next.metadata.iconImage)) {
    next.metadata.iconImage = await resolveImageAsset(assetsRoot, next.metadata.iconImage);
  }
  if (isAssetRef(next.metadata.gameImage)) {
    next.metadata.gameImage = await resolveImageAsset(assetsRoot, next.metadata.gameImage);
  }

  for (const key of collectionAssetKeys) {
    const items = next[key];
    if (!Array.isArray(items)) continue;

    for (const item of items as unknown as Array<Record<string, unknown>>) {
      if (isAssetRef(item.image)) {
        item.image = await resolveImageAsset(assetsRoot, item.image);
      }
      if (isAssetRef(item.overlayImage)) {
        item.overlayImage = await resolveImageAsset(assetsRoot, item.overlayImage);
      }

      const layers = item.imageLayers;
      if (Array.isArray(layers)) {
        for (const layer of layers as Array<Record<string, unknown>>) {
          if (isAssetRef(layer.imageDataUrl)) {
            layer.imageDataUrl = await resolveImageAsset(
              assetsRoot,
              layer.imageDataUrl,
            );
          }
        }
      }
    }
  }

  return next;
};

let tauriProjectFiles: ProjectFileStore<ProjectData> | null = null;

const getTauriProjectFiles = (): ProjectFileStore<ProjectData> => {
  if (!tauriProjectFiles) {
    tauriProjectFiles = new ProjectFileStore<ProjectData>({
      fs: { join, exists, mkdir, readDir, readTextFile, writeTextFile, rename, remove },
      getPaths: getTauriStorePaths,
      externalize: externalizeProjectImages,
      hydrate: async (raw, assetsRoot) => {
        const candidate = raw as Partial<ProjectData> | null;
        if (
          !candidate || typeof candidate !== "object" || Array.isArray(candidate) ||
          !candidate.metadata || typeof candidate.metadata !== "object" ||
          Array.isArray(candidate.metadata) ||
          collectionAssetKeys.some((key) =>
            candidate[key] !== undefined && !Array.isArray(candidate[key]),
          )
        ) {
          throw new Error("Invalid saved project data.");
        }
        const project = sanitizeProjectData(raw);
        return assetsRoot ? hydrateProjectImages(project, assetsRoot) : project;
      },
      warn: showStorageWarning,
    });
  }
  return tauriProjectFiles;
};

const persistStoreToTauriFiles = async (
  store: ProjectStore,
  options: { deletedProjectIds?: ReadonlySet<string>; reset?: boolean } = {},
): Promise<void> => {
  await getTauriProjectFiles().save(store, options);
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

const ensureUniqueItemIds = <T extends { id: string }>(items: T[]): T[] => {
  const reservedIds = new Set(items.map((item) => item.id));
  const seenIds = new Set<string>();

  return items.map((item) => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      return item;
    }

    // Keep saved copies and their content, but give each its own editor identity.
    let id = crypto.randomUUID();
    while (reservedIds.has(id)) id = crypto.randomUUID();
    reservedIds.add(id);
    seenIds.add(id);
    return { ...item, id };
  });
};

const sanitizeProjectData = (input: any): ProjectData => {
  if (!input || typeof input !== "object") return DEFAULT_DATA;

  const toArray = <T extends { id: string }>(val: T[] | undefined): T[] =>
    ensureUniqueItemIds(Array.isArray(val) ? val : []);
  const toLocalizedArray = <
    T extends {
      id: string;
      name?: unknown;
      description?: unknown;
      localizations?: unknown;
    },
  >(
    val: T[] | undefined,
  ): T[] =>
    toArray(val).map((item) =>
      ensureLocalizableWithLanguage(item, DEFAULT_LOCALIZATION_LANGUAGE),
    ) as T[];

  return {
    ...DEFAULT_DATA,
    ...input,
    metadata: sanitizeMetadata(input.metadata),
    stats: { ...DEFAULT_DATA.stats, ...(input.stats || {}) },
    recentActivity: sanitizeRecentActivity(input.recentActivity),
    jokers: ensureUniqueItemOrderValues(toLocalizedArray(input.jokers)),
    consumables: ensureUniqueItemOrderValues(toLocalizedArray(input.consumables)),
    rarities: toArray(input.rarities),
    consumableSets: toArray(input.consumableSets),
    decks: ensureUniqueItemOrderValues(toLocalizedArray(input.decks)),
    vouchers: ensureUniqueItemOrderValues(toLocalizedArray(input.vouchers)),
    boosters: ensureUniqueItemOrderValues(toLocalizedArray(input.boosters)),
    seals: ensureUniqueItemOrderValues(toLocalizedArray(input.seals)),
    editions: ensureUniqueItemOrderValues(toLocalizedArray(input.editions)),
    enhancements: ensureUniqueItemOrderValues(
      toLocalizedArray(input.enhancements),
    ),
    sounds: toArray(normalizeSounds(input.sounds)),
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
      sanitizedProjects[key] = sanitized;
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
  const loaded = await getTauriProjectFiles().load();
  if (!loaded) return null;
  if (Object.keys(loaded.projects).length === 0) {
    // Damaged projects remain on disk. Use a separate new project in the editor
    // so autosave cannot replace one of the unreadable project identities.
    return createRecoveryStore();
  }
  return { version: 2, ...loaded };
};

const loadStoredStore = async (
  options: { preferCache?: boolean } = {},
): Promise<ProjectStore> => {
  if (options.preferCache && cachedProjectStore) {
    return cachedProjectStore;
  }
  if (loadStoredStorePromise) return loadStoredStorePromise;

  const loadStartedAtRevision = storeRevision;
  loadStoredStorePromise = (async () => {
    const tauriStore = await loadStoreFromTauriFile();
    if (tauriStore) return tauriStore;

    if (isTauriRuntime()) {
      try {
        const paths = await getTauriStorePaths();
        const legacyRaw = await readTextFile(paths.legacyStorePath);
        const migrated = sanitizeStoreFromUnknown(JSON.parse(legacyRaw));
        try {
          await persistStoreToTauriFiles(migrated);
        } catch (error) {
          // The legacy file remains the recovery source if migration fails.
          maybeShowStorageErrorAlert(error);
        }
        return migrated;
      } catch {
        // No legacy file or invalid legacy data.
      }
    }

    return loadStoreFromLocalStorage();
  })()
    .catch((error) => {
      showStorageWarning(
        "Saved projects could not be read. Their files have been kept. Check access to the app's data folder and restart the app.",
        error,
      );
      return isTauriRuntime() ? createRecoveryStore() : createDefaultStore();
    })
    .then((nextStore) => {
      if (loadStartedAtRevision === storeRevision || !cachedProjectStore) {
        cachedProjectStore = nextStore;
      }
      return cachedProjectStore;
    })
    .finally(() => {
      loadStoredStorePromise = null;
    });

  return loadStoredStorePromise;
};

const getStoredStore = (): ProjectStore =>
  cachedProjectStore ?? loadStoreFromLocalStorage();

const queueStorePersistence = (nextStore: ProjectStore, revision: number) => {
  persistQueue = persistQueue
    .then(async () => {
      if (revision !== storeRevision) return;
      try {
        if (isTauriRuntime()) {
          const deletedIds = new Map(pendingDeletedProjectIds);
          await persistStoreToTauriFiles(nextStore, {
            deletedProjectIds: new Set(deletedIds.keys()),
          });
          for (const [id, deletedAt] of deletedIds) {
            if (pendingDeletedProjectIds.get(id) === deletedAt) {
              pendingDeletedProjectIds.delete(id);
            }
          }
        } else {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
        }
        persistedStoreRevision = revision;
      } catch (error) {
        console.warn("Error saving project store", error);
        maybeShowStorageErrorAlert(error);
      }
    })
    .catch((error) => {
      console.warn("Unhandled persistence error", error);
      maybeShowStorageErrorAlert(error);
    });
};

/** Finish saving the latest edits before an update can close the app. */
export const hasPendingProjectSaves = (): boolean =>
  persistedStoreRevision < storeRevision || isResettingProjectData;

export const flushPendingProjectSaves = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  await loadStoredStore({ preferCache: true });
  let retriedRevision: number | null = null;

  for (;;) {
    const queue = persistQueue;
    const revision = storeRevision;
    await queue;
    // Edits can arrive while hydration or an earlier write is finishing.
    if (queue !== persistQueue || revision !== storeRevision) continue;
    if (isResettingProjectData) {
      throw new Error("Wait for the project reset to finish before updating.");
    }
    if (persistedStoreRevision >= storeRevision) return;
    if (retriedRevision === storeRevision || !cachedProjectStore) {
      throw new Error(
        "Your latest project changes could not be saved. Check free disk space and access to the app's data folder, then try again.",
      );
    }
    // A previously failed autosave must be retryable without another edit.
    retriedRevision = storeRevision;
    queueStorePersistence(cachedProjectStore, storeRevision);
  }
};

export const useProjectData = () => {
  const [store, setStore] = useState<ProjectStore>(getStoredStore);
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

      void loadStoredStore({ preferCache: event?.type !== "storage" }).then((nextStore) => {
        cachedProjectStore = nextStore;
        setStore(nextStore);
        setIsHydrating(false);
      });
    };

    let isMounted = true;
    void loadStoredStore({ preferCache: true }).then((nextStore) => {
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
      currentProject.metadata.disable_vanilla === true,
    );
  }, [currentProject]);

  const saveStore = useCallback((nextStore: ProjectStore) => {
    const revision = ++storeRevision;
    // Keep deletions outside individual queued snapshots: autosave coalescing
    // may skip the first save following a delete.
    for (const id of Object.keys(cachedProjectStore?.projects ?? {})) {
      if (!Object.prototype.hasOwnProperty.call(nextStore.projects, id)) {
        pendingDeletedProjectIds.set(id, revision);
      }
    }
    for (const id of Object.keys(nextStore.projects)) pendingDeletedProjectIds.delete(id);
    cachedProjectStore = nextStore;
    scheduleLocalStoreUpdate({
      store: nextStore,
      sourceId: sourceIdRef.current,
    });

    queueStorePersistence(nextStore, revision);
  }, []);

  const commitStore = useCallback(
    (updater: (previous: ProjectStore) => ProjectStore) => {
      // React may replay state updaters. Resolve and persist the mutation once,
      // then give React the finished snapshot so replay cannot duplicate it.
      const resetEpoch = projectResetEpoch;
      const applyUpdate = () => {
        if (isResettingProjectData || resetEpoch !== projectResetEpoch) return;
        const previous = cachedProjectStore ?? getStoredStore();
        const nextStore = updater(previous);
        if (nextStore === previous) return;
        saveStore(nextStore);
        setStore(nextStore);
      };
      if (isTauriRuntime() && cachedProjectStore === null) {
        // Apply early clicks to the loaded projects, never the temporary default.
        void loadStoredStore({ preferCache: true }).then(applyUpdate);
      } else {
        applyUpdate();
      }
    },
    [saveStore],
  );

  const updateMetadata = useCallback(
    (updatesOrUpdater: MetadataUpdateArg) => {
      commitStore((baseStore) => {
        const currentId = baseStore.currentProjectId;
        const current = baseStore.projects[currentId] || DEFAULT_DATA;
        const updates =
          typeof updatesOrUpdater === "function"
            ? updatesOrUpdater(current.metadata)
            : updatesOrUpdater;

        if (!updates || Object.keys(updates).length === 0) {
          return baseStore;
        }

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

        const nextStore = {
          ...baseStore,
          projects: { ...baseStore.projects, [currentId]: updatedProject },
        };
        return nextStore;
      });
    },
    [commitStore],
  );

  const updateCollection = useCallback(
    <K extends keyof ProjectData>(
      key: K,
      itemsOrUpdater:
        | ProjectData[K]
        | ((previous: ProjectData[K]) => ProjectData[K]),
    ) => {
      commitStore((baseStore) => {
        const currentId = baseStore.currentProjectId;
        const current = baseStore.projects[currentId] || DEFAULT_DATA;
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
          ...baseStore,
          projects: { ...baseStore.projects, [currentId]: updatedProject },
        };
        return nextStore;
      });
    },
    [commitStore],
  );

  const switchProject = useCallback(
    (projectId: string) => {
      commitStore((baseStore) => {
        if (!baseStore.projects[projectId]) return baseStore;
        const nextStore = { ...baseStore, currentProjectId: projectId };
        return nextStore;
      });
    },
    [commitStore],
  );

  const createProject = useCallback(
    (metadataOverrides: Partial<ModMetadata> = {}) => {
      let createdId = "";
      commitStore((baseStore) => {
        const baseMetadata = sanitizeMetadata({
          ...DEFAULT_METADATA,
          ...metadataOverrides,
        });
        const baseId = baseMetadata.id || DEFAULT_METADATA.id;
        const uniqueId = ensureUniqueProjectId(baseId, baseStore.projects);
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
          ...baseStore,
          currentProjectId: uniqueId,
          projects: { ...baseStore.projects, [uniqueId]: newProject },
        };
        createdId = uniqueId;
        return nextStore;
      });
      return createdId;
    },
    [commitStore],
  );

  const deleteProject = useCallback(
    (projectId: string) => {
      commitStore((baseStore) => {
        if (!baseStore.projects[projectId]) return baseStore;

        const { [projectId]: _removed, ...remaining } = baseStore.projects;
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
          return nextStore;
        }

        const nextCurrentId =
          baseStore.currentProjectId === projectId
            ? remainingIds[0]
            : baseStore.currentProjectId;

        const nextStore: ProjectStore = {
          ...baseStore,
          currentProjectId: nextCurrentId,
          projects: remaining,
        };
        return nextStore;
      });
    },
    [commitStore],
  );

  // Imports always create a separate workspace project. Mod identity belongs
  // to metadata.id; names and mod IDs never authorize replacing saved work.
  const importProject = useCallback(
    (projectData: ProjectData) => {
      const normalizedProject = sanitizeProjectData(projectData);
      commitStore((baseStore) => {
        const workspaceProjectId = ensureUniqueProjectId(
          crypto.randomUUID(),
          baseStore.projects,
        );
        const nextStore: ProjectStore = {
          ...baseStore,
          currentProjectId: workspaceProjectId,
          projects: {
            ...baseStore.projects,
            [workspaceProjectId]: normalizedProject,
          },
        };
        return nextStore;
      });
    },
    [commitStore],
  );

  const projects = Object.entries(store.projects).map(([projectId, project]) => ({
    id: projectId,
    modId: project.metadata.id,
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

export const resetProjectData = async (): Promise<boolean> => {
  if (typeof window === "undefined" || isResettingProjectData) return false;
  isResettingProjectData = true;
  ++projectResetEpoch;
  const defaultStore = createDefaultStore();
  try {
    if (isTauriRuntime()) {
      // Initial migration also writes files. Finish it before queuing a reset,
      // so a late migration cannot restore projects after the reset commits.
      if (loadStoredStorePromise) await loadStoredStorePromise;
      else await loadStoredStore({ preferCache: true });
      const reset = persistQueue.then(() =>
        persistStoreToTauriFiles(defaultStore, { reset: true }),
      );
      persistQueue = reset.catch(() => {});
      await reset;
    }
  } catch (error) {
    console.warn("Error resetting file-backed store", error);
    maybeShowStorageErrorAlert(error);
    isResettingProjectData = false;
    return false;
  }
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
  window.localStorage.removeItem(JOKERFORGE_EXPORT_SAVE_MODE_KEY);
  window.localStorage.removeItem(JOKERFORGE_EXPORT_AS_JSON_KEY);
  window.localStorage.removeItem(SINGLE_MANAGED_MOD_EXPORT_KEY);
  window.localStorage.removeItem(JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY);
  window.localStorage.removeItem(LAUNCH_GAME_ON_EXPORT_KEY);
  window.localStorage.removeItem(DESCRIPTION_VARIABLE_PLACEHOLDERS_KEY);
  window.localStorage.removeItem(RULE_BUILDER_SETTINGS_KEY);
  window.localStorage.removeItem(THEME_PREFERENCE_KEY);
  clearThemeStorage();
  ++storeRevision;
  persistedStoreRevision = storeRevision;
  cachedProjectStore = defaultStore;
  pendingDeletedProjectIds.clear();
  scheduleLocalStoreUpdate({ store: defaultStore, sourceId: "reset" });
  isResettingProjectData = false;
  return true;
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
  if (typeof window === "undefined") return "downloads";
  const stored = window.localStorage.getItem(JOKERFORGE_EXPORT_SAVE_MODE_KEY);
  if (stored === "ask" || stored === "downloads") {
    return stored;
  }

  const legacyDestinationMode = window.localStorage.getItem(
    EXPORT_DESTINATION_MODE_KEY,
  );
  if (legacyDestinationMode === "ask" || legacyDestinationMode === "downloads") {
    return legacyDestinationMode;
  }

  // Migrate from legacy auto-save downloads toggle.
  if (window.localStorage.getItem(JOKERFORGE_AUTO_SAVE_DOWNLOADS_KEY) === "true") {
    return "downloads";
  }

  return "downloads";
};

export const setJokerforgeExportSaveMode = (mode: JokerforgeExportSaveMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOKERFORGE_EXPORT_SAVE_MODE_KEY, mode);
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
    const parsed = JSON.parse(stored);
    const settings = sanitizeRuleBuilderSettings(parsed);
    if (
      (parsed?.canvasNavigationVersion ?? 0) <
      RULE_BUILDER_CANVAS_NAVIGATION_VERSION
    ) {
      // Apply the new navigation default once, preserving later explicit choices.
      settings.enableLeftMousePan = true;
      window.localStorage.setItem(
        RULE_BUILDER_SETTINGS_KEY,
        JSON.stringify({
          ...settings,
          canvasNavigationVersion: RULE_BUILDER_CANVAS_NAVIGATION_VERSION,
        }),
      );
    }
    return settings;
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
  window.localStorage.setItem(
    RULE_BUILDER_SETTINGS_KEY,
    JSON.stringify({
      ...merged,
      canvasNavigationVersion: RULE_BUILDER_CANVAS_NAVIGATION_VERSION,
    }),
  );
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
