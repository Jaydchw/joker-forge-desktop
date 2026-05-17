import { useEffect, useState } from "react";
import type {
  BoosterData,
  ConsumableData,
  DeckData,
  EditionData,
  EnhancementData,
  JokerData,
  Mod,
  ModMetadata,
  SealData,
  VoucherData,
} from "@/lib/core/types";
import { slugify } from "@/lib/balatro/balatro-utils";

type VanillaReforgedRaw = Partial<Mod> & {
  metadata?: Partial<ModMetadata> & Record<string, unknown>;
  jokers?: any[];
  consumables?: any[];
  boosters?: any[];
  enhancements?: any[];
  seals?: any[];
  editions?: any[];
  vouchers?: any[];
  decks?: any[];
};

const buildObjectKey = (
  item: Record<string, unknown>,
  keyField: string,
  fallback: string,
) => {
  const fromKey = item[keyField];
  const raw =
    (typeof item.objectKey === "string" && item.objectKey.trim()) ||
    (typeof fromKey === "string" && fromKey.trim());

  if (raw) return raw;

  const name = typeof item.name === "string" ? item.name : "";
  const slug = name.trim() ? slugify(name) : "";
  return slug || `${fallback}_${Math.random().toString(36).slice(2, 8)}`;
};

const getOrderValue = (item: Record<string, unknown>, index: number) =>
  typeof item.orderValue === "number" ? item.orderValue : index + 1;

const normalizeMetadata = (metadata?: VanillaReforgedRaw["metadata"]) => {
  const author = Array.isArray(metadata?.author)
    ? metadata?.author.map(String)
    : metadata?.author
      ? [String(metadata.author)]
      : [];

  return {
    id: String(metadata?.id ?? "vanilla_reforged"),
    name: String(metadata?.name ?? "Vanilla Reforged"),
    display_name: String(metadata?.display_name ?? metadata?.name ?? "Vanilla"),
    description: String(metadata?.description ?? ""),
    author,
    version: String(metadata?.version ?? "1.0.0"),
    prefix: String(metadata?.prefix ?? "vanillar"),
    priority: Number(metadata?.priority ?? 0),
    main_file: String(metadata?.main_file ?? "main.lua"),
    disable_vanilla: metadata?.disable_vanilla === true,
    badge_colour: String(metadata?.badge_colour ?? "666665"),
    badge_text_colour: String(metadata?.badge_text_colour ?? "ffffff"),
    iconImage: String(metadata?.iconImage ?? ""),
    gameImage: String(metadata?.gameImage ?? ""),
    hasUserUploadedIcon: metadata?.hasUserUploadedIcon === true,
    hasUserUploadedGameIcon: metadata?.hasUserUploadedGameIcon === true,
    dependencies: Array.isArray(metadata?.dependencies)
      ? metadata?.dependencies.map(String)
      : [],
    conflicts: Array.isArray(metadata?.conflicts)
      ? metadata?.conflicts.map(String)
      : [],
    provides: Array.isArray(metadata?.provides)
      ? metadata?.provides.map(String)
      : [],
  } satisfies ModMetadata;
};

const normalizeJokers = (raw: any[] = []): JokerData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "jokerKey", "joker");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "joker",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      rarity: item.rarity ?? 1,
      cost: item.cost ?? 0,
      blueprint_compat: item.blueprint_compat ?? true,
      eternal_compat: item.eternal_compat ?? true,
      perishable_compat: item.perishable_compat ?? false,
      appears_in_shop: item.appears_in_shop ?? true,
      cardAppearance: item.cardAppearance ?? {},
      appearFlags: item.appearFlags ?? "",
      pools: Array.isArray(item.pools) ? item.pools : [],
      scale_w: item.scale_w,
      scale_h: item.scale_h,
      force_eternal: item.force_eternal,
      force_perishable: item.force_perishable,
      force_rental: item.force_rental,
      force_foil: item.force_foil,
      force_holographic: item.force_holographic,
      force_polychrome: item.force_polychrome,
      force_negative: item.force_negative,
      ignoreSlotLimit: item.ignoreSlotLimit,
      unlockTrigger: item.unlockTrigger,
      unlockOperator: item.unlockOperator,
      unlockCount: item.unlockCount,
      unlockProperties: item.unlockProperties,
      unlockDescription: item.unlockDescription,
      locVars: item.locVars,
    } satisfies JokerData;
  });

const normalizeConsumables = (raw: any[] = []): ConsumableData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "consumableKey", "consumable");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "consumable",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      set: item.set ?? "Tarot",
      cost: item.cost ?? 0,
      hidden: item.hidden ?? false,
      can_repeat_soul: item.can_repeat_soul ?? false,
    } satisfies ConsumableData;
  });

