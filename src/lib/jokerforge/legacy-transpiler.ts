import type { ProjectData, ProjectStats } from "@/lib/storage";
import type { ModMetadata } from "@/lib/types";
import { sanitizeDescription } from "@/lib/description-sanitizer";

const DEFAULT_METADATA: ModMetadata = {
  id: "my_custom_mod",
  name: "My Custom Mod",
  display_name: "My Custom Mod",
  description: "A Balatro mod created with Joker Forge.",
  author: ["Anonymous"],
  version: "1.0.0",
  prefix: "jkr",
  priority: 0,
  main_file: "main.lua",
  disable_vanilla: false,
  badge_colour: "4584fa",
  badge_text_colour: "ffffff",
  iconImage: "",
  gameImage: "",
  hasUserUploadedIcon: false,
  hasUserUploadedGameIcon: false,
  dependencies: [],
  conflicts: [],
  provides: [],
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asStringArray = (value: unknown, fallback: string[] = []): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return [value];
  return fallback;
};

const asArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

const asNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
};

const inferValueType = (value: unknown): string => {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  const valueType = typeof value;
  if (valueType === "number") return "number";
  if (valueType === "boolean") return "boolean";
  if (valueType === "string") return "string";
  if (valueType === "object") return "object";
  return "unknown";
};

const normalizeParameterValue = (
  value: unknown,
): { value: unknown; valueType?: string } => {
  const obj = asObject(value);
  if (obj && Object.prototype.hasOwnProperty.call(obj, "value")) {
    return {
      value: obj.value,
      valueType:
        typeof obj.valueType === "string"
          ? obj.valueType
          : inferValueType(obj.value),
    };
  }

  return {
    value,
    valueType: inferValueType(value),
  };
};

const normalizeParams = (value: unknown): Record<string, unknown> => {
  const obj = asObject(value) ?? {};
  const normalized: Record<string, unknown> = {};

  Object.entries(obj).forEach(([key, paramValue]) => {
    normalized[key] = normalizeParameterValue(paramValue);
  });

  return normalized;
};

const normalizeRuleConditions = (value: unknown): unknown[] => {
  return asArray(value).map((condition) => {
    const obj = asObject(condition) ?? {};
    return {
      ...obj,
      type: typeof obj.type === "string" ? obj.type : "",
      negate: asBoolean(obj.negate, false),
      params: normalizeParams(obj.params),
    };
  });
};

const normalizeRuleEffects = (value: unknown): unknown[] => {
  return asArray(value).map((effect) => {
    const obj = asObject(effect) ?? {};
    return {
      ...obj,
      type: typeof obj.type === "string" ? obj.type : "",
      params: normalizeParams(obj.params),
      customMessage:
        typeof obj.customMessage === "string" ? obj.customMessage : undefined,
    };
  });
};

const normalizeRuleRandomGroups = (value: unknown): unknown[] => {
  return asArray(value).map((group) => {
    const obj = asObject(group) ?? {};
    return {
      ...obj,
      chance_numerator: normalizeParameterValue(obj.chance_numerator),
      chance_denominator: normalizeParameterValue(obj.chance_denominator),
      respect_probability_effects: asBoolean(
        obj.respect_probability_effects,
        true,
      ),
      effects: normalizeRuleEffects(obj.effects),
    };
  });
};

const normalizeRuleLoops = (value: unknown): unknown[] => {
  return asArray(value).map((loop) => {
    const obj = asObject(loop) ?? {};
    return {
      ...obj,
      repetitions: normalizeParameterValue(obj.repetitions),
      effects: normalizeRuleEffects(obj.effects),
    };
  });
};

const normalizeRules = (value: unknown): unknown[] => {
  return asArray(value).map((rule, index) => {
    const obj = asObject(rule) ?? {};
    const position = asObject(obj.position);

    return {
      ...obj,
      id: (typeof obj.id === "string" && obj.id.trim()) || `rule-${index + 1}`,
      trigger: typeof obj.trigger === "string" ? obj.trigger : "",
      blueprintCompatible: asBoolean(obj.blueprintCompatible, false),
      conditionGroups: asArray(obj.conditionGroups).map((group) => {
        const groupObj = asObject(group) ?? {};
        const operator = groupObj.operator === "or" ? "or" : "and";
        return {
          ...groupObj,
          operator,
          conditions: normalizeRuleConditions(groupObj.conditions),
        };
      }),
      effects: normalizeRuleEffects(obj.effects),
      randomGroups: normalizeRuleRandomGroups(obj.randomGroups),
      loops: normalizeRuleLoops(obj.loops),
      position: {
        x: asNumber(position?.x, 0),
        y: asNumber(position?.y, 0),
      },
    };
  });
};

