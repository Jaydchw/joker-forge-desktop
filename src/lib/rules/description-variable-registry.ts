import type { Effect, Rule } from "@/components/rule-builder/types";
import { GAME_VARIABLE_CATEGORIES } from "@/lib/content/game-vars";
import type { UserVariable } from "@/lib/core/types";

export type DescriptionVariableToken = {
  label: string;
  source: string;
  category: "loc" | "config" | "user" | "game" | "probability";
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

const forEachRuleEffect = (
  rules: Rule[] | undefined,
  cb: (effectType: string, effect?: Effect) => void,
) => {
  if (!Array.isArray(rules)) return;

    for (const rule of rules) {
      for (const effect of rule.effects || []) {
        cb(effect.type, effect);
      }
      for (const group of rule.randomGroups || []) {
        cb("random_group_odds");
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

const inferConfigExtraNames = (rules: Rule[] | undefined): string[] => {
  const counts = new Map<string, number>();
  const names: string[] = [];

  const pushName = (base: string) => {
    const count = counts.get(base) || 0;
    names.push(`${base}${count}`);
    counts.set(base, count + 1);
  };

  forEachRuleEffect(rules, (effectType, effect) => {
    if (effectType === "random_group_odds") {
      pushName("probability_numerator");
      pushName("probability_denominator");
      return;
    }
    const base =
      dynamicConfigBaseForEffect(effect) ?? CONFIG_VAR_BASES_BY_EFFECT[effectType];
    if (base) {
      pushName(base);
    }
  });

  return names;
};

const extractGameVariableIds = (rules: Rule[] | undefined): string[] => {
  if (!Array.isArray(rules)) return [];

  const ids = new Set<string>();
  const ingest = (
    params?: Record<string, { value: unknown; valueType?: string }>,
  ) => {
    if (!params) return;
    for (const payload of Object.values(params)) {
      if (!payload) continue;

      if (
        payload.valueType === "gameVariable" &&
        typeof payload.value === "string"
      ) {
        const direct = payload.value.replace(/^GAMEVAR:/, "").split("|")[0];
        if (direct) ids.add(direct);
      }

      if (
        typeof payload.value === "string" &&
        payload.value.startsWith("GAMEVAR:")
      ) {
        const parsed = payload.value.replace("GAMEVAR:", "").split("|")[0];
        if (parsed) ids.add(parsed);
      }
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

  return Array.from(ids);
};

export const buildDescriptionVariableTokens = (
  item:
    | {
        rules?: Rule[];
        userVariables?: UserVariable[];
        locVars?: { vars?: Array<string | number> };
      }
    | undefined,
): DescriptionVariableToken[] => {
  if (!item) return [];

  const tokens: DescriptionVariableToken[] = [];
  const seen = new Set<string>();
  const push = (token: DescriptionVariableToken) => {
    if (seen.has(token.source)) return;
    seen.add(token.source);
    tokens.push(token);
  };

  const locVars = Array.isArray(item.locVars?.vars)
    ? item.locVars?.vars.filter((entry) => entry !== undefined)
    : [];
  if (locVars.length > 0) {
    for (const value of locVars) {
      const source = String(value);
      push({ label: source, source, category: "loc" });
    }
  }

  for (const userVar of Array.isArray(item.userVariables)
    ? item.userVariables
    : []) {
    const source = `card.ability.extra.${userVar.name}`;
    push({ label: userVar.name, source, category: "user" });
  }

  for (const configName of inferConfigExtraNames(item.rules)) {
    const source = `card.ability.extra.${configName}`;
    push({
      label: configName,
      source,
      category: configName.startsWith("probability_") ? "probability" : "config",
    });
  }

  for (const gameVarId of extractGameVariableIds(item.rules)) {
    const label = GAME_VARIABLE_LABELS.get(gameVarId) || gameVarId;
    const source = `GAMEVAR:${gameVarId}`;
    push({ label, source, category: "game" });
  }

  return tokens;
};
