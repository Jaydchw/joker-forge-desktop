import { invoke } from "@tauri-apps/api/core";
import { downloadDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import type {
  BaseGameObject,
  ConsumableData,
  DeckData,
  EditionData,
  EnhancementData,
  JokerData,
  ModMetadata,
  SealData,
  VoucherData,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Public option / result types
// ---------------------------------------------------------------------------

interface CompileSingleJokerOptions {
  includeLocTxt?: boolean;
}

export type PreviewCompileItemType =
  | "joker"
  | "consumable"
  | "voucher"
  | "deck"
  | "enhancement"
  | "seal"
  | "edition";

interface ExportModRustOptions {
  useLocalizationFile?: boolean;
  localizationLocale?: string;
  destinationMode?: "downloads" | "balatro-mods";
  balatroModsPath?: string;
}

type ItemWithImage = Pick<
  BaseGameObject,
  "id" | "orderValue" | "image" | "overlayImage" | "objectKey"
>;

export interface ExportModRustResult {
  exportRootPath: string;
  modFolderPath: string;
  fileCount: number;
}

// ---------------------------------------------------------------------------
// Atlas building (browser Canvas , stays in TypeScript)
// ---------------------------------------------------------------------------

interface AtlasPos {
  x: number;
  y: number;
}

interface AtlasBuildResult {
  atlasDataUrl: string;
  positionsById: Record<string, AtlasPos>;
  soulPositionsById: Record<string, AtlasPos>;
}

const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!src || src.trim().length === 0) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

const buildItemAtlas = async (
  items: ItemWithImage[],
  scale: number,
): Promise<AtlasBuildResult> => {
  const itemsPerRow = 10;
  const sorted = [...items].sort((a, b) => a.orderValue - b.orderValue);
  const totalPositions = sorted.reduce(
    (count, item) => count + (item.overlayImage ? 2 : 1),
    0,
  );
  const rows = Math.max(1, Math.ceil(totalPositions / itemsPerRow));

  const canvas = document.createElement("canvas");
  canvas.width = itemsPerRow * 71 * scale;
  canvas.height = rows * 95 * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to build item atlas: missing canvas context.");
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const positionsById: Record<string, AtlasPos> = {};
  const soulPositionsById: Record<string, AtlasPos> = {};

  let currentPosition = 0;
  for (const item of sorted) {
    const col = currentPosition % itemsPerRow;
    const row = Math.floor(currentPosition / itemsPerRow);
    positionsById[item.id] = { x: col, y: row };

    const baseImage = await loadImage(item.image || "");
    if (baseImage) {
      ctx.drawImage(
        baseImage,
        0,
        0,
        baseImage.width,
        baseImage.height,
        col * 71 * scale,
        row * 95 * scale,
        71 * scale,
        95 * scale,
      );
    }
    currentPosition += 1;

    if (item.overlayImage && item.overlayImage.trim().length > 0) {
      const soulCol = currentPosition % itemsPerRow;
      const soulRow = Math.floor(currentPosition / itemsPerRow);
      soulPositionsById[item.id] = { x: soulCol, y: soulRow };

      const overlayImage = await loadImage(item.overlayImage);
      if (overlayImage) {
        ctx.drawImage(
          overlayImage,
          0,
          0,
          overlayImage.width,
          overlayImage.height,
          soulCol * 71 * scale,
          soulRow * 95 * scale,
          71 * scale,
          95 * scale,
        );
      }
      currentPosition += 1;
    }
  }

  return {
    atlasDataUrl: canvas.toDataURL("image/png"),
    positionsById,
    soulPositionsById,
  };
};

const buildJokerAtlas = async (
  jokers: JokerData[],
  scale: number,
): Promise<AtlasBuildResult> => {
  const itemsPerRow = 10;
  const sorted = [...jokers].sort((a, b) => a.orderValue - b.orderValue);
  const totalPositions = sorted.reduce(
    (count, joker) => count + (joker.overlayImage ? 2 : 1),
    0,
  );
  const rows = Math.max(1, Math.ceil(totalPositions / itemsPerRow));

  const canvas = document.createElement("canvas");
  canvas.width = itemsPerRow * 71 * scale;
  canvas.height = rows * 95 * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to build joker atlas: missing canvas context.");
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const positionsById: Record<string, AtlasPos> = {};
  const soulPositionsById: Record<string, AtlasPos> = {};

  let currentPosition = 0;
  for (const joker of sorted) {
    const col = currentPosition % itemsPerRow;
    const row = Math.floor(currentPosition / itemsPerRow);
    positionsById[joker.id] = { x: col, y: row };

    const x = col * 71 * scale;
    const y = row * 95 * scale;
    const baseImage = await loadImage(joker.image || "");
    if (baseImage) {
      ctx.drawImage(
        baseImage,
        0,
        0,
        baseImage.width,
        baseImage.height,
        x,
        y,
        71 * scale,
        95 * scale,
      );
    }
    currentPosition += 1;

    if (joker.overlayImage && joker.overlayImage.trim().length > 0) {
      const soulCol = currentPosition % itemsPerRow;
      const soulRow = Math.floor(currentPosition / itemsPerRow);
      soulPositionsById[joker.id] = { x: soulCol, y: soulRow };

      const soulX = soulCol * 71 * scale;
      const soulY = soulRow * 95 * scale;
      const overlayImage = await loadImage(joker.overlayImage);
      if (overlayImage) {
        ctx.drawImage(
          overlayImage,
          0,
          0,
          overlayImage.width,
          overlayImage.height,
          soulX,
          soulY,
          71 * scale,
          95 * scale,
        );
      }
      currentPosition += 1;
    }
  }

  return {
    atlasDataUrl: canvas.toDataURL("image/png"),
    positionsById,
    soulPositionsById,
  };
};

const dataURLToUint8Array = (dataUrl: string): Uint8Array => {
  const [, data] = dataUrl.split(",");
  const decoded = atob(data || "");
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
};

const downloadBlob = (filename: string, content: Blob) => {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const ensureUniqueModFolderPath = async (
  exportRootPath: string,
  modId: string,
): Promise<string> => {
  const basePath = await join(exportRootPath, modId);
  if (!(await exists(basePath))) return basePath;
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  return join(exportRootPath, `${modId}_${timestamp}`);
};

const resolveExportRootPath = async (
  options: ExportModRustOptions,
): Promise<string> => {
  const destinationMode = options.destinationMode ?? "downloads";
  if (destinationMode === "balatro-mods") {
    const balatroModsPath = (options.balatroModsPath || "").trim();
    if (!balatroModsPath) {
      throw new Error(
        "Balatro mods folder is not configured. Set it in Settings -> Paths.",
      );
    }
    if (!(await exists(balatroModsPath))) {
      throw new Error(`Balatro mods folder does not exist: ${balatroModsPath}`);
    }
    return balatroModsPath;
  }
  const downloadsPath = await downloadDir();
  if (!downloadsPath || !(await exists(downloadsPath))) {
    throw new Error("Unable to resolve Downloads folder for export.");
  }
  return downloadsPath;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a single joker to Lua.
 *
 * Kept as a convenience wrapper for joker-only call sites.
 */
export const compileSingleItemLua = async (
  item: unknown,
  itemType: PreviewCompileItemType,
  modPrefix: string,
  options: CompileSingleJokerOptions = {},
): Promise<string> => {
  return invoke<string>("compile_item_from_data", {
    itemType,
    itemData: item,
    pos: null,
    soulPos: null,
    modPrefix,
    includeLocTxt: options.includeLocTxt ?? true,
  });
};

export const compileSingleJokerLua = async (
  joker: JokerData,
  modPrefix: string,
  options: CompileSingleJokerOptions = {},
): Promise<string> => {
  return compileSingleItemLua(joker, "joker", modPrefix, options);
};

/**
 * Compile a single joker and trigger a browser download.
 * Uses custom code when available.
 */
export const exportSingleJokerRust = async (
  joker: JokerData,
  modPrefix: string,
): Promise<void> => {
  const code = joker.customCode?.fullCode
    ? joker.customCode.fullCode
    : await compileSingleJokerLua(joker, modPrefix);
  downloadBlob(
    `${joker.objectKey}.lua`,
    new Blob([code], { type: "text/plain" }),
  );
};

/**
 * Compile any item type and trigger a browser download.
 */
export const exportSingleItemRust = async (
  item: BaseGameObject,
  itemType: PreviewCompileItemType,
  modPrefix: string,
): Promise<void> => {
  const code = item.customCode?.fullCode
    ? item.customCode.fullCode
    : await compileSingleItemLua(item, itemType, modPrefix);
  downloadBlob(
    `${item.objectKey}.lua`,
    new Blob([code], { type: "text/plain" }),
  );
};

/**
 * Export a complete mod to disk.
 *
 * Atlas image building stays in TypeScript (Canvas API).
 * All Lua compilation + file writing is delegated to a single Rust call,
 * covering all item types: jokers, consumables, vouchers, decks, enhancements,
 * seals, and editions.
 */
export const exportModRust = async (
  metadata: ModMetadata,
  jokers: JokerData[],
  consumables: ConsumableData[],
  vouchers: VoucherData[],
  decks: DeckData[],
  enhancements: EnhancementData[],
  seals: SealData[],
  editions: EditionData[],
  options: ExportModRustOptions = {},
): Promise<ExportModRustResult> => {
  const exportRootPath = await resolveExportRootPath(options);
  const modFolderPath = await ensureUniqueModFolderPath(
    exportRootPath,
    metadata.id,
  );
  const useLocalizationFile = options.useLocalizationFile ?? false;
  const locale = options.localizationLocale ?? "en-us";

  const sortedJokers = [...jokers].sort((a, b) => a.orderValue - b.orderValue);
  const sortedConsumables = [...consumables].sort((a, b) => a.orderValue - b.orderValue);
  const sortedVouchers = [...vouchers].sort((a, b) => a.orderValue - b.orderValue);
  const sortedDecks = [...decks].sort((a, b) => a.orderValue - b.orderValue);
  const sortedEnhancements = [...enhancements].sort((a, b) => a.orderValue - b.orderValue);
  const sortedSeals = [...seals].sort((a, b) => a.orderValue - b.orderValue);
  const sortedEditions = [...editions].sort((a, b) => a.orderValue - b.orderValue);

  const jokerAtlas1x = sortedJokers.length > 0 ? await buildJokerAtlas(sortedJokers, 1) : null;
  const jokerAtlas2x = sortedJokers.length > 0 ? await buildJokerAtlas(sortedJokers, 2) : null;

  const consumablesAtlas1x = sortedConsumables.length > 0 ? await buildItemAtlas(sortedConsumables, 1) : null;
  const consumablesAtlas2x = sortedConsumables.length > 0 ? await buildItemAtlas(sortedConsumables, 2) : null;

  const vouchersAtlas1x = sortedVouchers.length > 0 ? await buildItemAtlas(sortedVouchers, 1) : null;
  const vouchersAtlas2x = sortedVouchers.length > 0 ? await buildItemAtlas(sortedVouchers, 2) : null;

  const decksAtlas1x = sortedDecks.length > 0 ? await buildItemAtlas(sortedDecks, 1) : null;
  const decksAtlas2x = sortedDecks.length > 0 ? await buildItemAtlas(sortedDecks, 2) : null;

  const enhancementsAtlas1x = sortedEnhancements.length > 0 ? await buildItemAtlas(sortedEnhancements, 1) : null;
  const enhancementsAtlas2x = sortedEnhancements.length > 0 ? await buildItemAtlas(sortedEnhancements, 2) : null;

  const sealsAtlas1x = sortedSeals.length > 0 ? await buildItemAtlas(sortedSeals, 1) : null;
  const sealsAtlas2x = sortedSeals.length > 0 ? await buildItemAtlas(sortedSeals, 2) : null;

  const fileCount = await invoke<number>("export_mod_package", {
    modFolderPath,
    metadata,
    jokers: sortedJokers.map((joker) => ({
      jokerData: joker,
      pos: jokerAtlas1x?.positionsById[joker.id] ?? { x: 0, y: 0 },
      soulPos: jokerAtlas1x?.soulPositionsById[joker.id] ?? null,
      fileName: `${joker.objectKey}.lua`,
      customLua: joker.customCode?.fullCode ?? null,
    })),
    consumables: sortedConsumables.map((item) => ({
      consumableData: item,
      pos: consumablesAtlas1x?.positionsById[item.id] ?? { x: 0, y: 0 },
      soulPos: consumablesAtlas1x?.soulPositionsById[item.id] ?? null,
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    vouchers: sortedVouchers.map((item) => ({
      voucherData: item,
      pos: vouchersAtlas1x?.positionsById[item.id] ?? { x: 0, y: 0 },
      soulPos: vouchersAtlas1x?.soulPositionsById[item.id] ?? null,
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    decks: sortedDecks.map((item) => ({
      deckData: item,
      pos: decksAtlas1x?.positionsById[item.id] ?? { x: 0, y: 0 },
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    enhancements: sortedEnhancements.map((item) => ({
      enhancementData: item,
      pos: enhancementsAtlas1x?.positionsById[item.id] ?? { x: 0, y: 0 },
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    seals: sortedSeals.map((item) => ({
      sealData: item,
      pos: sealsAtlas1x?.positionsById[item.id] ?? { x: 0, y: 0 },
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    editions: sortedEditions.map((item) => ({
      editionData: item,
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    includeLocTxt: !useLocalizationFile,
    useLocalizationFile,
    localizationLocale: locale,
    atlas1xPng: jokerAtlas1x ? dataURLToUint8Array(jokerAtlas1x.atlasDataUrl) : null,
    atlas2xPng: jokerAtlas2x ? dataURLToUint8Array(jokerAtlas2x.atlasDataUrl) : null,
    consumablesAtlas1xPng: consumablesAtlas1x ? dataURLToUint8Array(consumablesAtlas1x.atlasDataUrl) : null,
    consumablesAtlas2xPng: consumablesAtlas2x ? dataURLToUint8Array(consumablesAtlas2x.atlasDataUrl) : null,
    vouchersAtlas1xPng: vouchersAtlas1x ? dataURLToUint8Array(vouchersAtlas1x.atlasDataUrl) : null,
    vouchersAtlas2xPng: vouchersAtlas2x ? dataURLToUint8Array(vouchersAtlas2x.atlasDataUrl) : null,
    decksAtlas1xPng: decksAtlas1x ? dataURLToUint8Array(decksAtlas1x.atlasDataUrl) : null,
    decksAtlas2xPng: decksAtlas2x ? dataURLToUint8Array(decksAtlas2x.atlasDataUrl) : null,
    enhancementsAtlas1xPng: enhancementsAtlas1x ? dataURLToUint8Array(enhancementsAtlas1x.atlasDataUrl) : null,
    enhancementsAtlas2xPng: enhancementsAtlas2x ? dataURLToUint8Array(enhancementsAtlas2x.atlasDataUrl) : null,
    sealsAtlas1xPng: sealsAtlas1x ? dataURLToUint8Array(sealsAtlas1x.atlasDataUrl) : null,
    sealsAtlas2xPng: sealsAtlas2x ? dataURLToUint8Array(sealsAtlas2x.atlasDataUrl) : null,
  });

  return { exportRootPath, modFolderPath, fileCount };
};
