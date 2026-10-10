import type { ProjectData } from "@/lib/services/storage";
import type {
  BaseGameObject,
  ConsumableData,
  ConsumableSetData,
  DeckData,
  EditionData,
  JokerData,
  RarityData,
  SoundData,
  VoucherData,
} from "@/lib/core/types";
import type { NavigationTarget } from "@/lib/app/navigation-target";
import { getAllGameVariables } from "@/lib/content/game-vars";
import { getRuleEffectRestriction } from "@/lib/rules/effect-restrictions";

export interface PreExportIssue {
  id: string;
  message: string;
  target?: NavigationTarget;
}

type IdentifierItem = { id: string; name?: string };

type CheckContext = {
  data: ProjectData;
  issues: PreExportIssue[];
};

const IDENTIFIER_REGEX = /^[A-Za-z0-9_]+$/;
const HEX_COLOR_REGEX = /^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const VANILLA_RARITY_KEYS = new Set(["common", "uncommon", "rare", "legendary"]);
const VANILLA_CONSUMABLE_SETS = new Set(["Tarot", "Planet", "Spectral"]);
// Saved projects can use these names from earlier compiler versions.
// Keep the aliases aligned with balatro-codegen's game_var_lua_code.
const GAME_VARIABLE_IDS = new Set([
  ...getAllGameVariables().map((variable) => variable.id),
  "hand_size", "remaining_hands", "remaining_discards", "deck_size",
  "full_deck_size", "player_money", "dollars", "ante_level", "blind_chips", "blind_mult",
  "consumable_count", "interest", "hand_level", "times_hand_played",
  "scored_card_count", "played_card_count", "poker_hand_count",
]);
const GAME_VARIABLE_NUMBER_REGEX = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const createIssueId = (): string =>
  `pre_export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const normalizeIdentifier = (value: string | undefined | null): string =>
  String(value || "").trim().toLowerCase();

const pushIssue = (
  issues: PreExportIssue[],
  message: string,
  target?: NavigationTarget,
) => {
  issues.push({ id: createIssueId(), message, ...(target ? { target } : {}) });
};

const formatItemName = (item: IdentifierItem, fallback: string): string =>
  item.name && item.name.trim() ? item.name.trim() : fallback;

const gameVariableReferenceError = (value: unknown, typed: boolean): string | null => {
  if (typeof value !== "string") {
    return typed ? "Game variables need a valid selection." : null;
  }
  let id = value;
  if (value.startsWith("GAMEVAR:")) {
    const parts = value.slice("GAMEVAR:".length).split("|");
    if (
      parts.length !== 3 || !parts[0] ||
      !parts.slice(1).every((part) => GAME_VARIABLE_NUMBER_REGEX.test(part) && Number.isFinite(Number(part)))
    ) {
      return "The game variable's starting value or multiplier is invalid. Choose the variable again and enter finite numbers.";
    }
    id = parts[0];
  } else if (!typed) {
    return null;
  }
  return GAME_VARIABLE_IDS.has(id)
    ? null
    : `Unknown game variable "${id}". Choose a supported variable in the Rule Builder.`;
};

const checkItemGameVariables = (
  issues: PreExportIssue[],
  item: BaseGameObject,
  label: string,
  path: string,
) => {
  const report = (location: string, message: string) => pushIssue(
    issues,
    `${label}: "${formatItemName(item, item.id)}" has a problem in ${location}: ${message}`,
    { path, itemId: item.id, editor: "rules" },
  );
  const checkValues = (value: unknown, location: string): void => {
    if (typeof value === "string") {
      const error = gameVariableReferenceError(value, false);
      if (error) report(location, error);
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => checkValues(entry, `${location} ${index + 1}`));
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const typed = record.valueType === "gameVariable" || record.valueType === "game_var";
      if (typed || (typeof record.value === "string" && record.value.startsWith("GAMEVAR:"))) {
        const error = gameVariableReferenceError(record.value, typed);
        if (error) report(location, error);
        return;
      }
      Object.entries(record).forEach(([key, entry]) => checkValues(entry, `${location} / ${key}`));
    }
  };
  const groupLabels: Record<string, string> = {
    conditions: "condition", effects: "effect", conditionGroups: "condition group",
    condition_groups: "condition group", randomGroups: "chance group", random_groups: "chance group",
    loops: "loop", loop_groups: "loop",
  };
  const checkRule = (value: unknown, location: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => checkRule(entry, `${location} ${index + 1}`));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) => {
        if (key === "params" || key === "triggerParams" || key === "trigger_params") {
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            Object.entries(entry).forEach(([name, parameter]) =>
              checkValues(parameter, `${location} / parameter "${name}"`),
            );
          }
        } else if (["chance_numerator", "chance_denominator", "chanceNumerator", "chanceDenominator", "repetitions", "count"].includes(key)) {
          checkValues(entry, `${location} / ${key.startsWith("chance") ? "chance" : "repetitions"}`);
        } else if (entry && typeof entry === "object") {
          checkRule(entry, `${location}${groupLabels[key] ? ` / ${groupLabels[key]}` : ""}`);
        }
      });
    }
  };
  checkRule(item.rules, "rule");

  // Imported projects may carry explicit description bindings. Their game
  // references need the same allowlist; literal localization text stays text.
  const record = item as unknown as Record<string, unknown>;
  const bindings = record.descriptionVariables ?? record.description_variables;
  if (Array.isArray(bindings)) {
    bindings.forEach((binding: unknown, index) => {
      if (!binding || typeof binding !== "object") return;
      const value = binding as Record<string, unknown>;
      if (value.kind === "game") {
        let error = typeof value.id !== "string"
          ? "Game variables need a valid selection."
          : GAME_VARIABLE_IDS.has(value.id)
            ? null
            : `Unknown game variable "${value.id}". Choose a supported variable in the Rule Builder.`;
        if (!error) {
          const startsFrom = value.startsFrom !== undefined
            ? value.startsFrom
            : value.starts_from !== undefined ? value.starts_from : 0;
          const multiplier = value.multiplier === undefined ? 1 : value.multiplier;
          if (
            typeof multiplier !== "number" || !Number.isFinite(multiplier) ||
            typeof startsFrom !== "number" || !Number.isFinite(startsFrom)
          ) {
            error = "The game variable's starting value or multiplier is invalid. Choose the variable again and enter finite numbers.";
          }
        }
        if (error) report(`description variable ${index + 1}`, error);
      } else if (value.kind === "config") {
        checkValues(value.fallback, `description variable ${index + 1}`);
      }
    });
  }
};

const checkMetadata = ({ data, issues }: CheckContext) => {
  const { metadata } = data;

  if (!metadata.id.trim()) {
    pushIssue(issues, "Metadata: Mod ID is required.", {
      path: "/metadata",
      editor: "info",
    });
  } else if (!IDENTIFIER_REGEX.test(metadata.id.trim())) {
    pushIssue(
      issues,
      "Metadata: Mod ID must only use letters, numbers, or underscores.",
      { path: "/metadata", editor: "info" },
    );
  }

  if (!metadata.prefix.trim()) {
    pushIssue(issues, "Metadata: Prefix is required.", {
      path: "/metadata",
      editor: "info",
    });
  } else if (!IDENTIFIER_REGEX.test(metadata.prefix.trim())) {
    pushIssue(
      issues,
      "Metadata: Prefix must only use letters, numbers, or underscores.",
      { path: "/metadata", editor: "info" },
    );
  }

  if (!metadata.name.trim()) {
    pushIssue(issues, "Metadata: Mod name is required.", {
      path: "/metadata",
      editor: "info",
    });
  }
};

const maybeCheckObjectKeySmodsPattern = (
  issues: PreExportIssue[],
  config: {
    label: string;
    path: string;
    itemId: string;
    itemName: string;
    objectKey: string;
    objectTypePrefix: string;
    modPrefix: string;
  },
) => {
  const key = config.objectKey.trim().toLowerCase();
  if (!key) return;

  const typedPrefix = `${config.objectTypePrefix}_`;
  if (key.startsWith(typedPrefix)) {
    pushIssue(
      issues,
      `${config.label}: "${config.itemName}" key "${config.objectKey}" should not start with "${typedPrefix}" because SMODS adds that automatically.`,
      {
        path: config.path,
        itemId: config.itemId,
        editor: "info",
      },
    );
  }

  const modPrefix = `${config.modPrefix.trim().toLowerCase()}_`;
  if (modPrefix !== "_" && key.startsWith(modPrefix)) {
    pushIssue(
      issues,
      `${config.label}: "${config.itemName}" key "${config.objectKey}" should not start with "${modPrefix}" because your mod prefix is applied automatically.`,
      {
        path: config.path,
        itemId: config.itemId,
        editor: "info",
      },
    );
  }
};

const checkBaseObjectCollection = (
  context: CheckContext,
  options: {
    label: string;
    path: string;
    items: BaseGameObject[];
    objectTypePrefix: string;
  },
) => {
  const { issues, data } = context;
  const keyMap = new Map<string, BaseGameObject[]>();

  options.items.forEach((item) => {
    const displayName = formatItemName(item, item.id);
    const rawKey = (item.objectKey || "").trim();
    const normalizedKey = normalizeIdentifier(rawKey);

    if (!rawKey) {
      pushIssue(
        issues,
        `${options.label}: "${displayName}" is missing Object Key.`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    } else if (!IDENTIFIER_REGEX.test(rawKey)) {
      pushIssue(
        issues,
        `${options.label}: "${displayName}" has an invalid Object Key "${rawKey}".`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    } else {
      maybeCheckObjectKeySmodsPattern(issues, {
        label: options.label,
        path: options.path,
        itemId: item.id,
        itemName: displayName,
        objectKey: rawKey,
        objectTypePrefix: options.objectTypePrefix,
        modPrefix: data.metadata.prefix,
      });
    }

    if (!item.name?.trim()) {
      pushIssue(
        issues,
        `${options.label}: item "${item.id}" is missing Name.`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    }

    if (!Array.isArray(item.rules) && item.rules !== undefined) {
      pushIssue(
        issues,
        `${options.label}: "${displayName}" has broken rule data (rules must be an array).`,
        {
          path: options.path,
          itemId: item.id,
          editor: "rules",
        },
      );
    }

    checkItemGameVariables(issues, item, options.label, options.path);

    if (!normalizedKey) return;
    const duplicates = keyMap.get(normalizedKey) || [];
    duplicates.push(item);
    keyMap.set(normalizedKey, duplicates);
  });

  keyMap.forEach((duplicates, key) => {
    if (duplicates.length < 2) return;
    duplicates.forEach((item) => {
      const displayName = formatItemName(item, item.id);
      const otherNames = duplicates
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => `"${formatItemName(candidate, candidate.id)}"`)
        .slice(0, 3)
        .join(", ");
      pushIssue(
        issues,
        `${options.label}: "${displayName}" shares duplicate Object Key "${key}" with ${otherNames}.`,
        {
          path: options.path,
          itemId: item.id,
          editor: "info",
        },
      );
    });
  });
};

const checkSimpleKeyCollection = <T extends IdentifierItem>(
  issues: PreExportIssue[],
  config: {
    label: string;
    path: string;
    keyLabel: string;
    getKey: (item: T) => string;
    getValueLabel: (item: T) => string;
    checkExtra?: (item: T) => string | null;
    supportsItemNavigation?: boolean;
  },
  items: T[],
) => {
  const keyMap = new Map<string, T[]>();
  const toTarget = (itemId: string): NavigationTarget => ({
    path: config.path,
    ...(config.supportsItemNavigation === false
      ? {}
      : { itemId, editor: "info" as const }),
  });

  items.forEach((item) => {
    const rawKey = config.getKey(item).trim();
    const key = normalizeIdentifier(rawKey);
    const valueLabel = config.getValueLabel(item);

    if (!rawKey) {
      pushIssue(
        issues,
        `${config.label}: "${valueLabel}" is missing ${config.keyLabel}.`,
        toTarget(item.id),
      );
    } else if (!IDENTIFIER_REGEX.test(rawKey)) {
      pushIssue(
        issues,
        `${config.label}: "${valueLabel}" has invalid ${config.keyLabel} "${rawKey}".`,
        toTarget(item.id),
      );
    }

    if (config.checkExtra) {
      const extraMessage = config.checkExtra(item);
      if (extraMessage) {
        pushIssue(issues, extraMessage, toTarget(item.id));
      }
    }

    if (!key) return;
    const duplicates = keyMap.get(key) || [];
    duplicates.push(item);
    keyMap.set(key, duplicates);
  });

  keyMap.forEach((duplicates, key) => {
    if (duplicates.length < 2) return;
    duplicates.forEach((item) => {
      const valueLabel = config.getValueLabel(item);
      const others = duplicates
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => `"${config.getValueLabel(candidate)}"`)
        .slice(0, 3)
        .join(", ");
      pushIssue(
        issues,
        `${config.label}: "${valueLabel}" shares duplicate ${config.keyLabel} "${key}" with ${others}.`,
        toTarget(item.id),
      );
    });
  });
};

const checkConsumableSetReferences = ({ data, issues }: CheckContext) => {
  const customSetKeys = new Set(
    data.consumableSets.map((set) => normalizeIdentifier(set.key)),
  );

  data.consumables.forEach((item: ConsumableData) => {
    const setValue = String(item.set || "").trim();
    if (!setValue) return;
    if (VANILLA_CONSUMABLE_SETS.has(setValue)) return;
    if (customSetKeys.has(normalizeIdentifier(setValue))) return;

    pushIssue(
      issues,
      `Consumables: "${formatItemName(item, item.id)}" uses unknown set "${setValue}".`,
      {
        path: "/consumables",
        itemId: item.id,
        editor: "info",
      },
    );
  });
};

const checkDeckConfigKeys = ({ data, issues }: CheckContext) => {
  data.decks.forEach((deck: DeckData) => {
    const deckName = formatItemName(deck, deck.id);

    (deck.Config_vouchers || []).forEach((voucherKey) => {
      const value = String(voucherKey || "").trim();
      if (!value) return;
      if (value.startsWith("v_")) return;
      pushIssue(
        issues,
        `Decks: "${deckName}" has voucher key "${value}" but SMODS expects voucher keys to start with "v_".`,
        {
          path: "/decks",
          itemId: deck.id,
          editor: "info",
        },
      );
    });

    (deck.Config_consumables || []).forEach((consumableKey) => {
      const value = String(consumableKey || "").trim();
      if (!value) return;
      if (value.startsWith("c_")) return;
      pushIssue(
        issues,
        `Decks: "${deckName}" has consumable key "${value}" but SMODS expects consumable keys to start with "c_".`,
        {
          path: "/decks",
          itemId: deck.id,
          editor: "info",
        },
      );
    });
  });
};

const checkDeckStartupRules = ({ data, issues }: CheckContext) => {
  data.decks.forEach((deck) => {
    const restriction = getRuleEffectRestriction(deck.rules, "deck");
    if (!restriction) return;
    pushIssue(
      issues,
      `Decks: "${formatItemName(deck, deck.id)}": ${restriction.message}`,
      { path: "/decks", itemId: deck.id, editor: "rules" },
    );
  });
};

const checkVoucherRequirements = ({ data, issues }: CheckContext) => {
  data.vouchers.forEach((voucher: VoucherData) => {
    const value = String(voucher.requires || "").trim();
    if (!value) return;
    if (value.startsWith("v_")) return;

    pushIssue(
      issues,
      `Vouchers: "${formatItemName(voucher, voucher.id)}" has requires="${value}" but SMODS voucher keys should start with "v_".`,
      {
        path: "/vouchers",
        itemId: voucher.id,
        editor: "info",
      },
    );
  });
};

const checkJokerRarityReferences = ({ data, issues }: CheckContext) => {
  const modPrefix = normalizeIdentifier(data.metadata.prefix);
  const customRarityKeys = new Set(
    data.rarities.map((rarity) => normalizeIdentifier(rarity.key)),
  );
  const customRarityExportKeys = new Set(
    [...customRarityKeys].map((key) =>
      modPrefix ? `${modPrefix}_${key}` : key,
    ),
  );

  data.jokers.forEach((joker: JokerData) => {
    if (typeof joker.rarity !== "string") return;
    const rarity = joker.rarity.trim();
    if (!rarity) return;
    const normalized = normalizeIdentifier(rarity);
    if (VANILLA_RARITY_KEYS.has(normalized)) return;
    const matchesRawCustomKey = customRarityKeys.has(normalized);
    const matchesExportedCustomKey = customRarityExportKeys.has(normalized);
    if (matchesRawCustomKey || matchesExportedCustomKey) {
      if (
        modPrefix &&
        matchesExportedCustomKey &&
        !matchesRawCustomKey &&
        normalized.startsWith(`${modPrefix}_`)
      ) {
        const baseKey = normalized.slice(modPrefix.length + 1);
        pushIssue(
          issues,
          `Jokers: "${formatItemName(joker, joker.id)}" rarity "${rarity}" already includes "${modPrefix}_". Prefer "${baseKey}" to avoid prefix confusion in exports.`,
          {
            path: "/jokers",
            itemId: joker.id,
            editor: "info",
          },
        );
      }
      return;
    }

    pushIssue(
      issues,
      `Jokers: "${formatItemName(joker, joker.id)}" uses unknown rarity key "${rarity}".`,
      {
        path: "/jokers",
        itemId: joker.id,
        editor: "info",
      },
    );
  });
};

const checkEditionShaderKeys = ({ data, issues }: CheckContext) => {
  data.editions.forEach((edition: EditionData) => {
    const shader = String(edition.shader || "").trim();
    if (!shader || shader === "false") return;
    if (IDENTIFIER_REGEX.test(shader)) return;

    pushIssue(
      issues,
      `Editions: "${formatItemName(edition, edition.id)}" has shader "${shader}" with invalid characters.`,
      {
        path: "/editions",
        itemId: edition.id,
        editor: "info",
      },
    );
  });
};

const checkConsumableSetColors = ({ data, issues }: CheckContext) => {
  data.consumableSets.forEach((set: ConsumableSetData) => {
    if (!HEX_COLOR_REGEX.test(String(set.primary_colour || "").replace("#", ""))) {
      pushIssue(
        issues,
        `Consumable Sets: "${set.name || set.id}" has invalid primary color "${set.primary_colour}".`,
        {
          path: "/consumable-sets",
          itemId: set.id,
          editor: "info",
        },
      );
    }
    if (
      !HEX_COLOR_REGEX.test(String(set.secondary_colour || "").replace("#", ""))
    ) {
      pushIssue(
        issues,
        `Consumable Sets: "${set.name || set.id}" has invalid secondary color "${set.secondary_colour}".`,
        {
          path: "/consumable-sets",
          itemId: set.id,
          editor: "info",
        },
      );
    }
  });
};

export const runPreExportChecks = (data: ProjectData): PreExportIssue[] => {
  const issues: PreExportIssue[] = [];
  const context: CheckContext = { data, issues };

  checkMetadata(context);

  checkBaseObjectCollection(context, {
    label: "Jokers",
    path: "/jokers",
    items: data.jokers,
    objectTypePrefix: "j",
  });
  checkBaseObjectCollection(context, {
    label: "Consumables",
    path: "/consumables",
    items: data.consumables,
    objectTypePrefix: "c",
  });
  checkBaseObjectCollection(context, {
    label: "Vouchers",
    path: "/vouchers",
    items: data.vouchers,
    objectTypePrefix: "v",
  });
  checkBaseObjectCollection(context, {
    label: "Decks",
    path: "/decks",
    items: data.decks,
    objectTypePrefix: "b",
  });
  checkBaseObjectCollection(context, {
    label: "Enhancements",
    path: "/enhancements",
    items: data.enhancements,
    objectTypePrefix: "m",
  });
  checkBaseObjectCollection(context, {
    label: "Seals",
    path: "/seals",
    items: data.seals,
    objectTypePrefix: "s",
  });
  checkBaseObjectCollection(context, {
    label: "Editions",
    path: "/editions",
    items: data.editions,
    objectTypePrefix: "e",
  });
  checkBaseObjectCollection(context, {
    label: "Boosters",
    path: "/boosters",
    items: data.boosters,
    objectTypePrefix: "p",
  });

  data.boosters.forEach((booster) => {
    const target: NavigationTarget = {
      path: "/boosters",
      itemId: booster.id,
      editor: "info",
    };
    const name = formatItemName(booster, booster.id);
    const extra = booster.config?.extra ?? 3;
    const choose = booster.config?.choose ?? 1;
    if (!Number.isInteger(extra) || extra < 1 || !Number.isInteger(choose) || choose < 1 || choose > extra) {
      pushIssue(issues, `Boosters: "${name}" needs a positive whole number of cards and choices, with choices no greater than the pack size.`, target);
    }
    const rules = booster.card_rules ?? [];
    if (rules.some((rule) => !Number.isFinite(rule.weight ?? 1) || (rule.weight ?? 1) < 0)) {
      pushIssue(issues, `Boosters: "${name}" has an invalid content weight. Weights must be zero or greater.`, target);
    } else if (rules.length > 0 && rules.every((rule) => (rule.weight ?? 1) === 0)) {
      pushIssue(issues, `Boosters: "${name}" needs at least one content rule with a weight greater than zero.`, target);
    }
  });

  checkSimpleKeyCollection<SoundData>(
    issues,
    {
      label: "Sounds",
      path: "/sounds",
      keyLabel: "key",
      getKey: (item) => item.key,
      getValueLabel: (item) => item.key || item.id,
      supportsItemNavigation: false,
      checkExtra: (item) => {
        if (!item.soundString?.trim()) {
          return `Sounds: "${item.key || item.id}" is missing an uploaded MP3 or OGG filename.`;
        }
        if (!item.audioDataUrl?.trim()) {
          return `Sounds: "${item.key || item.id}" is missing uploaded MP3 or OGG data.`;
        }
        const modPrefix = String(data.metadata.prefix || "").trim().toLowerCase();
        const key = String(item.key || "").trim().toLowerCase();
        if (modPrefix && key.startsWith(`${modPrefix}_`)) {
          return `Sounds: "${item.key}" should not start with "${modPrefix}_" because sound keys are already prefixed automatically.`;
        }
        return null;
      },
    },
    data.sounds,
  );

  checkSimpleKeyCollection<RarityData>(
    issues,
    {
      label: "Rarities",
      path: "/rarities",
      keyLabel: "key",
      getKey: (item) => item.key,
      getValueLabel: (item) => item.name || item.id,
      checkExtra: (item) => {
        const modPrefix = normalizeIdentifier(data.metadata.prefix);
        const key = normalizeIdentifier(item.key);
        if (modPrefix && key.startsWith(`${modPrefix}_`)) {
          return `Rarities: "${item.name || item.id}" key "${item.key}" should not start with "${modPrefix}_" because joker rarity references are already prefixed during export.`;
        }
        return null;
      },
    },
    data.rarities,
  );

  checkSimpleKeyCollection<ConsumableSetData>(
    issues,
    {
      label: "Consumable Sets",
      path: "/consumable-sets",
      keyLabel: "key",
      getKey: (item) => item.key,
      getValueLabel: (item) => item.name || item.id,
      checkExtra: (item) => {
        const key = String(item.key || "").trim().toLowerCase();
        if (key.startsWith("c_")) {
          return `Consumable Sets: "${item.name || item.id}" key "${item.key}" should not start with "c_" because SMODS builds that prefix automatically.`;
        }
        return null;
      },
    },
    data.consumableSets,
  );

  checkConsumableSetReferences(context);
  checkDeckConfigKeys(context);
  checkDeckStartupRules(context);
  checkVoucherRequirements(context);
  checkJokerRarityReferences(context);
  checkEditionShaderKeys(context);
  checkConsumableSetColors(context);

  return issues;
};
