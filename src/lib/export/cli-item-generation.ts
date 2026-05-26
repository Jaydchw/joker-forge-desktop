import type { PreviewCompileItemType } from "@/lib/export/rust-codegen-export";

type SupportedItemType = PreviewCompileItemType | "card";

type ParamLike = unknown | { value: unknown; valueType?: string };

type EffectInput = {
  id?: string;
  type: string;
  params?: Record<string, ParamLike>;
};

type ConditionInput = {
  id?: string;
  type: string;
  negate?: boolean;
  operator?: string;
  params?: Record<string, ParamLike>;
};

type ConditionGroupInput = {
  operator?: "and" | "or";
  conditions?: ConditionInput[];
};

type RandomGroupInput = {
  id?: string;
  chance_numerator?: ParamLike;
  chance_denominator?: ParamLike;
  respect_probability_effects?: boolean;
  custom_key?: string;
  effects?: EffectInput[];
};

type LoopGroupInput = {
  id?: string;
  repetitions?: ParamLike;
  effects?: EffectInput[];
};

export type RuleBuilderApiRuleInput = {
  id?: string;
  trigger?: string;
  conditionGroups?: ConditionGroupInput[];
  effects?: EffectInput[];
  randomGroups?: RandomGroupInput[];
  loops?: LoopGroupInput[];
};

type CliCodegenRequest = {
  itemType: PreviewCompileItemType;
  itemData: Record<string, unknown>;
  modPrefix: string;
  includeLocTxt: boolean;
  pos: null;
  soulPos: null;
  globalUserVariables: null;
};

