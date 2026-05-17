export type PlaceholderCategory =
  | "joker"
  | "consumable"
  | "deck"
  | "enhancement"
  | "seal"
  | "voucher"
  | "booster";

export type PlaceholderEntry = {
  category: PlaceholderCategory;
  index: number;
  src: string;
  credit: string;
};

export type PlaceholderMeta = PlaceholderEntry;

type CategoryConfig = {
  label: string;
  folder: string;
  prefix: string;
};

const CATEGORY_CONFIG: Record<PlaceholderCategory, CategoryConfig> = {
  joker: {
    label: "Jokers",
    folder: "placeholderjokers",
    prefix: "placeholder-joker",
  },
  consumable: {
    label: "Consumables",
    folder: "placeholderconsumables",
    prefix: "placeholder-consumable",
  },
  deck: {
    label: "Decks",
    folder: "placeholderdecks",
    prefix: "placeholder-deck",
  },
  enhancement: {
    label: "Enhancements",
    folder: "placeholderenhancements",
    prefix: "placeholder-enhancement",
  },
  seal: {
    label: "Seals",
    folder: "placeholderseals",
    prefix: "placeholder-seal",
  },
  voucher: {
    label: "Vouchers",
    folder: "placeholdervouchers",
    prefix: "placeholder-voucher",
  },
  booster: {
    label: "Boosters",
    folder: "placeholderboosters",
    prefix: "placeholder-booster",
  },
};

export const PLACEHOLDER_CATEGORIES = Object.keys(
  CATEGORY_CONFIG,
) as PlaceholderCategory[];

const registryCache: Partial<Record<PlaceholderCategory, PlaceholderEntry[]>> =
  {};
const registryPromiseCache: Partial<
  Record<PlaceholderCategory, Promise<PlaceholderEntry[]>>
> = {};

const buildEntrySrc = (category: PlaceholderCategory, index: number) => {
  const config = CATEGORY_CONFIG[category];
  return `/images/${config.folder}/${config.prefix}-${index}.png`;
};

const parseCredits = (
  raw: string,
): Array<{ index: number; credit: string }> => {
  const rows: Array<{ index: number; credit: string }> = [];

  raw.split(/\r?\n/).forEach((line) => {
    const row = line.trim();
    if (!row) return;

    const match = row.match(/^(\d+)\s*:\s*(.+)$/);
    if (!match) return;

    const index = Number.parseInt(match[1], 10);
    if (Number.isNaN(index)) return;

    rows.push({ index, credit: match[2].trim() || "Unknown" });
  });

  return rows.sort((a, b) => a.index - b.index);
};

const loadCategoryRegistry = async (
  category: PlaceholderCategory,
): Promise<PlaceholderEntry[]> => {
  if (registryCache[category]) return registryCache[category] || [];
  if (registryPromiseCache[category]) {
    return registryPromiseCache[category] || [];
  }

  const loadPromise = (async () => {
    const config = CATEGORY_CONFIG[category];
    const creditUrl = `/images/${config.folder}/credit.txt`;

    try {
      const response = await fetch(creditUrl, { cache: "no-store" });
      if (!response.ok) {
        registryCache[category] = [];
        return [];
      }

      const text = await response.text();
      const entries = parseCredits(text).map(({ index, credit }) => ({
        category,
        index,
        credit,
        src: buildEntrySrc(category, index),
      }));

      registryCache[category] = entries;
      return entries;
    } catch {
      registryCache[category] = [];
      return [];
    }
  })();

  registryPromiseCache[category] = loadPromise;
  return loadPromise;
};

export const getPlaceholderCategoryLabel = (category: PlaceholderCategory) =>
  CATEGORY_CONFIG[category].label;

export const getPlaceholderEntriesForCategory = async (
  category: PlaceholderCategory,
): Promise<PlaceholderEntry[]> => {
  return loadCategoryRegistry(category);
};

export const getAllPlaceholderEntries = async (): Promise<
  Record<PlaceholderCategory, PlaceholderEntry[]>
> => {
  const rows = await Promise.all(
    PLACEHOLDER_CATEGORIES.map(async (category) => {
      const entries = await loadCategoryRegistry(category);
      return [category, entries] as const;
    }),
  );

  return Object.fromEntries(rows) as Record<
    PlaceholderCategory,
    PlaceholderEntry[]
  >;
};

export const getRandomPlaceholder = async (
  category: PlaceholderCategory,
): Promise<PlaceholderEntry | null> => {
  const entries = await loadCategoryRegistry(category);
  if (!entries.length) return null;
  const idx = Math.floor(Math.random() * entries.length);
  return entries[idx];
};

export const parsePlaceholderFromImageSrc = (src: string) => {
  const normalized = src.replace(/\\/g, "/").toLowerCase();

  const match = normalized.match(
    /placeholder-(joker|consumable|deck|enhancement|seal|voucher|booster)-(\d+)\.png(?:\?.*)?$/,
  );
  if (!match) return null;

  const category = match[1] as PlaceholderCategory;
  const index = Number.parseInt(match[2], 10);
  if (Number.isNaN(index)) return null;

  return { category, index };
};

export const getPlaceholderMetaForImageSrc = async (
  src: string,
): Promise<PlaceholderMeta | null> => {
  const parsed = parsePlaceholderFromImageSrc(src);
  if (!parsed) return null;

  const entries = await loadCategoryRegistry(parsed.category);
  const entry = entries.find((row) => row.index === parsed.index);
  return entry || null;
};