const normalizeMetadata = (input: unknown): ModMetadata => {
  const obj = asObject(input);
  if (!obj) return DEFAULT_METADATA;

  const id =
    (typeof obj.id === "string" && obj.id.trim()) || DEFAULT_METADATA.id;
  const name =
    (typeof obj.name === "string" && obj.name.trim()) || DEFAULT_METADATA.name;

  return {
    ...DEFAULT_METADATA,
    ...obj,
    id,
    name,
    display_name:
      (typeof obj.display_name === "string" && obj.display_name.trim()) || name,
    description:
      typeof obj.description === "string"
        ? obj.description
        : DEFAULT_METADATA.description,
    author: asStringArray(obj.author, DEFAULT_METADATA.author),
    version:
      (typeof obj.version === "string" && obj.version.trim()) ||
      DEFAULT_METADATA.version,
    prefix:
      (typeof obj.prefix === "string" && obj.prefix.trim()) ||
      id.toLowerCase().slice(0, 8),
    priority:
      typeof obj.priority === "number"
        ? obj.priority
        : Number.parseInt(String(obj.priority ?? "0"), 10) || 0,
    main_file:
      (typeof obj.main_file === "string" && obj.main_file.trim()) ||
      DEFAULT_METADATA.main_file,
    badge_colour:
      (typeof obj.badge_colour === "string" && obj.badge_colour.trim()) ||
      DEFAULT_METADATA.badge_colour,
    badge_text_colour:
      (typeof obj.badge_text_colour === "string" &&
        obj.badge_text_colour.trim()) ||
      DEFAULT_METADATA.badge_text_colour,
    iconImage: typeof obj.iconImage === "string" ? obj.iconImage : "",
    gameImage: typeof obj.gameImage === "string" ? obj.gameImage : "",
    hasUserUploadedIcon: Boolean(obj.hasUserUploadedIcon),
    hasUserUploadedGameIcon: Boolean(obj.hasUserUploadedGameIcon),
    dependencies: asStringArray(obj.dependencies),
    conflicts: asStringArray(obj.conflicts),
    provides: asStringArray(obj.provides),
  };
};