type CreateCliItemRequestOptions = {
  itemType?: SupportedItemType;
  rules: RuleBuilderApiRuleInput[];
  objectKey?: string;
  modPrefix?: string;
  includeLocTxt?: boolean;
  itemDataOverrides?: Record<string, unknown>;
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toWrappedParam = (value: ParamLike): { value: unknown; valueType?: string } => {
  if (value && typeof value === "object" && "value" in value) {
    const wrapped = value as { value: unknown; valueType?: string };
    return {
      value: wrapped.value,
      ...(wrapped.valueType ? { valueType: wrapped.valueType } : {}),
    };
  }
  return { value };
};

const defaultTriggerForItemType = (itemType: PreviewCompileItemType): string => {
  if (itemType === "consumable" || itemType === "voucher" || itemType === "deck") {
    return "card_used";
  }
  return "hand_played";
};

const normalizeRules = (
  itemType: PreviewCompileItemType,
  rules: RuleBuilderApiRuleInput[],
): Record<string, unknown>[] => {
  return (rules || []).map((rule) => ({
    id: rule.id ?? createId(),
    trigger: rule.trigger ?? defaultTriggerForItemType(itemType),
    conditionGroups: (rule.conditionGroups || []).map((group) => ({
      operator: group.operator ?? "and",
      conditions: (group.conditions || []).map((condition) => ({
        id: condition.id ?? createId(),
        type: condition.type,
        negate: !!condition.negate,
        ...(condition.operator ? { operator: condition.operator } : {}),
        params: Object.fromEntries(
          Object.entries(condition.params || {}).map(([key, value]) => [
            key,
            toWrappedParam(value),
          ]),
        ),
      })),
    })),
    effects: (rule.effects || []).map((effect) => ({
      id: effect.id ?? createId(),
      type: effect.type,
      params: Object.fromEntries(
        Object.entries(effect.params || {}).map(([key, value]) => [key, toWrappedParam(value)]),
      ),
    })),
    randomGroups: (rule.randomGroups || []).map((group) => ({
      id: group.id ?? createId(),
      chance_numerator: toWrappedParam(group.chance_numerator ?? { value: 1, valueType: "number" }),
      chance_denominator: toWrappedParam(
        group.chance_denominator ?? { value: 4, valueType: "number" },
      ),
      respect_probability_effects: group.respect_probability_effects ?? true,
      custom_key: group.custom_key ?? "",
      effects: (group.effects || []).map((effect) => ({
        id: effect.id ?? createId(),
        type: effect.type,
        params: Object.fromEntries(
          Object.entries(effect.params || {}).map(([key, value]) => [key, toWrappedParam(value)]),
        ),
      })),
    })),
    loops: (rule.loops || []).map((group) => ({
      id: group.id ?? createId(),
      repetitions: toWrappedParam(group.repetitions ?? { value: 1, valueType: "number" }),
      effects: (group.effects || []).map((effect) => ({
        id: effect.id ?? createId(),
        type: effect.type,
        params: Object.fromEntries(
          Object.entries(effect.params || {}).map(([key, value]) => [key, toWrappedParam(value)]),
        ),
      })),
    })),
  }));
};

const normalizedItemType = (itemType: SupportedItemType): PreviewCompileItemType =>
  itemType === "card" ? "enhancement" : itemType;

const defaultObjectKey = (itemType: PreviewCompileItemType): string => `new_${itemType}`;

const defaultItemName = (itemType: PreviewCompileItemType): string =>
  `New ${itemType.charAt(0).toUpperCase()}${itemType.slice(1)}`;

const defaultItemDescription = (itemType: PreviewCompileItemType): string =>
  `Generated ${itemType} item`;

const buildBaseItemData = (
  itemType: PreviewCompileItemType,
  objectKey: string,
  rules: Record<string, unknown>[],
): Record<string, unknown> => {
  const name = defaultItemName(itemType);
  const description = defaultItemDescription(itemType);

  const shared = {
    objectType: itemType,
    objectKey,
    name,
    description,
    localizations: [{ language: "en-us", name, description }],
    rules,
    info_queues: [],
    userVariables: [],
  };

  if (itemType === "joker") {
    return {
      ...shared,
      rarity: 1,
      cost: 4,
      blueprint_compat: true,
      eternal_compat: true,
      perishable_compat: true,
      unlocked: true,
      discovered: true,
      appears_in_shop: true,
      pools: [],
      atlas: "CustomJokers",
    };
  }

  if (itemType === "consumable") {
    return {
      ...shared,
      set: "Tarot",
      cost: 3,
      unlocked: true,
      discovered: true,
      hidden: false,
      can_repeat_soul: false,
      atlas: "CustomConsumables",
    };
  }

  if (itemType === "voucher") {
    return {
      ...shared,
      cost: 10,
      unlocked: true,
      discovered: true,
      no_collection: false,
      can_repeat_soul: false,
      atlas: "Vouchers",
    };
  }

  if (itemType === "deck") {
    return {
      ...shared,
      unlocked: true,
      discovered: true,
      no_collection: false,
      Config_vouchers: [],
      Config_consumables: [],
      no_interest: false,
      no_faces: false,
      erratic_deck: false,
      atlas: "centers",
    };
  }

  if (itemType === "enhancement") {
    return {
      ...shared,
      unlocked: true,
      discovered: true,
      no_collection: false,
      weight: 5,
      any_suit: false,
      replace_base_card: false,
      no_rank: false,
      no_suit: false,
      always_scores: false,
      atlas: "centers",
    };
  }

  if (itemType === "seal") {
    return {
      ...shared,
      unlocked: true,
      discovered: true,
      no_collection: false,
      badge_colour: "#FFFFFF",
      sound: "gold_seal",
      pitch: 1,
      volume: 0.8,
      atlas: "centers",
    };
  }

  return {
    ...shared,
    unlocked: true,
    discovered: true,
    no_collection: false,
    weight: 5,
    shader: false,
    extra_cost: 0,
    badge_colour: "#FFFFFF",
    sound: "foil1",
    pitch: 1,
    volume: 1,
    disable_shadow: false,
    disable_base_shader: false,
    atlas: "centers",
  };
};

/**
 * Build a complete `codegen-item` CLI request with defaults.
 *
 * Only `rules` are required. Everything else is defaulted and can be overridden.
 */
export const createCliItemRequest = (
  options: CreateCliItemRequestOptions,
): CliCodegenRequest => {
  const inputType = options.itemType ?? "joker";
  const itemType = normalizedItemType(inputType);
  const objectKey = options.objectKey?.trim() || defaultObjectKey(itemType);
  const rules = normalizeRules(itemType, options.rules || []);
  const baseItemData = buildBaseItemData(itemType, objectKey, rules);
  const itemData = {
    ...baseItemData,
    ...(options.itemDataOverrides || {}),
    objectType: itemType,
    objectKey,
    rules,
  };

  return {
    itemType,
    itemData,
    modPrefix: options.modPrefix?.trim() || "mod",
    includeLocTxt: options.includeLocTxt ?? true,
    pos: null,
    soulPos: null,
    globalUserVariables: null,
  };
};

/**
 * Convert a request object into the exact JSON payload string accepted by:
 * `joker-forge-desktop codegen-item --json '<payload>'`.
 */
export const serializeCliItemRequest = (request: CliCodegenRequest): string =>
  JSON.stringify(request);

