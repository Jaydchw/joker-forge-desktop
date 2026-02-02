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
  SoundData 
} from "@/lib/types";

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
}

export interface ModMetadata {
  name: string;
  author: string;
  version: string;
  description: string;
  id: string;
  prefix: string;
}

export interface ProjectData {
  stats: ProjectStats;
  metadata: ModMetadata;
  recentActivity: string[];
  jokers: JokerData[];
  consumables: ConsumableData[];
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
};

const DEFAULT_METADATA: ModMetadata = {
  name: "My Custom Mod",
  author: "Anonymous",
  version: "1.0.0",
  description: "A Balatro mod created with Joker Forge.",
  id: "my_custom_mod",
  prefix: "jkr",
};

const DEFAULT_DATA: ProjectData = {
  stats: DEFAULT_STATS,
  metadata: DEFAULT_METADATA,
  recentActivity: [],
  jokers: [],
  consumables: [],
  decks: [],
  vouchers: [],
  boosters: [],
  seals: [],
  editions: [],
  enhancements: [],
  sounds: [],
};

const getStoredData = (): ProjectData => {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    return item ? { ...DEFAULT_DATA, ...JSON.parse(item) } : DEFAULT_DATA;
  } catch (error) {
    console.warn("Error reading from localStorage", error);
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

  const saveData = (newData: ProjectData) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      window.dispatchEvent(new Event(EVENT_KEY));
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

  const updateCollection = useCallback(<K extends keyof ProjectData>(key: K, items: ProjectData[K]) => {
    setData((prev) => {
      const newData = {
        ...prev,
        [key]: items,
        stats: {
          ...prev.stats,
          [key]: Array.isArray(items) ? items.length : prev.stats[key as keyof ProjectStats]
        }
      };
      saveData(newData);
      return newData;
    });
  }, []);

  return { 
    data, 
    updateMetadata,
    updateJokers: (items: JokerData[]) => updateCollection('jokers', items),
    updateConsumables: (items: ConsumableData[]) => updateCollection('consumables', items),
    updateDecks: (items: DeckData[]) => updateCollection('decks', items),
    updateVouchers: (items: VoucherData[]) => updateCollection('vouchers', items),
    updateBoosters: (items: BoosterData[]) => updateCollection('boosters', items),
    updateSeals: (items: SealData[]) => updateCollection('seals', items),
    updateEditions: (items: EditionData[]) => updateCollection('editions', items),
    updateEnhancements: (items: EnhancementData[]) => updateCollection('enhancements', items),
    updateSounds: (items: SoundData[]) => updateCollection('sounds', items),
  };
};

export const useModName = () => {
  const { data } = useProjectData();
  return data.metadata.name;
};