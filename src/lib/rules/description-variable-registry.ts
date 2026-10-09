import type { Effect, RandomGroup, Rule } from "@/components/rule-builder/types";
import { GAME_VARIABLE_CATEGORIES } from "@/lib/content/game-vars";
import type { UserVariable } from "@/lib/core/types";

type ParameterValue = { value: unknown; valueType?: string };

export type DescriptionVariableBinding =
  | { kind: "literal"; value: string | number }
  | { kind: "user"; name: string }
  | {
      kind: "config";
      name: string;
      effect_id?: string;
      fallback?: string | number | { value: unknown; valueType: string };
    }
  | {
      kind: "probability";
      group_id: string;
      part: "numerator" | "denominator";
    }
  | { kind: "game"; id: string; multiplier?: number; startsFrom?: number };

export type DescriptionVariableToken = {
  label: string;
  source: string;
  category: "loc" | "config" | "user" | "game" | "probability";
  binding: DescriptionVariableBinding;
  previewValue?: string;
};

type DescriptionVariableItem = {
  objectType?: string;
  rules?: Rule[];
  userVariables?: UserVariable[];
  locVars?: { vars?: Array<string | number> };
  config?: { choose?: number; extra?: number };
};

const GAME_VARIABLE_LABELS = new Map<string, string>();
for (const category of GAME_VARIABLE_CATEGORIES) {
  for (const variable of category.variables) {
    GAME_VARIABLE_LABELS.set(variable.id, variable.label);
  }
  for (const subcategory of category.subcategories || []) {
    for (const variable of subcategory.variables) {
      GAME_VARIABLE_LABELS.set(variable.id, variable.label);
    }
  }
}

const CONFIG_VAR_BASES_BY_EFFECT: Record<string, string> = {
  add_chips: "chips",
  add_mult: "mult",
  apply_x_mult: "Xmult",
  apply_x_chips: "Xchips",
  apply_exp_chips: "eChips",
  apply_exp_mult: "eMult",
  apply_hyper_chips: "hChips",
  apply_hyper_mult: "hMult",
  set_dollars: "dollars",
  retrigger: "repetitions",
  draw_cards: "card_draw",
  increment_rank: "rank_change",
  edit_reroll_price: "reroll_cost",
  edit_interest_cap: "interest_cap",
  discount_items: "item_prices",
  edit_item_weight: "item_rate",
  edit_rarity_weight: "item_rate",
  edit_win_ante: "winner_ante_value",
  edit_winner_ante: "winner_ante_value",
  edit_joker_slots: "joker_slots",
  edit_joker_size: "joker_size",
  edit_consumable_slots: "consumable_slots",
  edit_hand_size: "hand_size",
  edit_play_size: "play_size",
  edit_discard_size: "discard_size",
  edit_voucher_slots: "voucher_slots",
  edit_booster_slots: "booster_slots",
  edit_shop_slots: "shop_slots",
};

// Keep the original inferred slots so existing #N# descriptions retain their
// meaning. Bind them to the compiler's actual names rather than guessing a
// different ordering from the compiled config table.
const CONFIG_VAR_COMPILER_BASES_BY_EFFECT: Record<string, string> = {
  apply_exp_chips: "e_chips",
  apply_exp_mult: "e_mult",
  apply_hyper_chips: "hyperchips_n",
  apply_hyper_mult: "hypermult_n",
};

export const getVariableDisplayValue = (variable: UserVariable): string => {
  if (variable.type === "suit") return variable.initialSuit ?? "Spades";
  if (variable.type === "rank") return variable.initialRank ?? "Ace";
  if (variable.type === "key") return variable.initialKey ?? "none";
  if (variable.type === "text") return variable.initialText ?? "";
  if (variable.type === "pokerhand") {
    return variable.initialPokerHand ?? "High Card";
  }
  return String(variable.initialValue ?? 0);
};

const getAbilityPath = (objectType: string | undefined): string => {
  if (objectType === "edition") return "card.edition.extra";
  if (objectType === "seal") return "card.ability.seal.extra";
  if (objectType === "deck") return "self.config.extra";
  return "card.ability.extra";
};

const getParameterDisplayValue = (
  parameter: ParameterValue | undefined,
  userVariables: UserVariable[],
  defaultValue: number,
): string => {
  const value = parameter?.value;
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return String(defaultValue);

  const variable = userVariables.find((entry) => entry.name === value);
  if (variable) return getVariableDisplayValue(variable);

  if (value.startsWith("GAMEVAR:")) {
    const id = value.slice("GAMEVAR:".length).split("|")[0];
    return GAME_VARIABLE_LABELS.get(id) ?? id;
  }
  return value;
};

const getProbabilityDisplayValue = (
  parameter: ParameterValue | undefined,
  defaultValue: number,
): string => {
  const value = parameter?.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  // The compiler's ParamValue::as_i64 accepts numeric strings only in typed
  // parameters. Dynamic chance inputs currently use the compiler defaults.
  if (parameter?.valueType && typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) {
    return String(Number(value));
  }
  return String(defaultValue);
};

