import { invoke } from "@tauri-apps/api/core";
import { downloadDir, join } from "@tauri-apps/api/path";
import { exists, remove } from "@tauri-apps/plugin-fs";
import type {
  BaseGameObject,
  BoosterData,
  ConsumableData,
  ConsumableSetData,
  DeckData,
  EditionData,
  EnhancementData,
  JokerData,
  ModMetadata,
  RarityData,
  SealData,
  SoundData,
  UserVariable,
  VoucherData,
} from "@/lib/core/types";
import {
  ensureLocalizableWithLanguage,
  sanitizeLocalizationEntries,
} from "@/lib/core/localization";
import { buildDescriptionVariableTokens } from "@/lib/rules/description-variable-registry";
import { collectGlobalVariables } from "@/lib/app/global-user-variables";
import { rebaseCustomLuaAtlas, type AtlasItemType } from "./custom-lua-atlas";
import { buildSpriteAtlas, type SpriteAtlas } from "./image-atlas";

// The editor, card preview and exported loc_vars must use the same slot order.
const withDescriptionVariables = (item: unknown, globalVariables: UserVariable[] = []) => {
  const context = (
    item && typeof item === "object" ? item : {}
  ) as Parameters<typeof buildDescriptionVariableTokens>[0];
  return {
    ...context,
    descriptionVariables: buildDescriptionVariableTokens(context, globalVariables).map(
      (token) => token.binding,
    ),
  };
};

// ---------------------------------------------------------------------------
// Public option / result types
// ---------------------------------------------------------------------------

interface CompileSingleJokerOptions {
  includeLocTxt?: boolean;
  globalUserVariables?: UserVariable[];
}

export interface PreviewCodeSegment {
  id: string;
  segmentType: string;
  name: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CompiledLuaWithSegments {
  code: string;
  segments: PreviewCodeSegment[];
  fieldBindings?: PreviewFieldBinding[];
}

export interface PreviewFieldBinding {
  sourcePath: Array<string | number>;
  valueType: "string" | "number" | "boolean";
  originalValue: string | number | boolean;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type PreviewCompileItemType =
  | "joker"
  | "consumable"
  | "voucher"
  | "deck"
  | "enhancement"
  | "seal"
  | "edition"
  | "booster";

interface ExportModRustOptions {
  useLocalizationFile?: boolean;
  localizationLocale?: string;
  destinationMode?: "downloads" | "balatro-mods";
  balatroModsPath?: string;
  overwriteExistingModFolder?: boolean;
  removeOtherManagedModsFromBalatroFolder?: boolean;
  managedModFolderNames?: string[];
}

export interface ExportModRustResult {
  exportRootPath: string;
  modFolderPath: string;
  fileCount: number;
}

// ---------------------------------------------------------------------------
// Atlas building (browser Canvas , stays in TypeScript)
// ---------------------------------------------------------------------------

const customLuaForAtlas = (item: BaseGameObject, itemType: AtlasItemType, atlas: SpriteAtlas | null) =>
  rebaseCustomLuaAtlas(item.customCode, {
    itemType,
    objectKey: item.objectKey,
    pos: atlas?.positionsById[item.id] ?? { x: 0, y: 0 },
    soulPos: atlas?.soulPositionsById[item.id] ?? null,
  });

const buildFixedSizeImage = async (
  src: string,
  width: number,
  height: number,
  scale: number,
): Promise<string | null> => {
  const image = await loadImage(src);
  if (!image) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to build image asset: missing canvas context.");
  }

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

const buildModIcon = (src: string, scale: number) =>
  buildFixedSizeImage(src, 34, 34, scale);

const buildGameLogo = (src: string, scale: number) =>
  buildFixedSizeImage(src, 333, 216, scale);

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

const resolveModFolderPath = async (
  exportRootPath: string,
  modId: string,
  options: ExportModRustOptions,
): Promise<string> => {
  const basePath = await join(exportRootPath, modId);
  if (!(await exists(basePath))) return basePath;
  if (options.overwriteExistingModFolder) {
    await remove(basePath, { recursive: true });
    return basePath;
  }
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
    itemData: withDescriptionVariables(item, options.globalUserVariables),
    pos: null,
    soulPos: null,
    modPrefix,
    includeLocTxt: options.includeLocTxt ?? true,
    globalUserVariables: options.globalUserVariables ?? null,
  });
};