const normalizeCollectionItem = (
  item: unknown,
  objectType: string,
  index: number,
): Record<string, unknown> => {
  const obj = asObject(item) ?? {};

  const image =
    typeof obj.image === "string"
      ? obj.image
      : typeof obj.imagePreview === "string"
        ? obj.imagePreview
        : "";

  const overlayImage =
    typeof obj.overlayImage === "string"
      ? obj.overlayImage
      : typeof obj.overlayImagePreview === "string"
        ? obj.overlayImagePreview
        : "";

  const base = {
    ...obj,
    objectType,
    id:
      (typeof obj.id === "string" && obj.id.trim()) ||
      `${objectType}-${index + 1}`,
    objectKey:
      (typeof obj.objectKey === "string" && obj.objectKey.trim()) ||
      `${objectType}_${index + 1}`,
    name:
      (typeof obj.name === "string" && obj.name.trim()) ||
      `${objectType} ${index + 1}`,
    description:
      typeof obj.description === "string"
        ? sanitizeDescription(obj.description)
        : "",
    image,
    imagePreview:
      typeof obj.imagePreview === "string" ? obj.imagePreview : image,
    overlayImage,
    overlayImagePreview:
      typeof obj.overlayImagePreview === "string"
        ? obj.overlayImagePreview
        : overlayImage,
    hasUserUploadedImage: asBoolean(obj.hasUserUploadedImage, false),
    placeholderCreditIndex: asNumber(obj.placeholderCreditIndex, 0),
    orderValue: asNumber(obj.orderValue, index + 1),
    unlocked: asBoolean(obj.unlocked, true),
    discovered: asBoolean(obj.discovered, true),
    no_collection: asBoolean(obj.no_collection, false),
    rules: normalizeRules(obj.rules),
    userVariables: asArray(obj.userVariables),
  };

  if (objectType === "joker") {
    return {
      ...base,
      rarity: obj.rarity ?? 1,
      cost: asNumber(obj.cost, 4),
      blueprint_compat: asBoolean(obj.blueprint_compat, false),
      eternal_compat: asBoolean(obj.eternal_compat, true),
      perishable_compat: asBoolean(obj.perishable_compat, true),
      appears_in_shop: asBoolean(obj.appears_in_shop, true),
      pools: asStringArray(obj.pools),
      scale_h: asNumber(obj.scale_h, 100),
      scale_w: asNumber(obj.scale_w, 100),
      unlockTrigger:
        typeof obj.unlockTrigger === "string" ? obj.unlockTrigger : "",
      unlockProperties: asArray(obj.unlockProperties),
      unlockOperator:
        typeof obj.unlockOperator === "string" ? obj.unlockOperator : "",
      unlockCount: asNumber(obj.unlockCount, 1),
      unlockDescription:
        typeof obj.unlockDescription === "string"
          ? obj.unlockDescription
          : "Unlocked by default.",
      cardAppearance: asObject(obj.cardAppearance) ?? {
        jud: true,
        sou: true,
        wra: true,
        buf: true,
        rif: true,
        rta: true,
        uta: true,
      },
      info_queues: asStringArray(obj.info_queues),
      card_dependencies: asStringArray(obj.card_dependencies),
      ignoreSlotLimit: asBoolean(obj.ignoreSlotLimit, false),
    };
  }

  if (objectType === "booster") {
    const config = asObject(obj.config);
    const pos = asObject(obj.pos);
    return {
      ...base,
      booster_type:
        typeof obj.booster_type === "string" ? obj.booster_type : "joker",
      cost: asNumber(obj.cost, 4),
      weight: asNumber(obj.weight, 1),
      draw_hand: asBoolean(obj.draw_hand, true),
      instant_use: asBoolean(obj.instant_use, false),
      config: {
        extra: asNumber(config?.extra, 0),
        choose: asNumber(config?.choose, 1),
      },
      card_rules: asArray(obj.card_rules),
      group_key: typeof obj.group_key === "string" ? obj.group_key : undefined,
      kind: typeof obj.kind === "string" ? obj.kind : undefined,
      background_colour:
        typeof obj.background_colour === "string"
          ? obj.background_colour
          : undefined,
      special_colour:
        typeof obj.special_colour === "string" ? obj.special_colour : undefined,
      pos: pos
        ? { x: asNumber(pos.x, 0), y: asNumber(pos.y, 0) }
        : undefined,
    };
  }

  if (objectType === "consumable") {
    return {
      ...base,
      set: typeof obj.set === "string" ? obj.set : "Tarot",
      cost: asNumber(obj.cost, 3),
      can_repeat_soul: asBoolean(obj.can_repeat_soul, false),
    };
  }

  if (objectType === "voucher") {
    return {
      ...base,
      cost: asNumber(obj.cost, 10),
      requires: typeof obj.requires === "string" ? obj.requires : "",
      requires_activetor: asBoolean(obj.requires_activetor, false),
      can_repeat_soul: asBoolean(obj.can_repeat_soul, false),
      draw_shader_sprite:
        typeof obj.draw_shader_sprite === "string"
          ? obj.draw_shader_sprite
          : asBoolean(obj.draw_shader_sprite, false)
            ? obj.draw_shader_sprite
            : false,
      unlockTrigger:
        typeof obj.unlockTrigger === "string" ? obj.unlockTrigger : "",
      unlockProperties: asArray(obj.unlockProperties),
      unlockOperator:
        typeof obj.unlockOperator === "string" ? obj.unlockOperator : "",
      unlockCount: asNumber(obj.unlockCount, 1),
      unlockDescription:
        typeof obj.unlockDescription === "string"
          ? obj.unlockDescription
          : "Unlocked by default.",
    };
  }

  if (objectType === "deck") {
    return {
      ...base,
      Config_vouchers: asStringArray(obj.Config_vouchers),
      Config_consumables: asStringArray(obj.Config_consumables),
      no_interest: asBoolean(obj.no_interest, false),
      no_faces: asBoolean(obj.no_faces, false),
      erratic_deck: asBoolean(obj.erratic_deck, false),
    };
  }

  if (objectType === "enhancement") {
    const pos = asObject(obj.pos);
    return {
      ...base,
      weight: asNumber(obj.weight, 1),
      any_suit: asBoolean(obj.any_suit, false),
      replace_base_card: asBoolean(obj.replace_base_card, false),
      no_rank: asBoolean(obj.no_rank, false),
      no_suit: asBoolean(obj.no_suit, false),
      always_scores: asBoolean(obj.always_scores, false),
      pos: pos
        ? { x: asNumber(pos.x, 0), y: asNumber(pos.y, 0) }
        : undefined,
    };
  }

  if (objectType === "seal") {
    const pos = asObject(obj.pos);
    return {
      ...base,
      badge_colour:
        (typeof obj.badge_colour === "string" && obj.badge_colour) || "ffffff",
      sound: typeof obj.sound === "string" ? obj.sound : "",
      pitch: asNumber(obj.pitch, 1),
      volume: asNumber(obj.volume, 1),
      pos: pos
        ? { x: asNumber(pos.x, 0), y: asNumber(pos.y, 0) }
        : undefined,
    };
  }

  if (objectType === "edition") {
    return {
      ...base,
      weight: asNumber(obj.weight, 1),
      shader: typeof obj.shader === "string" ? obj.shader : false,
      extra_cost: asNumber(obj.extra_cost, 0),
      badge_colour:
        typeof obj.badge_colour === "string" ? obj.badge_colour : undefined,
      sound: typeof obj.sound === "string" ? obj.sound : undefined,
      pitch: typeof obj.pitch === "number" ? obj.pitch : undefined,
      volume: typeof obj.volume === "number" ? obj.volume : undefined,
      disable_shadow: asBoolean(obj.disable_shadow, false),
      disable_base_shader: asBoolean(obj.disable_base_shader, false),
      in_shop: asBoolean(obj.in_shop, true),
      apply_to_float: asBoolean(obj.apply_to_float, false),
    };
  }

  return base;
};