const forEachRuleEffect = (
  rules: Rule[] | undefined,
  cb: (effectType: string, effect?: Effect, group?: RandomGroup) => void,
) => {
  if (!Array.isArray(rules)) return;

  for (const rule of rules) {
    for (const effect of rule.effects || []) {
      cb(effect.type, effect);
    }
    for (const group of rule.randomGroups || []) {
      cb("random_group_odds", undefined, group);
      for (const effect of group.effects || []) {
        cb(effect.type, effect);
      }
    }
    for (const loop of rule.loops || []) {
      for (const effect of loop.effects || []) {
        cb(effect.type, effect);
      }
    }
  }
};

const readEffectParamString = (effect: Effect | undefined, key: string): string => {
  if (!effect?.params) return "";
  const payload = effect.params[key];
  if (!payload) return "";
  const value = payload.value;
  return typeof value === "string" ? value.trim() : "";
};

const dynamicConfigBaseForEffect = (effect: Effect | undefined): string | null => {
  if (!effect) return null;

  if (effect.type === "modify_internal_variable") {
    const variableName =
      readEffectParamString(effect, "variable_name") ||
      readEffectParamString(effect, "variableName") ||
      readEffectParamString(effect, "variable");
    if (!variableName) return null;
    return `var_${variableName}`;
  }

  return null;
};

const inferConfigVariables = (
  item: DescriptionVariableItem,
  userVariables = item.userVariables ?? [],
): DescriptionVariableToken[] => {
  const counts = new Map<string, number>();
  const tokens: DescriptionVariableToken[] = [];
  const abilityPath = getAbilityPath(item.objectType);
  const probabilityGroupCount = (item.rules ?? []).reduce(
    (total, rule) => total + (rule.randomGroups?.length ?? 0),
    0,
  );

  const nextName = (base: string) => {
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return { name: `${base}${count}`, count };
  };

  forEachRuleEffect(item.rules, (effectType, effect, group) => {
    if (group) {
      for (const part of ["numerator", "denominator"] as const) {
        const { name, count } = nextName(`probability_${part}`);
        const groupSuffix = probabilityGroupCount > 1 ? ` ${count + 1}` : "";
        tokens.push({
          label: `Chance${groupSuffix} ${part}`,
          source: `${abilityPath}.${name}`,
          category: "probability",
          binding: { kind: "probability", group_id: group.id, part },
          previewValue: getProbabilityDisplayValue(
            group[`chance_${part}`],
            part === "numerator" ? 1 : 2,
          ),
        });
      }
      return;
    }
    const base =
      dynamicConfigBaseForEffect(effect) ?? CONFIG_VAR_BASES_BY_EFFECT[effectType];
    if (!base || !effect) return;

    const { name, count } = nextName(base);
    const compilerBase = CONFIG_VAR_COMPILER_BASES_BY_EFFECT[effectType] ?? base;
    const parameter = effect.params?.value;
    const isScoring = [
      "add_chips", "add_mult", "apply_x_mult", "apply_x_chips",
      "apply_exp_chips", "apply_exp_mult",
    ].includes(effectType);
    const defaultValue = isScoring ? 0 : 1;
    const fallback = parameter?.valueType
      ? { value: parameter.value, valueType: parameter.valueType }
      : typeof parameter?.value === "number" || typeof parameter?.value === "string"
        ? parameter.value
        : defaultValue;
    tokens.push({
      label: name,
      source: `${abilityPath}.${name}`,
      category: "config",
      binding: {
        kind: "config",
        name: `${compilerBase}${count}`,
        effect_id: effect.id,
        fallback,
      },
      previewValue: getParameterDisplayValue(parameter, userVariables, defaultValue),
    });
  });

  return tokens;
};

type GameVariableReference = {
  id: string;
  multiplier: number;
  startsFrom: number;
};

const extractGameVariableReferences = (
  rules: Rule[] | undefined,
): { existingIds: string[]; references: GameVariableReference[] } => {
  if (!Array.isArray(rules)) return { existingIds: [], references: [] };

  const existingIds = new Set<string>();
  const references = new Map<string, GameVariableReference>();
  const ingest = (
    params?: Record<string, ParameterValue | string>,
  ) => {
    if (!params) return;
    for (const payload of Object.values(params)) {
      if (!payload) continue;
      const value = typeof payload === "string" ? payload : payload.value;
      const valueType = typeof payload === "string" ? undefined : payload.valueType;
      if (typeof value !== "string") continue;

      const encoded = value.startsWith("GAMEVAR:");
      if (!encoded && valueType !== "gameVariable" && valueType !== "game_var") continue;

      const parts = encoded ? value.slice("GAMEVAR:".length).split("|") : [value];
      const [id] = parts;
      const multiplier = encoded ? Number(parts[1]) : 1;
      const startsFrom = encoded ? Number(parts[2]) : 0;
      if (
        !id || (encoded && (parts.length !== 3 || !parts[1] || !parts[2])) ||
        !Number.isFinite(multiplier) || !Number.isFinite(startsFrom)
      ) continue;

      if ((encoded && typeof payload !== "string") || valueType === "gameVariable") existingIds.add(id);
      references.set(`${id}|${multiplier}|${startsFrom}`, { id, multiplier, startsFrom });
    }
  };

  for (const rule of rules) {
    for (const group of rule.conditionGroups || []) {
      for (const condition of group.conditions || []) {
        ingest(condition.params);
      }
    }
    for (const effect of rule.effects || []) {
      ingest(effect.params);
    }
    for (const randomGroup of rule.randomGroups || []) {
      ingest({
        chance_numerator: randomGroup.chance_numerator,
        chance_denominator: randomGroup.chance_denominator,
      });
      for (const effect of randomGroup.effects || []) {
        ingest(effect.params);
      }
    }
    for (const loop of rule.loops || []) {
      ingest({ repetitions: loop.repetitions });
      for (const effect of loop.effects || []) {
        ingest(effect.params);
      }
    }
  }

  return { existingIds: Array.from(existingIds), references: Array.from(references.values()) };
};

