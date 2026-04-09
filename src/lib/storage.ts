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

export interface ProjectData {
  stats: ProjectStats;
  metadata: ModMetadata;
  recentActivity: string[];
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
    recentActivity: toArray(input.recentActivity),
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
        const updatedProject: ProjectData = {
          ...current,
          metadata: { ...current.metadata, ...updates },
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
        const updatedProject: ProjectData = {
          ...current,
          [key]: items,
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