const normalizeBoosters = (raw: any[] = []): BoosterData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "boosterKey", "booster");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "booster",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      booster_type: item.booster_type ?? "joker",
      cost: item.cost ?? 0,
      weight: item.weight ?? 1,
      draw_hand: item.draw_hand ?? true,
      instant_use: item.instant_use ?? false,
      config: item.config ?? { extra: 0, choose: 0 },
      card_rules: Array.isArray(item.card_rules) ? item.card_rules : [],
      group_key: item.group_key,
      kind: item.kind,
      background_colour: item.background_colour,
      special_colour: item.special_colour,
      hidden: item.hidden,
      atlas: item.atlas,
      pos: item.pos,
    } satisfies BoosterData;
  });

const normalizeEnhancements = (raw: any[] = []): EnhancementData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "enhancementKey", "enhancement");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "enhancement",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      weight: item.weight ?? 1,
      no_collection: item.no_collection ?? false,
      any_suit: item.any_suit ?? false,
      replace_base_card: item.replace_base_card ?? false,
      no_rank: item.no_rank ?? false,
      no_suit: item.no_suit ?? false,
      always_scores: item.always_scores ?? false,
      atlas: item.atlas,
      pos: item.pos,
    } satisfies EnhancementData;
  });

const normalizeSeals = (raw: any[] = []): SealData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "sealKey", "seal");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "seal",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      badge_colour: String(item.badge_colour ?? "#ffffff"),
      no_collection: item.no_collection ?? false,
      sound: item.sound,
      pitch: item.pitch,
      volume: item.volume,
      atlas: item.atlas,
      pos: item.pos,
    } satisfies SealData;
  });

const normalizeEditions = (raw: any[] = []): EditionData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "objectKey", "edition");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "edition",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      weight: item.weight ?? 1,
      shader: item.shader ?? false,
      extra_cost: item.extra_cost,
      badge_colour: item.badge_colour,
      sound: item.sound,
      pitch: item.pitch,
      volume: item.volume,
      disable_shadow: item.disable_shadow ?? false,
      disable_base_shader: item.disable_base_shader ?? false,
      in_shop: item.in_shop ?? true,
      no_collection: item.no_collection ?? false,
      apply_to_float: item.apply_to_float ?? false,
    } satisfies EditionData;
  });

const normalizeVouchers = (raw: any[] = []): VoucherData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "voucherKey", "voucher");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "voucher",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      cost: item.cost ?? 0,
      no_collection: item.no_collection ?? false,
      requires: item.requires ?? "",
      requires_activetor: item.requires_activetor ?? false,
      can_repeat_soul: item.can_repeat_soul ?? false,
      draw_shader_sprite: item.draw_shader_sprite ?? false,
      unlockTrigger: item.unlockTrigger,
      unlockOperator: item.unlockOperator,
      unlockCount: item.unlockCount,
      unlockProperties: item.unlockProperties,
      unlockDescription: item.unlockDescription,
    } satisfies VoucherData;
  });

const normalizeDecks = (raw: any[] = []): DeckData[] =>
  raw.map((item, index) => {
    const objectKey = buildObjectKey(item, "objectKey", "deck");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      objectType: "deck",
      objectKey,
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      image: String(item.imagePreview ?? item.image ?? ""),
      overlayImage: item.overlayImagePreview ?? item.overlayImage,
      hasUserUploadedImage: item.hasUserUploadedImage ?? false,
      placeholderCreditIndex: item.placeholderCreditIndex,
      placeholderCategory: item.placeholderCategory,
      orderValue: getOrderValue(item, index),
      unlocked: item.unlocked ?? true,
      discovered: item.discovered ?? true,
      rules: Array.isArray(item.rules) ? item.rules : [],
      userVariables: Array.isArray(item.userVariables)
        ? item.userVariables
        : [],
      Config_consumables: item.Config_consumables,
      Config_vouchers: item.Config_vouchers,
      no_collection: item.no_collection ?? false,
      no_interest: item.no_interest ?? false,
      no_faces: item.no_faces ?? false,
      erratic_deck: item.erratic_deck ?? false,
    } satisfies DeckData;
  });

export const normalizeVanillaReforged = (raw: VanillaReforgedRaw): Mod => {
  return {
    metadata: normalizeMetadata(raw.metadata),
    jokers: normalizeJokers(raw.jokers),
    consumables: normalizeConsumables(raw.consumables),
    boosters: normalizeBoosters(raw.boosters),
    enhancements: normalizeEnhancements(raw.enhancements),
    seals: normalizeSeals(raw.seals),
    editions: normalizeEditions(raw.editions),
    vouchers: normalizeVouchers(raw.vouchers),
    decks: normalizeDecks(raw.decks),
    sounds: [],
    rarities: [],
    consumableSets: [],
  } satisfies Mod;
};

export const useVanillaReforgedData = () => {
  const [data, setData] = useState<Mod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/vanillareforged.json", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to load vanilla data: ${response.status}`);
        }
        const raw = (await response.json()) as VanillaReforgedRaw;
        const normalized = normalizeVanillaReforged(raw);
        if (isMounted) {
          setData(normalized);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, isLoading, error };
};
