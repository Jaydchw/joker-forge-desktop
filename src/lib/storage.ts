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

const getStoredData = (): ProjectData => {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (!item) return DEFAULT_DATA;

    const parsed = JSON.parse(item);

    // Deep merge / Sanitize critical sections
    return {
      ...DEFAULT_DATA,
      ...parsed,
      metadata: sanitizeMetadata(parsed.metadata),
      stats: { ...DEFAULT_DATA.stats, ...(parsed.stats || {}) },
    };
  } catch (error) {
    console.warn("Error reading/sanitizing localStorage", error);
    return DEFAULT_DATA;
  }
};

export const useProjectData = () => {
  const [data, setData] = useState<ProjectData>(getStoredData());

  useEffect(() => {
    const handleStorageChange = () => {
      setData(getStoredData());
    };

    window.addEventListener(EVENT_KEY, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(EVENT_KEY, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    updateDataRegistry(
      data.rarities,
      data.consumableSets,
      data.sounds,
      data.consumables,
      data.boosters,
      data.enhancements,
      data.seals,
      data.editions,
      data.vouchers,
      data.decks,
      data.metadata.prefix || "",
    );
  }, [data]);

  const saveData = (newData: ProjectData) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setTimeout(() => {
        window.dispatchEvent(new Event(EVENT_KEY));
      }, 0);
    } catch (error) {
      console.warn("Error saving to localStorage", error);
    }
  };

  const updateMetadata = useCallback((updates: Partial<ModMetadata>) => {
    setData((prev) => {
      const newData = {
        ...prev,
        metadata: { ...prev.metadata, ...updates },
      };
      saveData(newData);
      return newData;
    });
  }, []);

  const updateCollection = useCallback(
    <K extends keyof ProjectData>(key: K, items: ProjectData[K]) => {
      setData((prev) => {
        const newData = {
          ...prev,
          [key]: items,
          stats: {
            ...prev.stats,
            [key]: Array.isArray(items)
              ? items.length
              : prev.stats[key as keyof ProjectStats],
          },
        };
        saveData(newData);
        return newData;
      });
    },
    [],
  );

  return {
    data,
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
  window.localStorage.setItem(BALATRO_PATH_KEY, value);
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