export const buildDescriptionVariableTokens = (
  item: DescriptionVariableItem | undefined,
  globalVariables: UserVariable[] = [],
): DescriptionVariableToken[] => {
  if (!item) return [];

  if (item.objectType === "booster") {
    // Steamodded reserves these two slots for a pack's choices and size.
    return [
      { name: "Cards to choose", key: "choose", value: item.config?.choose ?? 1 },
      { name: "Cards in pack", key: "extra", value: item.config?.extra ?? 3 },
    ].map(({ name, key, value }) => ({
      label: name,
      source: `card.ability.${key}`,
      category: "config" as const,
      binding: { kind: "literal" as const, value },
      previewValue: String(value),
    }));
  }

  const tokens: DescriptionVariableToken[] = [];
  const seen = new Set<string>();
  const push = (token: DescriptionVariableToken, identity = token.source) => {
    if (seen.has(identity)) return;
    seen.add(identity);
    tokens.push(token);
  };

  const abilityPath = getAbilityPath(item.objectType);
  const localVariables = Array.isArray(item.userVariables) ? item.userVariables : [];
  const variableNames = new Set(localVariables.map((variable) => variable.name.trim().toLowerCase()));
  const foreignGlobals: UserVariable[] = [];
  for (const variable of globalVariables) {
    if (!variable.isGlobal || !variable.name?.trim()) continue;
    const name = variable.name.trim().toLowerCase();
    if (variableNames.has(name)) continue;
    variableNames.add(name);
    foreignGlobals.push(variable);
  }

  const pushUserVariable = (userVar: UserVariable, foreign = false) => {
    const source = userVar.isGlobal
      ? `${userVar.isPersistent ? "JF_GLOBALS" : "G.GAME.jf_global_vars"}.${userVar.name}`
      : `${abilityPath}.${userVar.name}`;
    push({
      label: userVar.name,
      source,
      category: "user",
      binding: { kind: "user", name: userVar.name },
      previewValue: getVariableDisplayValue(userVar),
    }, foreign ? source : `${abilityPath}.${userVar.name}`);
  };

  if (Array.isArray(item.locVars?.vars) && item.locVars.vars.length > 0) {
    for (const value of item.locVars.vars) {
      tokens.push({
        label: String(value),
        source: String(value),
        category: "loc",
        binding: { kind: "literal", value },
        previewValue: String(value),
      });
    }
    for (const variable of [...localVariables.filter((entry) => entry.isGlobal), ...foreignGlobals]) {
      pushUserVariable(variable, true);
    }
    return tokens;
  }

  for (const userVar of localVariables) {
    pushUserVariable(userVar);
  }

  for (const token of inferConfigVariables(item, [...localVariables, ...foreignGlobals])) {
    push(token);
  }

  const { existingIds, references: gameReferences } = extractGameVariableReferences(item.rules);
  for (const gameVarId of new Set([
    ...existingIds,
    ...gameReferences.map((reference) => reference.id),
  ])) {
    const label = GAME_VARIABLE_LABELS.get(gameVarId) || gameVarId;
    const source = `GAMEVAR:${gameVarId}`;
    push({
      label,
      source,
      category: "game",
      binding: { kind: "game", id: gameVarId },
      previewValue: label,
    });
  }

  for (const { id, multiplier, startsFrom } of gameReferences) {
    if (multiplier === 1 && startsFrom === 0) continue;
    const variableLabel = GAME_VARIABLE_LABELS.get(id) || id;
    const scaledLabel = multiplier === 1 ? variableLabel : `${multiplier} × ${variableLabel}`;
    const label = startsFrom === 0 ? scaledLabel : `${startsFrom} + (${scaledLabel})`;
    push({
      label,
      source: `GAMEVAR:${id}|${multiplier}|${startsFrom}`,
      category: "game",
      binding: { kind: "game", id, multiplier, startsFrom },
      previewValue: label,
    });
  }

  for (const variable of foreignGlobals) {
    pushUserVariable(variable, true);
  }

  return tokens;
};
