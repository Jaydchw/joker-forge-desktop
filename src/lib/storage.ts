import { useState, useEffect, useCallback } from "react";
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
} from "@/lib/types";
import { ModMetadata, updateDataRegistry } from "@/lib/balatro-utils";

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
const EVENT_KEY = "joker_forge_update";
const CONFIRM_DELETE_KEY = "joker_forge_confirm_delete";
const UI_SCALE_KEY = "app-ui-scale";
const BALATRO_PATH_KEY = "joker_forge_balatro_path";
const BALATRO_AUTOFIND_KEY = "joker_forge_balatro_autofind";
const BALATRO_AUTOFIND_ALERT_KEY = "joker_forge_balatro_autofind_alert";

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

const getStoredStore = (): ProjectStore => {
  if (typeof window === "undefined") {
    return {
      version: 2,
      currentProjectId: DEFAULT_METADATA.id,
      projects: { [DEFAULT_METADATA.id]: DEFAULT_DATA },
    };
  }
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (!item) {
      return {
        version: 2,
        currentProjectId: DEFAULT_METADATA.id,
        projects: { [DEFAULT_METADATA.id]: DEFAULT_DATA },
      };
    }

    const parsed = JSON.parse(item);

    if (parsed?.version === 2 && parsed.projects && parsed.currentProjectId) {
      const sanitizedProjects: Record<string, ProjectData> = {};
      Object.entries(parsed.projects as Record<string, ProjectData>).forEach(
        ([key, value]) => {
          const sanitized = sanitizeProjectData(value);
          sanitizedProjects[key] = {
            ...sanitized,
            metadata: { ...sanitized.metadata, id: key },
          };
        },
      );

      const fallbackId = Object.keys(sanitizedProjects)[0];
      return {
        version: 2,
        currentProjectId:
          parsed.currentProjectId && sanitizedProjects[parsed.currentProjectId]
            ? parsed.currentProjectId
            : fallbackId || DEFAULT_METADATA.id,
        projects:
          Object.keys(sanitizedProjects).length > 0
            ? sanitizedProjects
            : { [DEFAULT_METADATA.id]: DEFAULT_DATA },
      };
    }

    if (parsed?.metadata) {
      const legacyProject = sanitizeProjectData(parsed);
      const legacyId = legacyProject.metadata.id || DEFAULT_METADATA.id;
      return {
        version: 2,
        currentProjectId: legacyId,
        projects: { [legacyId]: legacyProject },
      };
    }

    return {
      version: 2,
      currentProjectId: DEFAULT_METADATA.id,
      projects: { [DEFAULT_METADATA.id]: DEFAULT_DATA },
    };
  } catch (error) {
    console.warn("Error reading/sanitizing localStorage", error);
    return {
      version: 2,
      currentProjectId: DEFAULT_METADATA.id,
      projects: { [DEFAULT_METADATA.id]: DEFAULT_DATA },
    };
  }
};

export const useProjectData = () => {
  const [store, setStore] = useState<ProjectStore>(getStoredStore());

  useEffect(() => {
    const handleStorageChange = () => {
      setStore(getStoredStore());
    };

    window.addEventListener(EVENT_KEY, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(EVENT_KEY, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const currentProject = store.projects[store.currentProjectId] || DEFAULT_DATA;

  useEffect(() => {
    updateDataRegistry(
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

  const saveStore = (nextStore: ProjectStore) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
      setTimeout(() => {
        window.dispatchEvent(new Event(EVENT_KEY));
      }, 0);
    } catch (error) {
      console.warn("Error saving to localStorage", error);
    }
  };

  const updateMetadata = useCallback((updates: Partial<ModMetadata>) => {
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
  }, []);

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
    [],
  );

  const switchProject = useCallback((projectId: string) => {
    setStore((prev) => {
      if (!prev.projects[projectId]) return prev;
      const nextStore = { ...prev, currentProjectId: projectId };
      saveStore(nextStore);
      return nextStore;
    });
  }, []);

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
    [],
  );

  const deleteProject = useCallback((projectId: string) => {
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
  }, []);

  const projects = Object.values(store.projects).map((project) => ({
    id: project.metadata.id,
    name: project.metadata.name,
    version: project.metadata.version,
  }));

  return {
    data: currentProject,
    projects,
    currentProjectId: store.currentProjectId,
    switchProject,
    createProject,
    deleteProject,
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
  window.dispatchEvent(new Event(EVENT_KEY));
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
  const normalizedValue = /^[a-zA-Z]:\\/.test(value)
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

export const useModName = () => {
  const { data } = useProjectData();
  return data.metadata.name;
};