const buildStats = (project: Omit<ProjectData, "stats">): ProjectStats => ({
  jokers: project.jokers.length,
  consumables: project.consumables.length,
  decks: project.decks.length,
  enhancements: project.enhancements.length,
  seals: project.seals.length,
  editions: project.editions.length,
  sounds: project.sounds.length,
  vouchers: project.vouchers.length,
  boosters: project.boosters.length,
  rarities: project.rarities.length,
  consumableSets: project.consumableSets.length,
});

const normalizeCollection = (value: unknown, objectType: string): unknown[] => {
  return asArray(value).map((item, index) =>
    normalizeCollectionItem(item, objectType, index),
  );
};

const normalizeSounds = (value: unknown): unknown[] => {
  return asArray(value).map((sound, index) => {
    const obj = asObject(sound) ?? {};
    const key =
      (typeof obj.key === "string" && obj.key.trim()) || `sound_${index + 1}`;
    return {
      ...obj,
      id: (typeof obj.id === "string" && obj.id.trim()) || `sound-${index + 1}`,
      key,
      soundString:
        (typeof obj.soundString === "string" && obj.soundString.trim()) || key,
      volume: asNumber(obj.volume, 1),
      pitch: asNumber(obj.pitch, 1),
    };
  });
};

const normalizeRarities = (value: unknown): unknown[] => {
  return asArray(value).map((rarity, index) => {
    const obj = asObject(rarity) ?? {};
    const key =
      (typeof obj.key === "string" && obj.key.trim()) || `rarity_${index + 1}`;
    return {
      ...obj,
      id:
        (typeof obj.id === "string" && obj.id.trim()) || `rarity-${index + 1}`,
      key,
      name:
        (typeof obj.name === "string" && obj.name.trim()) ||
        `Rarity ${index + 1}`,
      badge_colour:
        (typeof obj.badge_colour === "string" && obj.badge_colour) || "4584fa",
      default_weight: asNumber(obj.default_weight, 1),
    };
  });
};

const normalizeConsumableSets = (value: unknown): unknown[] => {
  return asArray(value).map((set, index) => {
    const obj = asObject(set) ?? {};
    const key =
      (typeof obj.key === "string" && obj.key.trim()) || `set_${index + 1}`;
    return {
      ...obj,
      id: (typeof obj.id === "string" && obj.id.trim()) || `set-${index + 1}`,
      key,
      name:
        (typeof obj.name === "string" && obj.name.trim()) || `Set ${index + 1}`,
      primary_colour:
        (typeof obj.primary_colour === "string" && obj.primary_colour) ||
        "ffffff",
      secondary_colour:
        (typeof obj.secondary_colour === "string" && obj.secondary_colour) ||
        "000000",
      shop_rate: asNumber(obj.shop_rate, 1),
      collection_rows: Array.isArray(obj.collection_rows)
        ? obj.collection_rows
        : [1, 1],
      collection_name:
        (typeof obj.collection_name === "string" && obj.collection_name) || key,
    };
  });
};