export const compileSingleItemLuaWithSegments = async (
  item: unknown,
  itemType: PreviewCompileItemType,
  modPrefix: string,
  options: CompileSingleJokerOptions = {},
): Promise<CompiledLuaWithSegments> => {
  return invoke<CompiledLuaWithSegments>("compile_item_from_data_with_segments", {
    itemType,
    itemData: withDescriptionVariables(item, options.globalUserVariables),
    pos: null,
    soulPos: null,
    modPrefix,
    includeLocTxt: options.includeLocTxt ?? true,
    globalUserVariables: options.globalUserVariables ?? null,
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
  options: CompileSingleJokerOptions = {},
): Promise<void> => {
  const code = joker.customCode?.fullCode
    ? joker.customCode.fullCode
    : await compileSingleJokerLua(joker, modPrefix, options);
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
  options: CompileSingleJokerOptions = {},
): Promise<void> => {
  const code = item.customCode?.fullCode
    ? item.customCode.fullCode
    : await compileSingleItemLua(item, itemType, modPrefix, options);
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
 * seals, editions, and boosters.
 */
export const exportModRust = async (
  metadata: ModMetadata,
  rarities: RarityData[],
  consumableSets: ConsumableSetData[],
  sounds: SoundData[],
  jokers: JokerData[],
  consumables: ConsumableData[],
  vouchers: VoucherData[],
  decks: DeckData[],
  enhancements: EnhancementData[],
  seals: SealData[],
  editions: EditionData[],
  boosters: BoosterData[],
  options: ExportModRustOptions = {},
): Promise<ExportModRustResult> => {
  const exportRootPath = await resolveExportRootPath(options);
  const modFolderPath = await resolveModFolderPath(
    exportRootPath,
    metadata.id,
    options,
  );
  const useLocalizationFile = options.useLocalizationFile ?? false;
  const locale = options.localizationLocale ?? "en-us";
  const globalVariables = collectGlobalVariables({
    jokers, consumables, vouchers, decks, enhancements, seals, editions,
  }).map((entry) => entry.variable);

  const sortedJokers = [...jokers].sort((a, b) => a.orderValue - b.orderValue);
  const sortedConsumables = [...consumables].sort((a, b) => a.orderValue - b.orderValue);
  const sortedVouchers = [...vouchers].sort((a, b) => a.orderValue - b.orderValue);
  const sortedDecks = [...decks].sort((a, b) => a.orderValue - b.orderValue);
  const sortedEnhancements = [...enhancements].sort((a, b) => a.orderValue - b.orderValue);
  const sortedSeals = [...seals].sort((a, b) => a.orderValue - b.orderValue);
  const sortedEditions = [...editions].sort((a, b) => a.orderValue - b.orderValue);
  const sortedBoosters = [...boosters].sort((a, b) => a.orderValue - b.orderValue);

  const jokerAtlas = sortedJokers.length > 0 ? await buildSpriteAtlas(sortedJokers, "CustomJokers") : null;
  const consumablesAtlas = sortedConsumables.length > 0 ? await buildSpriteAtlas(sortedConsumables, "CustomConsumables") : null;
  const vouchersAtlas = sortedVouchers.length > 0 ? await buildSpriteAtlas(sortedVouchers, "CustomVouchers") : null;
  const decksAtlas = sortedDecks.length > 0 ? await buildSpriteAtlas(sortedDecks, "CustomDecks") : null;
  const enhancementsAtlas = sortedEnhancements.length > 0 ? await buildSpriteAtlas(sortedEnhancements, "CustomEnhancements") : null;
  const sealsAtlas = sortedSeals.length > 0 ? await buildSpriteAtlas(sortedSeals, "CustomSeals") : null;
  const boostersAtlas = sortedBoosters.length > 0 ? await buildSpriteAtlas(sortedBoosters, "CustomBoosters") : null;

  const modIconSource =
    metadata.iconImage && (metadata.hasUserUploadedIcon || metadata.iconImage.trim())
      ? metadata.iconImage
      : "";
  const gameLogoSource =
    metadata.gameImage && (metadata.hasUserUploadedGameIcon || metadata.gameImage.trim())
      ? metadata.gameImage
      : "";
  const modIcon1x = modIconSource ? await buildModIcon(modIconSource, 1) : null;
  const modIcon2x = modIconSource ? await buildModIcon(modIconSource, 2) : null;
  const gameLogo1x = gameLogoSource ? await buildGameLogo(gameLogoSource, 1) : null;
  const gameLogo2x = gameLogoSource ? await buildGameLogo(gameLogoSource, 2) : null;

  const fileCount = await invoke<number>("export_mod_package", {
    modFolderPath,
    metadata,
    rarities,
    consumableSets,
    sounds: sounds.map((sound) => ({
      key: sound.key,
      soundString: sound.soundString,
      audioBytes: sound.audioDataUrl ? dataURLToUint8Array(sound.audioDataUrl) : null,
      volume: sound.volume ?? 1,
      pitch: sound.pitch ?? 1,
      replace: sound.replace ?? null,
    })),
    jokers: sortedJokers.map((joker) => ({
      // Localization-first model: base fields come from the chosen default locale.
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(joker, locale);
        return {
          jokerData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      pos: jokerAtlas?.positionsById[joker.id] ?? { x: 0, y: 0 },
      soulPos: jokerAtlas?.soulPositionsById[joker.id] ?? null,
      fileName: `${joker.objectKey}.lua`,
      customLua: customLuaForAtlas(joker, "joker", jokerAtlas),
    })),
    consumables: sortedConsumables.map((item) => ({
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(item, locale);
        return {
          consumableData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      pos: consumablesAtlas?.positionsById[item.id] ?? { x: 0, y: 0 },
      soulPos: consumablesAtlas?.soulPositionsById[item.id] ?? null,
      fileName: `${item.objectKey}.lua`,
      customLua: customLuaForAtlas(item, "consumable", consumablesAtlas),
    })),
    vouchers: sortedVouchers.map((item) => ({
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(item, locale);
        return {
          voucherData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      pos: vouchersAtlas?.positionsById[item.id] ?? { x: 0, y: 0 },
      soulPos: vouchersAtlas?.soulPositionsById[item.id] ?? null,
      fileName: `${item.objectKey}.lua`,
      customLua: customLuaForAtlas(item, "voucher", vouchersAtlas),
    })),
    decks: sortedDecks.map((item) => ({
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(item, locale);
        return {
          deckData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      pos: decksAtlas?.positionsById[item.id] ?? { x: 0, y: 0 },
      fileName: `${item.objectKey}.lua`,
      customLua: customLuaForAtlas(item, "deck", decksAtlas),
    })),
    enhancements: sortedEnhancements.map((item) => ({
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(item, locale);
        return {
          enhancementData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      pos: enhancementsAtlas?.positionsById[item.id] ?? { x: 0, y: 0 },
      fileName: `${item.objectKey}.lua`,
      customLua: customLuaForAtlas(item, "enhancement", enhancementsAtlas),
    })),
    seals: sortedSeals.map((item) => ({
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(item, locale);
        return {
          sealData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      pos: sealsAtlas?.positionsById[item.id] ?? { x: 0, y: 0 },
      fileName: `${item.objectKey}.lua`,
      customLua: customLuaForAtlas(item, "seal", sealsAtlas),
    })),
    editions: sortedEditions.map((item) => ({
      ...(() => {
        const normalized = ensureLocalizableWithLanguage(item, locale);
        return {
          editionData: {
            ...withDescriptionVariables(normalized, globalVariables),
            localizations: sanitizeLocalizationEntries(normalized.localizations),
          },
        };
      })(),
      fileName: `${item.objectKey}.lua`,
      customLua: item.customCode?.fullCode ?? null,
    })),
    boosters: sortedBoosters.map((item) => {
      const normalized = ensureLocalizableWithLanguage(item, locale);
      return {
        boosterData: {
          ...normalized,
          localizations: sanitizeLocalizationEntries(normalized.localizations),
        },
        pos: boostersAtlas?.positionsById[item.id] ?? { x: 0, y: 0 },
        fileName: `${item.objectKey}.lua`,
        customLua: customLuaForAtlas(item, "booster", boostersAtlas),
      };
    }),
    atlasAnimations: [jokerAtlas, consumablesAtlas, vouchersAtlas, decksAtlas, enhancementsAtlas, sealsAtlas, boostersAtlas].flatMap((atlas) => atlas?.animations ?? []),
    includeLocTxt: !useLocalizationFile,
    useLocalizationFile,
    localizationLocale: locale,
    modIcon1xPng: modIcon1x ? dataURLToUint8Array(modIcon1x) : null,
    modIcon2xPng: modIcon2x ? dataURLToUint8Array(modIcon2x) : null,
    gameLogo1xPng: gameLogo1x ? dataURLToUint8Array(gameLogo1x) : null,
    gameLogo2xPng: gameLogo2x ? dataURLToUint8Array(gameLogo2x) : null,
    atlas1xPng: jokerAtlas ? dataURLToUint8Array(jokerAtlas.atlas1xDataUrl) : null,
    atlas2xPng: jokerAtlas ? dataURLToUint8Array(jokerAtlas.atlas2xDataUrl) : null,
    consumablesAtlas1xPng: consumablesAtlas ? dataURLToUint8Array(consumablesAtlas.atlas1xDataUrl) : null,
    consumablesAtlas2xPng: consumablesAtlas ? dataURLToUint8Array(consumablesAtlas.atlas2xDataUrl) : null,
    vouchersAtlas1xPng: vouchersAtlas ? dataURLToUint8Array(vouchersAtlas.atlas1xDataUrl) : null,
    vouchersAtlas2xPng: vouchersAtlas ? dataURLToUint8Array(vouchersAtlas.atlas2xDataUrl) : null,
    decksAtlas1xPng: decksAtlas ? dataURLToUint8Array(decksAtlas.atlas1xDataUrl) : null,
    decksAtlas2xPng: decksAtlas ? dataURLToUint8Array(decksAtlas.atlas2xDataUrl) : null,
    enhancementsAtlas1xPng: enhancementsAtlas ? dataURLToUint8Array(enhancementsAtlas.atlas1xDataUrl) : null,
    enhancementsAtlas2xPng: enhancementsAtlas ? dataURLToUint8Array(enhancementsAtlas.atlas2xDataUrl) : null,
    sealsAtlas1xPng: sealsAtlas ? dataURLToUint8Array(sealsAtlas.atlas1xDataUrl) : null,
    sealsAtlas2xPng: sealsAtlas ? dataURLToUint8Array(sealsAtlas.atlas2xDataUrl) : null,
    boostersAtlas1xPng: boostersAtlas ? dataURLToUint8Array(boostersAtlas.atlas1xDataUrl) : null,
    boostersAtlas2xPng: boostersAtlas ? dataURLToUint8Array(boostersAtlas.atlas2xDataUrl) : null,
    removeOtherManagedMods: options.removeOtherManagedModsFromBalatroFolder ?? false,
    managedModFolderNames: options.managedModFolderNames ?? null,
  });

  return { exportRootPath, modFolderPath, fileCount };
};
