import { useState, useEffect } from "react";

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
}

const DEFAULT_STATS: ProjectStats = {
  jokers: 12,
  consumables: 5,
  decks: 2,
  enhancements: 8,
  seals: 4,
  editions: 4,
  sounds: 0,
  vouchers: 3,
  boosters: 6,
};

const DEFAULT_METADATA: ModMetadata = {
  name: "My Custom Mod",
  author: "Anonymous",
  version: "1.0.0",
  description: "A Balatro mod created with Joker Forge.",
  id: "my_custom_mod",
  prefix: "jkr",
};

export const useProjectData = () => {
  const [data, setData] = useState<ProjectData>({
    stats: DEFAULT_STATS,
    metadata: DEFAULT_METADATA,
    recentActivity: ["Modified 'Baron' Joker", "Added 'Gold' Seal"],
  });

  const updateMetadata = (updates: Partial<ModMetadata>) => {
    setData((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, ...updates },
    }));
  };

  useEffect(() => {
    
  }, []);

  return { data, updateMetadata };
};