const LEGACY_COLLECTION_KEYS = [
  "jokers",
  "sounds",
  "consumables",
  "customRarities",
  "rarities",
  "consumableSets",
  "boosters",
  "enhancements",
  "seals",
  "editions",
  "vouchers",
  "decks",
] as const;

const resolveLegacyRoot = (payload: unknown): Record<string, unknown> => {
  const obj = asObject(payload) ?? {};
  const embeddedProject = asObject(obj.project);

  if (embeddedProject && asObject(embeddedProject.metadata)) {
    return embeddedProject;
  }

  return obj;
};

const LEGACY_COLLECTION_TO_PROJECT_KEY = {
  jokers: "jokers",
  sounds: "sounds",
  consumables: "consumables",
  customRarities: "rarities",
  rarities: "rarities",
  consumableSets: "consumableSets",
  boosters: "boosters",
  enhancements: "enhancements",
  seals: "seals",
  editions: "editions",
  vouchers: "vouchers",
  decks: "decks",
} as const;

type ProjectCollectionKey =
  (typeof LEGACY_COLLECTION_TO_PROJECT_KEY)[keyof typeof LEGACY_COLLECTION_TO_PROJECT_KEY];

const getLegacyExpectedCounts = (
  legacyPayload: unknown,
): Partial<Record<ProjectCollectionKey, number>> => {
  const root = resolveLegacyRoot(legacyPayload);
  const raw = asObject(legacyPayload) ?? {};
  const expected: Partial<Record<ProjectCollectionKey, number>> = {};

  LEGACY_COLLECTION_KEYS.forEach((legacyKey) => {
    // Check both the resolved root and the raw top-level payload, same as
    // normalizeProjectData does. Take the larger count if both have values.
    const rootValue = root[legacyKey];
    const rawValue = raw[legacyKey];
    const value = Array.isArray(rootValue)
      ? rootValue
      : Array.isArray(rawValue)
        ? rawValue
        : undefined;

    if (!Array.isArray(value)) return;

    if (
      legacyKey === "rarities" &&
      (Array.isArray(root.customRarities) || Array.isArray(raw.customRarities))
    ) {
      return;
    }

    const projectKey = LEGACY_COLLECTION_TO_PROJECT_KEY[legacyKey];
    const existing = expected[projectKey] ?? 0;
    expected[projectKey] = Math.max(existing, value.length);
  });

  return expected;
};

const getProjectCollectionCounts = (
  project: ProjectData,
): Record<ProjectCollectionKey, number> => {
  return {
    jokers: project.jokers.length,
    sounds: project.sounds.length,
    consumables: project.consumables.length,
    rarities: project.rarities.length,
    consumableSets: project.consumableSets.length,
    boosters: project.boosters.length,
    enhancements: project.enhancements.length,
    seals: project.seals.length,
    editions: project.editions.length,
    vouchers: project.vouchers.length,
    decks: project.decks.length,
  };
};

const formatCollectionName = (key: ProjectCollectionKey): string => {
  switch (key) {
    case "consumableSets":
      return "consumable sets";
    default:
      return key;
  }
};

const assertLegacyImportCompleteness = (
  legacyPayload: unknown,
  project: ProjectData,
): void => {
  const expected = getLegacyExpectedCounts(legacyPayload);
  const actual = getProjectCollectionCounts(project);

  const missingCollections = (Object.keys(expected) as ProjectCollectionKey[])
    .map((key) => {
      const expectedCount = expected[key];
      if (typeof expectedCount !== "number") return null;

      const actualCount = actual[key];
      if (actualCount >= expectedCount) return null;

      return `${formatCollectionName(key)} ${actualCount}/${expectedCount}`;
    })
    .filter((value): value is string => value !== null);

  if (missingCollections.length === 0) return;

  throw new Error(
    `Legacy import appears incomplete. Missing items detected: ${missingCollections.join(", ")}.`,
  );
};

