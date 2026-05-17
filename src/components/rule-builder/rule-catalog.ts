import {
  Archive,
  CurrencyDollar,
  Cake,
  ChartBar,
  Clock,
  GearSix,
  HandPalm,
  Info,
  NotePencil,
  Play,
  Percent,
  Stack,
  ShoppingBag,
  ShoppingCart,
  Sparkle,
  Ticket,
  Users,
  User,
  Function,
} from "@phosphor-icons/react";
import type {
  ConditionParameter,
  EffectParameter,
  GlobalConditionTypeDefinition,
  GlobalEffectTypeDefinition,
  GlobalTriggerDefinition,
} from "./types";
import { entityBridge } from "@/lib/services/entity-bridge";
import {
  ALL_JOKERS,
  ALL_CONSUMABLES,
  CONSUMABLE_SETS,
  CUSTOM_CONSUMABLES,
  DECKS,
  EDITIONS,
  ENHANCEMENTS,
  POKER_HANDS,
  PLANET_CARDS,
  RARITIES,
  RANKS,
  SEALS,
  SPECTRAL_CARDS,
  SUITS,
  TAGS,
  TAROT_CARDS,
  VOUCHERS,
} from "@/lib/balatro/balatro-utils";

export interface CategoryDefinition {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface RuleCatalogPayload {
  triggers: GlobalTriggerDefinition[];
  conditions: GlobalConditionTypeDefinition[];
  effects: GlobalEffectTypeDefinition[];
  generic_triggers: string[];
  all_objects: string[];
  trigger_groups?: Record<string, string[]>;
  option_sources?: Record<string, string>;
  option_sets?: Record<string, unknown[]>;
}

export const TRIGGER_CATEGORIES: CategoryDefinition[] = [
  { label: "Usage", icon: Ticket },
  { label: "Hand Scoring", icon: HandPalm },
  { label: "In Blind Events", icon: Play },
  { label: "Round Events", icon: Clock },
  { label: "Economy", icon: CurrencyDollar },
  { label: "Packs & Consumables", icon: Stack },
  { label: "Shop Events", icon: ShoppingCart },
  { label: "Special", icon: Sparkle },
];

export const CONDITION_CATEGORIES: CategoryDefinition[] = [
  { label: "Hand", icon: HandPalm },
  { label: "Card", icon: Stack },
  { label: "Jokers", icon: Users },
  { label: "Player Resources", icon: User },
  { label: "Deck", icon: Archive },
  { label: "Variables", icon: Function },
  { label: "Probability", icon: Percent },
  { label: "Game State", icon: Info },
  { label: "Special", icon: Sparkle },
];

export const EFFECT_CATEGORIES: CategoryDefinition[] = [
  { label: "Deck Card Modifications", icon: Archive },
  { label: "Scoring", icon: ChartBar },
  { label: "Economy", icon: CurrencyDollar },
  { label: "Card Effects", icon: NotePencil },
  { label: "Blind & Ante", icon: Play },
  { label: "Jokers", icon: Users },
  { label: "Consumables", icon: Cake },
  { label: "Vouchers & Tags", icon: Ticket },
  { label: "Shop", icon: ShoppingBag },
  { label: "Game Rules", icon: GearSix },
  { label: "Variables", icon: Function },
  { label: "Probability", icon: Percent },
  { label: "Special", icon: Sparkle },
];

export let TRIGGERS: GlobalTriggerDefinition[] = [];
export let CONDITIONS: GlobalConditionTypeDefinition[] = [];
export let EFFECTS: GlobalEffectTypeDefinition[] = [];
export let GENERIC_TRIGGERS: string[] = [];
export let ALL_OBJECTS: string[] = [];
export let TRIGGER_GROUPS: Record<string, string[]> = {};
export let COMMON_OPTION_SETS: Record<string, unknown[]> = {};
export let AVAILABLE_OPTION_SOURCES = new Set<string>();

type CatalogOption = {
  value: string;
  label: string;
};

type SourcedParameter = (ConditionParameter | EffectParameter) & {
  optionSource?: string;
  optionSet?: string;
};

type CatalogOptionLike = {
  value: string;
  label: string;
  [key: string]: unknown;
};

const OPTION_SOURCES: Record<string, () => CatalogOption[]> = {
  jokers: () => asOptionArray(ALL_JOKERS()),
  rarities: () => asOptionArray(RARITIES()),
  consumables: () => asOptionArray(CUSTOM_CONSUMABLES()),
  consumableSets: () => asOptionArray(CONSUMABLE_SETS()),
  enhancements: () => asOptionArray(ENHANCEMENTS()),
  editions: () => asOptionArray(EDITIONS()),
  seals: () => asOptionArray(SEALS()),
  vouchers: () => asOptionArray(VOUCHERS()),
  decks: () => asOptionArray(DECKS()),
  ranks: () => asOptionArray(RANKS),
  suits: () => asOptionArray(SUITS),
  pokerHands: () => asOptionArray(POKER_HANDS),
  tags: () => asOptionArray(TAGS),
  tarotCards: () => asOptionArray(TAROT_CARDS),
  planetCards: () => asOptionArray(PLANET_CARDS),
  spectralCards: () => asOptionArray(SPECTRAL_CARDS),
  allConsumables: () =>
    uniqueByValue([
      ...asOptionArray(ALL_CONSUMABLES),
      ...asOptionArray(CUSTOM_CONSUMABLES()),
    ]),
};

function asOptionArray(source: unknown): CatalogOption[] {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .filter((item): item is { value: unknown; label: unknown } => {
      return (
        !!item && typeof item === "object" && "value" in item && "label" in item
      );
    })
    .map((item) => ({
      value: String(item.value),
      label: String(item.label),
    }));
}

function asOptionObjectArray(source: unknown): CatalogOptionLike[] {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .filter((item): item is Record<string, unknown> => {
      return (
        !!item && typeof item === "object" && "value" in item && "label" in item
      );
    })
    .map((item) => ({
      ...item,
      value: String(item.value),
      label: String(item.label),
    }));
}

function uniqueByValue(options: CatalogOption[]): CatalogOption[] {
  const seen = new Set<string>();
  const merged: CatalogOption[] = [];

  for (const option of options) {
    if (seen.has(option.value)) {
      continue;
    }
    seen.add(option.value);
    merged.push(option);
  }

  return merged;
}

function uniqueOptionObjectsByValue(
  options: CatalogOptionLike[],
): CatalogOptionLike[] {
  const seen = new Set<string>();
  const merged: CatalogOptionLike[] = [];

  for (const option of options) {
    if (seen.has(option.value)) {
      continue;
    }
    seen.add(option.value);
    merged.push(option);
  }

  return merged;
}

function applyOptionSet(param: ConditionParameter | EffectParameter) {
  const sourcedParam = param as SourcedParameter;
  if (!sourcedParam.optionSet) {
    return;
  }

  const source = COMMON_OPTION_SETS[sourcedParam.optionSet];
  if (!source) {
    return;
  }

  const dynamic = asOptionObjectArray(source);
  if (param.type === "checkbox") {
    const staticOptions = asOptionObjectArray(
      (param as EffectParameter).checkboxOptions,
    );
    (param as EffectParameter).checkboxOptions = uniqueOptionObjectsByValue([
      ...staticOptions,
      ...dynamic,
    ]);
    return;
  }

  const staticOptions = asOptionObjectArray(param.options);
  param.options = uniqueOptionObjectsByValue([...staticOptions, ...dynamic]);
}

function mergeWithDynamicCheckboxOptions(
  param: ConditionParameter | EffectParameter,
  dynamic: CatalogOption[],
) {
  const staticOptions = asOptionArray(
    (param as EffectParameter).checkboxOptions,
  );
  (param as EffectParameter).checkboxOptions = uniqueByValue([
    ...staticOptions,
    ...dynamic,
  ]);
}

function applyOptionSource(
  param: ConditionParameter | EffectParameter,
  sourceKey: string,
) {
  if (!AVAILABLE_OPTION_SOURCES.has(sourceKey)) {
    return;
  }

  const source = OPTION_SOURCES[sourceKey];
  if (!source) {
    return;
  }

  if (param.type === "checkbox") {
    mergeWithDynamicCheckboxOptions(param, source());
    return;
  }

  const baseOptions = param.options;
  param.options = (
    parentValues?: Record<string, { value: unknown; valueType?: string }>,
  ) => {
    let staticOptions: CatalogOption[] = [];

    if (typeof baseOptions === "function") {
      staticOptions = asOptionArray(baseOptions(parentValues ?? {}));
    } else {
      staticOptions = asOptionArray(baseOptions);
    }

    return uniqueByValue([...staticOptions, ...source()]);
  };
}

function applyDynamicParameterOptions(
  param: ConditionParameter | EffectParameter,
) {
  const sourcedParam = param as SourcedParameter;

  applyOptionSet(param);

  if (sourcedParam.optionSource) {
    applyOptionSource(sourcedParam, sourcedParam.optionSource);
  }
}

function applyDynamicCatalogOptions() {
  for (const definition of CONDITIONS) {
    for (const param of definition.params ?? []) {
      applyDynamicParameterOptions(param);
    }
  }

  for (const definition of EFFECTS) {
    for (const param of definition.params ?? []) {
      applyDynamicParameterOptions(param);
    }
  }
}

function resolveApplicableTriggers(
  definition: GlobalConditionTypeDefinition | GlobalEffectTypeDefinition,
): string[] {
  const explicit = definition.applicableTriggers ?? [];
  const groupIds = definition.applicableTriggerGroups ?? [];
  const fromGroups = groupIds.flatMap(
    (groupId: string) => TRIGGER_GROUPS[groupId] ?? [],
  );
  return uniqueByValue(
    [...explicit, ...fromGroups].map((value) => ({ value, label: value })),
  ).map((entry) => entry.value);
}

function applyTriggerGroupsToCatalog() {
  CONDITIONS = CONDITIONS.map((definition) => ({
    ...definition,
    applicableTriggers: resolveApplicableTriggers(definition),
  }));

  EFFECTS = EFFECTS.map((definition) => ({
    ...definition,
    applicableTriggers: resolveApplicableTriggers(definition),
  }));
}

export async function initializeRuleCatalogFromRust() {
  const payload =
    await entityBridge.getRulebuilderCatalog<RuleCatalogPayload>();
  TRIGGERS = payload.triggers;
  CONDITIONS = payload.conditions;
  EFFECTS = payload.effects;
  GENERIC_TRIGGERS = payload.generic_triggers;
  ALL_OBJECTS = payload.all_objects;
  TRIGGER_GROUPS = payload.trigger_groups ?? {};
  COMMON_OPTION_SETS = payload.option_sets ?? {};
  AVAILABLE_OPTION_SOURCES = new Set(Object.keys(payload.option_sources ?? {}));
  applyTriggerGroupsToCatalog();
  applyDynamicCatalogOptions();
}

export function getTriggerById(
  id: string,
): GlobalTriggerDefinition | undefined {
  return TRIGGERS.find((trigger) => trigger.id === id);
}

export function getTriggers(itemType: string): GlobalTriggerDefinition[] {
  const normalizedType =
    itemType === "edition" || itemType === "enhancement" || itemType === "seal"
      ? "card"
      : itemType;
  return TRIGGERS.filter((trigger) =>
    trigger.objectUsers.includes(normalizedType),
  );
}

export function getConditionTypeById(
  id: string,
): GlobalConditionTypeDefinition | undefined {
  return CONDITIONS.find((conditionType) => conditionType.id === id);
}

export function getConditionsForTrigger(
  triggerId: string,
  itemType: string,
): GlobalConditionTypeDefinition[] {
  const normalizedType =
    itemType === "enhancement" || itemType === "edition" || itemType === "seal"
      ? "card"
      : itemType;

  if (
    (normalizedType === "voucher" || normalizedType === "deck") &&
    triggerId === "card_used"
  ) {
    return [];
  }

  return CONDITIONS.filter(
    (condition) =>
      condition.applicableTriggers?.includes(triggerId) &&
      condition.objectUsers.includes(normalizedType),
  );
}

export function getEffectTypeById(
  id: string,
): GlobalEffectTypeDefinition | undefined {
  return EFFECTS.find((effectType) => effectType.id === id);
}

export function getEffectsForTrigger(
  triggerId: string,
  itemType: string,
): GlobalEffectTypeDefinition[] {
  const normalizedType =
    itemType === "enhancement" || itemType === "edition" || itemType === "seal"
      ? "card"
      : itemType;

  return EFFECTS.filter(
    (effect) =>
      effect.applicableTriggers?.includes(triggerId) &&
      effect.objectUsers.includes(normalizedType),
  );
}