export const isLegacyJokerforgePayload = (payload: unknown): boolean => {
  const obj = resolveLegacyRoot(payload);
  if (!asObject(obj.metadata)) return false;

  const raw = asObject(payload) ?? {};
  const hasLegacyCollections = LEGACY_COLLECTION_KEYS.some(
    (key) => Array.isArray(obj[key]) || Array.isArray(raw[key]),
  );

  if (!hasLegacyCollections) return false;

  const hasLegacyEnvelopeFields =
    typeof obj.version === "string" ||
    typeof obj.exportedAt === "string" ||
    typeof raw.version === "string" ||
    typeof raw.exportedAt === "string";

  return hasLegacyEnvelopeFields || !asObject(obj.stats);
};

export const normalizeProjectData = (payload: unknown): ProjectData => {
  const obj = resolveLegacyRoot(payload);
  // Also keep a reference to the raw top-level payload. Some legacy formats
  // embed core types (jokers, consumables) inside a nested `project` object
  // but place newer types (seals, editions, enhancements, vouchers, boosters)
  // at the top level. We fall back to the raw payload for any key that the
  // resolved root doesn't have.
  const raw = asObject(payload) ?? {};
  const pick = (key: string): unknown =>
    obj[key] !== undefined ? obj[key] : raw[key];

  const raritySource = Array.isArray(obj.customRarities)
    ? obj.customRarities
    : Array.isArray(raw.customRarities)
      ? raw.customRarities
      : pick("rarities");

  const projectWithoutStats: Omit<ProjectData, "stats"> = {
    metadata: normalizeMetadata(obj.metadata),
    recentActivity: [],
    jokers: normalizeCollection(
      pick("jokers"),
      "joker",
    ) as unknown as ProjectData["jokers"],
    consumables: normalizeCollection(
      pick("consumables"),
      "consumable",
    ) as unknown as ProjectData["consumables"],
    rarities: normalizeRarities(raritySource) as ProjectData["rarities"],
    consumableSets: normalizeConsumableSets(
      pick("consumableSets"),
    ) as ProjectData["consumableSets"],
    decks: normalizeCollection(
      pick("decks"),
      "deck",
    ) as unknown as ProjectData["decks"],
    vouchers: normalizeCollection(
      pick("vouchers"),
      "voucher",
    ) as unknown as ProjectData["vouchers"],
    boosters: normalizeCollection(
      pick("boosters"),
      "booster",
    ) as unknown as ProjectData["boosters"],
    seals: normalizeCollection(
      pick("seals"),
      "seal",
    ) as unknown as ProjectData["seals"],
    editions: normalizeCollection(
      pick("editions"),
      "edition",
    ) as unknown as ProjectData["editions"],
    enhancements: normalizeCollection(
      pick("enhancements"),
      "enhancement",
    ) as unknown as ProjectData["enhancements"],
    sounds: normalizeSounds(pick("sounds")) as ProjectData["sounds"],
  };

  return {
    ...projectWithoutStats,
    stats: buildStats(projectWithoutStats),
  };
};

export const transpileLegacyJokerforge = (
  legacyPayload: unknown,
): ProjectData => {
  console.log("[legacy-transpiler] Starting legacy import...");

  const raw = asObject(legacyPayload) ?? {};
  const root = resolveLegacyRoot(legacyPayload);

  console.log("[legacy-transpiler] Raw top-level keys:", Object.keys(raw));
  console.log("[legacy-transpiler] Resolved root keys:", Object.keys(root));

  const collectionKeys = [
    "jokers",
    "consumables",
    "seals",
    "editions",
    "enhancements",
    "vouchers",
    "boosters",
    "decks",
    "sounds",
    "rarities",
    "consumableSets",
  ] as const;

  for (const key of collectionKeys) {
    const fromRoot = root[key];
    const fromRaw = raw[key];
    const source = Array.isArray(fromRoot)
      ? `root (${fromRoot.length} items)`
      : Array.isArray(fromRaw)
        ? `raw top-level (${fromRaw.length} items)`
        : "not found";
    console.log(`[legacy-transpiler] ${key}: ${source}`);
  }

  const project = normalizeProjectData(legacyPayload);

  console.log("[legacy-transpiler] Normalized project stats:", project.stats);

  assertLegacyImportCompleteness(legacyPayload, project);

  console.log("[legacy-transpiler] Import complete.");

  return project;
};
