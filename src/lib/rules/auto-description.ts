import type { Rule, Effect, Condition } from "@/components/rule-builder/types";
import { applyAutoFormatting } from "@/lib/balatro/balatro-text-formatter";
import {
  getConditionTypeById,
  getEffectTypeById,
  getTriggerById,
} from "@/components/rule-builder/rule-catalog";

type ItemType =
  | "joker"
  | "consumable"
  | "voucher"
  | "deck"
  | "enhancement"
  | "edition"
  | "seal"
  | "card";

const DEFAULT_DESCRIPTION_PLACEHOLDERS = new Set([
  "effect",
  "effect description",
  "deck description",
  "description",
  "new effect",
]);
const DEFAULT_TRIGGER_IDS = new Set(["hand_played", "card_used"]);
const MAX_VISIBLE_CHARS_PER_LINE = 52;
type StatKind = "mult" | "chips" | "money" | "generic";

const normalizeItemType = (itemType: ItemType): "joker" | "consumable" | "voucher" | "deck" | "card" => {
  if (itemType === "enhancement" || itemType === "edition" || itemType === "seal") {
    return "card";
  }
  return itemType;
};

const normalizeDescription = (value: string): string => {
  return value
    .replace(/\[s\]/g, " ")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const asScalar = (input: unknown): unknown => {
  if (input && typeof input === "object" && "value" in (input as Record<string, unknown>)) {
    return (input as { value: unknown }).value;
  }
  return input;
};

const getParamValue = (effect: Effect, ...keys: string[]): unknown => {
  for (const key of keys) {
    const raw = effect.params?.[key];
    if (!raw) continue;
    return asScalar(raw);
  }
  return undefined;
};
const getConditionValue = (condition: Condition, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (!condition.params?.[key]) continue;
    return asScalar(condition.params[key]);
  }
  return undefined;
};

const stripFormatting = (value: string): string =>
  value.replace(/\{[^}]*\}/g, "").replace(/\[s\]/g, " ");

const renderToken = (
  value: unknown,
  tokenMap: Map<string, number>,
  wrapped = true,
  fallbackToRaw = true,
): string => {
  const scalar = asScalar(value);
  if (scalar === undefined || scalar === null) {
    return fallbackToRaw ? "{C:attention}?{}" : "";
  }

  const key = JSON.stringify(scalar);
  let idx = tokenMap.get(key);
  if (!idx) {
    idx = tokenMap.size + 1;
    tokenMap.set(key, idx);
  }
  return wrapped ? `{C:attention}#${idx}#{}` : `#${idx}#`;
};

const cleanWhenPrefix = (value: string): string => {
  return value.trim().replace(/^when\s+/i, "");
};

const conditionByType = (rule: Rule, type: string): Condition | undefined =>
  (rule.conditionGroups || [])
    .flatMap((g) => g.conditions || [])
    .find((c) => c.type === type);

const ruleEffects = (rule: Rule): Effect[] => [
  ...(rule.effects || []),
  ...(rule.randomGroups || []).flatMap((g) => g.effects || []),
  ...(rule.loops || []).flatMap((g) => g.effects || []),
];

const ruleNeedsRoomSuffix = (rule: Rule): boolean => {
  return ruleEffects(rule).some((effect) =>
    [
      "create_consumable",
      "create_joker",
      "create_playing_card",
      "create_playing_cards",
      "copy_consumable",
      "create_tag",
    ].includes(effect.type),
  );
};

const effectPhrase = (effect: Effect, tokenMap: Map<string, number>): string => {
  const value = getParamValue(effect, "value", "amount");
  const selectionMethod = String(getParamValue(effect, "selection_method") ?? "");
  const toText = (sel: string): string => {
    if (sel === "right") return "to the right";
    if (sel === "left") return "to the left";
    if (sel === "first") return "at position {C:attention}1{}";
    if (sel === "last") return "at the end";
    return "";
  };
  switch (effect.type) {
    case "add_chips":
      return `{C:chips}+${renderToken(value, tokenMap, false)} Chips{}`;
    case "add_mult":
      return `{C:mult}+${renderToken(value, tokenMap, false)} Mult{}`;
    case "apply_x_mult":
      return `{X:mult,C:white} X${renderToken(value, tokenMap, false)} {} Mult`;
    case "apply_x_chips":
      return `{X:chips,C:white} X${renderToken(value, tokenMap, false)} {} Chips`;
    case "set_dollars":
    case "add_dollars":
      return `{C:money}$${renderToken(value, tokenMap, false)}{}`;
    case "draw_cards":
      return `draw ${renderToken(value, tokenMap)} card(s)`;
    case "retrigger":
      return `retrigger ${renderToken(value, tokenMap)} time(s)`;
    case "destroy_joker":
      return `destroy Joker ${toText(selectionMethod)}`.trim();
    case "destroy_playing_card":
      return "destroy it";
    case "destroy_cards":
      return "destroy selected/triggered card(s)";
    case "create_consumable": {
      const set = String(getParamValue(effect, "set") ?? "").toLowerCase();
      if (set.includes("spectral")) return "create a {C:spectral}Spectral{} card";
      if (set.includes("tarot")) return "create a {C:tarot}Tarot{} card";
      if (set.includes("planet")) return "create a {C:planet}Planet{} card";
      return "create a consumable card";
    }
    case "set_sell_value":
      return `permanently add ${renderToken(value, tokenMap)} to this Joker's sell value`;
    case "modify_internal_variable": {
      const variable = String(
        getParamValue(effect, "variable_name", "variableName", "variable") ?? "",
      );
      const op = String(getParamValue(effect, "operation") ?? "").toLowerCase();
      const magnitude = renderToken(value, tokenMap);
      if (op === "increment") return `increase {C:attention}${variable}{} by ${magnitude}`;
      if (op === "decrement") return `decrease {C:attention}${variable}{} by ${magnitude}`;
      if (op === "set") return `set {C:attention}${variable}{} to ${magnitude}`;
      return `modify {C:attention}${variable}{}`;
    }
    default: {
      const def = getEffectTypeById(effect.type);
      const fallback = def?.label || effect.type.replace(/_/g, " ");
      return fallback.charAt(0).toLowerCase() + fallback.slice(1);
    }
  }
};

const conditionPhrase = (
  condition: Condition,
  tokenMap: Map<string, number>,
): string => {
  const p = (key: string) => asScalar(condition.params?.[key]);
  const value = p("value");
  const operator = String(p("operator") ?? "");
  const cardScope = String(p("card_scope") ?? "");

  if (condition.type === "hand_type") {
    const hand = typeof value === "string" ? value : renderToken(value, tokenMap);
    const scope = cardScope === "all_played" ? "played hand" : "scoring hand";
    const op = operator === "equals" ? "is" : "contains";
    return `${scope} ${op} a {C:attention}${hand}{}`;
  }
  if (condition.type === "first_played_hand") {
    return "{C:attention}first hand{} of round";
  }
  if (condition.type === "card_rank") {
    const rank = String(
      getConditionValue(condition, "value", "rank", "specific_rank") ?? "",
    );
    const pos = String(getConditionValue(condition, "position") ?? "");
    if (rank) {
      if (pos === "single") return `a single {C:attention}${rank}{}`;
      return `played/scored card is {C:attention}${rank}{}`;
    }
    return "played/scored card matches the chosen rank";
  }
  if (condition.type === "hand_count") {
    const amount = renderToken(value, tokenMap);
    if (operator === "equals") {
      return `${cardScope === "all_played" ? "played hand" : "scoring hand"} contains exactly ${amount} card(s)`;
    }
    return `${cardScope === "all_played" ? "played hand" : "scoring hand"} card count is ${operator.replace(/_/g, " ")} ${amount}`;
  }
  if (condition.type === "suit_count") {
    const suit = String(p("suit") ?? p("suit_value") ?? p("suit_type") ?? "");
    const amount = renderToken(value, tokenMap);
    return `${cardScope === "all_played" ? "played hand" : "scoring hand"} has ${operator.replace(/_/g, " ")} ${amount} {C:attention}${suit}{} card(s)`;
  }
  if (condition.type === "rank_count") {
    const rank = String(
      p("specific_rank") ?? p("rank") ?? p("rank_group") ?? p("rank_type") ?? "",
    );
    const amount = renderToken(p("count") ?? value, tokenMap);
    return `${cardScope === "all_played" ? "played hand" : "scoring hand"} has ${operator.replace(/_/g, " ")} ${amount} {C:attention}${rank}{} card(s)`;
  }

  const def = getConditionTypeById(condition.type);
  const base = (def?.label || condition.type.replace(/_/g, " ")).toLowerCase();
  const paramTokens: string[] = [];
  for (const payload of Object.values(condition.params || {})) {
    const raw = asScalar(payload);
    if (typeof raw === "number") {
      paramTokens.push(renderToken(raw, tokenMap));
      continue;
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      if (raw.startsWith("GAMEVAR:") || raw.startsWith("RANGE:")) {
        paramTokens.push(renderToken(raw, tokenMap, true));
      } else if (!["true", "false", "all", "any", "none"].includes(raw.toLowerCase())) {
        paramTokens.push(`{C:attention}${raw}{}`);
      }
    }
  }
  const suffix = paramTokens.length > 0 ? ` (${paramTokens.join(", ")})` : "";
  const phrase = `${condition.negate ? "not " : ""}${base}${suffix}`;
  return cleanWhenPrefix(phrase);
};

const triggerPhrase = (triggerId: string, itemType: ItemType): string => {
  const normalized = normalizeItemType(itemType);
  const label = getTriggerById(triggerId)?.label?.[normalized]?.toLowerCase();
  const raw = label || triggerId.replace(/_/g, " ").toLowerCase();
  const cleaned = cleanWhenPrefix(raw);
  switch (triggerId) {
    case "joker_evaluated":
    case "joker_triggered":
      return "this Joker triggers";
    case "card_scored":
      return "a card is scored";
    case "card_discarded":
      return "a card is discarded";
    case "before_hand_played":
      return "a hand is about to be played";
    case "after_hand_played":
      return "a hand is played";
    case "first_hand_drawn":
      return "first hand of round is drawn";
    case "hand_discarded":
      return "a hand is discarded";
    case "blind_selected":
      return "{C:attention}Blind{} is selected";
    case "round_end":
      return "round ends";
    case "consumable_used":
      return "a consumable is used";
    default:
      return cleaned;
  }
};

const composeTemplateSentence = (
  rule: Rule,
  tokenMap: Map<string, number>,
): string | null => {
  const effects = ruleEffects(rule);
  const effectsSet = new Set(effects.map((e) => e.type));
  const condSet = new Set(
    (rule.conditionGroups || []).flatMap((g) => g.conditions || []).map((c) => c.type),
  );

  const cond = (type: string) => conditionByType(rule, type);
  const effect = (type: string) => effects.find((e) => e.type === type);
  const renderStatGain = (kind: "mult" | "chips" | "money", amount: unknown): string => {
    const token = renderToken(amount, tokenMap, false);
    if (kind === "mult") return `{C:mult}+${token} Mult{}`;
    if (kind === "chips") return `{C:chips}+${token} Chips{}`;
    return `{C:money}$${token}{}`;
  };
  const createConsumablePhrase = (): string => {
    const create = effect("create_consumable");
    return create ? effectPhrase(create, tokenMap) : "create a consumable card";
  };

  // trigger + condition + effect (high-value triples)
  if (
    rule.trigger === "card_scored" &&
    condSet.has("first_played_hand") &&
    condSet.has("card_rank") &&
    (effectsSet.has("destroy_playing_card") || effectsSet.has("destroy_cards")) &&
    effectsSet.has("create_consumable")
  ) {
    const rank = String(
      getConditionValue(cond("card_rank") as Condition, "value", "rank", "specific_rank") || "",
    );
    return `If {C:attention}first hand{} of round is a single {C:attention}${rank}{}, destroy it and create a {C:spectral}Spectral{} card`;
  }
  if (
    rule.trigger === "blind_selected" &&
    condSet.has("has_joker_right") &&
    effectsSet.has("destroy_joker") &&
    effectsSet.has("set_sell_value")
  ) {
    return "When {C:attention}Blind{} is selected, destroy Joker to the right and permanently add {C:attention}double{} its sell value to this {C:mult}Mult{}";
  }
  if (
    rule.trigger === "hand_played" &&
    condSet.has("first_played_hand") &&
    condSet.has("hand_count") &&
    condSet.has("card_rank") &&
    effectsSet.has("destroy_playing_card") &&
    effectsSet.has("create_consumable")
  ) {
    const rank = String(
      getConditionValue(cond("card_rank") as Condition, "value", "rank", "specific_rank") || "",
    );
    return `If {C:attention}first hand{} of round is a single {C:attention}${rank}{}, destroy it and ${createConsumablePhrase()}`;
  }
  if (
    (rule.trigger === "hand_played" || rule.trigger === "card_scored") &&
    condSet.has("hand_type") &&
    effectsSet.has("add_chips") &&
    effectsSet.has("add_mult")
  ) {
    const hand = String(getConditionValue(cond("hand_type") as Condition, "value") || "");
    return `If played hand contains a {C:attention}${hand}{}, gain ${renderStatGain("chips", getParamValue(effect("add_chips") as Effect, "value", "amount"))} and ${renderStatGain("mult", getParamValue(effect("add_mult") as Effect, "value", "amount"))}`;
  }
  if (
    rule.trigger === "card_discarded" &&
    condSet.has("first_played_hand") &&
    effectsSet.has("draw_cards")
  ) {
    return `If {C:attention}first hand{} of round, draw ${renderToken(getParamValue(effect("draw_cards") as Effect, "value", "amount"), tokenMap)} card(s) when a card is discarded`;
  }

  // trigger + effect pairs
  if (rule.trigger === "blind_selected" && effectsSet.has("destroy_joker") && effectsSet.has("add_mult")) {
    const destroySel = String(getParamValue(effect("destroy_joker") as Effect, "selection_method") || "right");
    const pos = destroySel === "left" ? "to the left" : "to the right";
    return `When {C:attention}Blind{} is selected, destroy Joker ${pos} and gain {C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{}`;
  }
  if (rule.trigger === "card_scored" && effectsSet.has("add_mult")) {
    return `When a card is scored, gain {C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{}`;
  }
  if (rule.trigger === "card_scored" && effectsSet.has("add_chips")) {
    return `When a card is scored, gain {C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{}`;
  }
  if (rule.trigger === "card_discarded" && effectsSet.has("draw_cards")) {
    return `When a card is discarded, draw ${renderToken(getParamValue(effect("draw_cards") as Effect, "value", "amount"), tokenMap)} card(s)`;
  }
  if (rule.trigger === "round_end" && effectsSet.has("add_dollars")) {
    return `At end of round, gain {C:money}$${renderToken(getParamValue(effect("add_dollars") as Effect, "value", "amount"), tokenMap, false)}{}`;
  }
  if (rule.trigger === "consumable_used" && effectsSet.has("create_consumable")) {
    return `When a consumable is used, ${effectPhrase(effect("create_consumable") as Effect, tokenMap)}`;
  }
  if (rule.trigger === "hand_played" && effectsSet.has("add_mult")) {
    return `${renderStatGain("mult", getParamValue(effect("add_mult") as Effect, "value", "amount"))} when hand is played`;
  }
  if (rule.trigger === "hand_played" && effectsSet.has("add_chips")) {
    return `${renderStatGain("chips", getParamValue(effect("add_chips") as Effect, "value", "amount"))} when hand is played`;
  }
  if (rule.trigger === "card_scored" && effectsSet.has("set_dollars")) {
    return `When a card is scored, gain ${renderStatGain("money", getParamValue(effect("set_dollars") as Effect, "value", "amount"))}`;
  }
  if (rule.trigger === "before_hand_played" && effectsSet.has("retrigger")) {
    return `Before a hand is played, retrigger ${renderToken(getParamValue(effect("retrigger") as Effect, "value", "amount"), tokenMap)} time(s)`;
  }
  if (rule.trigger === "after_hand_played" && effectsSet.has("draw_cards")) {
    return `After a hand is played, draw ${renderToken(getParamValue(effect("draw_cards") as Effect, "value", "amount"), tokenMap)} card(s)`;
  }
  if (rule.trigger === "first_hand_drawn" && effectsSet.has("add_mult")) {
    return `When first hand of round is drawn, gain ${renderStatGain("mult", getParamValue(effect("add_mult") as Effect, "value", "amount"))}`;
  }
  if (rule.trigger === "round_end" && effectsSet.has("set_dollars")) {
    return `At end of round, gain ${renderStatGain("money", getParamValue(effect("set_dollars") as Effect, "value", "amount"))}`;
  }
  if (rule.trigger === "joker_evaluated" && effectsSet.has("apply_x_mult")) {
    return `When this Joker triggers, ${effectPhrase(effect("apply_x_mult") as Effect, tokenMap)}`;
  }
  if (rule.trigger === "card_used" && effectsSet.has("create_consumable")) {
    return `When a card is used, ${createConsumablePhrase()}`;
  }
  if (rule.trigger === "hand_discarded" && effectsSet.has("add_chips")) {
    return `When a hand is discarded, gain ${renderStatGain("chips", getParamValue(effect("add_chips") as Effect, "value", "amount"))}`;
  }

  // trigger + condition pairs
  if (rule.trigger === "hand_played" && condSet.has("hand_type")) {
    const c = cond("hand_type") as Condition;
    const hand = String(getConditionValue(c, "value") || "");
    const op = String(getConditionValue(c, "operator") || "contains");
    const scope = String(getConditionValue(c, "card_scope") || "scoring");
    const prefix = scope === "all_played" ? "played hand" : "scoring hand";
    const verb = op === "equals" ? "is" : "contains";
    return `If ${prefix} ${verb} a {C:attention}${hand}{}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "card_scored" && condSet.has("card_rank")) {
    const c = cond("card_rank") as Condition;
    const rank = String(getConditionValue(c, "value", "rank", "specific_rank") || "");
    return `If scored card is {C:attention}${rank}{}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "card_scored" && condSet.has("suit_count")) {
    return `If ${conditionPhrase(cond("suit_count") as Condition, tokenMap)}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "joker_evaluated" && condSet.has("first_played_hand")) {
    return `If {C:attention}first hand{} of round, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "hand_played" && condSet.has("first_played_hand")) {
    return `If {C:attention}first hand{} of round, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "card_scored" && condSet.has("first_played_hand")) {
    return `If {C:attention}first hand{} of round and a card is scored, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "hand_played" && condSet.has("hand_count")) {
    return `If ${conditionPhrase(cond("hand_count") as Condition, tokenMap)}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "hand_played" && condSet.has("suit_count")) {
    return `If ${conditionPhrase(cond("suit_count") as Condition, tokenMap)}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "hand_played" && condSet.has("rank_count")) {
    return `If ${conditionPhrase(cond("rank_count") as Condition, tokenMap)}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "card_scored" && condSet.has("card_suit")) {
    return `If ${conditionPhrase(cond("card_suit") as Condition, tokenMap)}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "card_scored" && condSet.has("card_enhancement")) {
    return `If ${conditionPhrase(cond("card_enhancement") as Condition, tokenMap)}, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }
  if (rule.trigger === "blind_selected" && condSet.has("has_joker_right")) {
    return `When {C:attention}Blind{} is selected, if Joker to the right exists, ${effects.map((e) => effectPhrase(e, tokenMap)).join(" and ")}`;
  }

  // condition + effect pairs
  if (condSet.has("hand_type") && effectsSet.has("add_mult")) {
    const c = cond("hand_type") as Condition;
    const hand = String(getConditionValue(c, "value") || "");
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if played hand contains a {C:attention}${hand}{}`;
  }
  if (condSet.has("hand_type") && effectsSet.has("add_chips")) {
    const c = cond("hand_type") as Condition;
    const hand = String(getConditionValue(c, "value") || "");
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if played hand contains a {C:attention}${hand}{}`;
  }
  if (condSet.has("first_played_hand") && effectsSet.has("create_consumable")) {
    return `If {C:attention}first hand{} of round, ${effectPhrase(effect("create_consumable") as Effect, tokenMap)}`;
  }
  if (condSet.has("player_money") && effectsSet.has("add_mult")) {
    return `If ${conditionPhrase(cond("player_money") as Condition, tokenMap)}, gain {C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{}`;
  }
  if (condSet.has("player_money") && effectsSet.has("add_chips")) {
    return `If ${conditionPhrase(cond("player_money") as Condition, tokenMap)}, gain {C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{}`;
  }
  if (condSet.has("first_played_hand") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if {C:attention}first hand{} of round`;
  }
  if (condSet.has("first_played_hand") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if {C:attention}first hand{} of round`;
  }
  if (condSet.has("card_rank") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if ${conditionPhrase(cond("card_rank") as Condition, tokenMap)}`;
  }
  if (condSet.has("card_rank") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if ${conditionPhrase(cond("card_rank") as Condition, tokenMap)}`;
  }
  if (condSet.has("hand_count") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if ${conditionPhrase(cond("hand_count") as Condition, tokenMap)}`;
  }
  if (condSet.has("hand_count") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if ${conditionPhrase(cond("hand_count") as Condition, tokenMap)}`;
  }
  if (condSet.has("suit_count") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if ${conditionPhrase(cond("suit_count") as Condition, tokenMap)}`;
  }
  if (condSet.has("suit_count") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if ${conditionPhrase(cond("suit_count") as Condition, tokenMap)}`;
  }
  if (condSet.has("rank_count") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if ${conditionPhrase(cond("rank_count") as Condition, tokenMap)}`;
  }
  if (condSet.has("rank_count") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if ${conditionPhrase(cond("rank_count") as Condition, tokenMap)}`;
  }
  if (condSet.has("card_suit") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if ${conditionPhrase(cond("card_suit") as Condition, tokenMap)}`;
  }
  if (condSet.has("card_suit") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if ${conditionPhrase(cond("card_suit") as Condition, tokenMap)}`;
  }
  if (condSet.has("card_enhancement") && effectsSet.has("add_mult")) {
    return `{C:mult}+${renderToken(getParamValue(effect("add_mult") as Effect, "value", "amount"), tokenMap, false)} Mult{} if ${conditionPhrase(cond("card_enhancement") as Condition, tokenMap)}`;
  }
  if (condSet.has("card_enhancement") && effectsSet.has("add_chips")) {
    return `{C:chips}+${renderToken(getParamValue(effect("add_chips") as Effect, "value", "amount"), tokenMap, false)} Chips{} if ${conditionPhrase(cond("card_enhancement") as Condition, tokenMap)}`;
  }

  return null;
};

const effectUsesVariable = (effect: Effect, variableName: string): boolean => {
  const values = Object.values(effect.params || {}).map((payload) => asScalar(payload));
  return values.some((raw) => typeof raw === "string" && raw === variableName);
};

const effectStatKind = (effectType: string): StatKind | null => {
  if (["add_mult", "apply_x_mult", "apply_exp_mult", "apply_hyper_mult"].includes(effectType)) {
    return "mult";
  }
  if (["add_chips", "apply_x_chips", "apply_exp_chips", "apply_hyper_chips"].includes(effectType)) {
    return "chips";
  }
  if (["set_dollars", "add_dollars", "blind_reward", "set_sell_value"].includes(effectType)) {
    return "money";
  }
  return null;
};

const statColor = (kind: StatKind): string => {
  if (kind === "mult") return "red";
  if (kind === "chips") return "blue";
  if (kind === "money") return "money";
  return "attention";
};

const statLabel = (kind: StatKind): string => {
  if (kind === "mult") return "Mult";
  if (kind === "chips") return "Chips";
  if (kind === "money") return "Dollars";
  return "Value";
};

const collectVariableStatusRows = (
  rules: Rule[],
  tokenMap: Map<string, number>,
): string[] => {
  const vars = new Map<string, { mutated: boolean; kinds: Set<StatKind> }>();
  for (const rule of rules) {
    const allEffects: Effect[] = [
      ...(rule.effects || []),
      ...(rule.randomGroups || []).flatMap((g) => g.effects || []),
      ...(rule.loops || []).flatMap((g) => g.effects || []),
    ];
    for (const effect of allEffects) {
      if (effect.type === "modify_internal_variable") {
        const varName = String(
          getParamValue(effect, "variable_name", "variableName", "variable") ?? "",
        );
        if (!varName) continue;
        const prev = vars.get(varName) ?? { mutated: false, kinds: new Set<StatKind>() };
        prev.mutated = true;
        vars.set(varName, prev);
      }
    }
    for (const [varName, record] of vars) {
      for (const effect of allEffects) {
        if (!effectUsesVariable(effect, varName)) continue;
        const kind = effectStatKind(effect.type);
        if (kind) record.kinds.add(kind);
      }
    }
  }

  const rows: string[] = [];
  for (const [varName, info] of vars) {
    if (!info.mutated || info.kinds.size === 0) continue;
    for (const kind of info.kinds) {
      const color = statColor(kind);
      const label = statLabel(kind);
      const token = renderToken(`VAR:${varName}:${kind}`, tokenMap, false);
      rows.push(`{C:inactive}(Currently{} {C:${color}}+${token}{} {C:inactive}${label}){}`);
    }
  }
  return rows;
};

const wrapLines = (text: string, maxVisibleChars = MAX_VISIBLE_CHARS_PER_LINE): string => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return text;

  let lineLen = 0;
  const out: string[] = [];
  for (const word of words) {
    const visible = stripFormatting(word).length;
    if (lineLen > 0 && lineLen + 1 + visible > maxVisibleChars) {
      out.push("[s]");
      out.push(word);
      lineLen = visible;
    } else {
      if (out.length > 0 && out[out.length - 1] !== "[s]") {
        out.push(" ");
        lineLen += 1;
      }
      out.push(word);
      lineLen += visible;
    }
  }
  return out.join("");
};

export const generateDescriptionFromRules = (
  rules: Rule[] | undefined,
  itemType: ItemType,
): string => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return "Effect description";
  }

  const tokenMap = new Map<string, number>();
  const lines = rules.map((rule) => {
    const templateLine = composeTemplateSentence(rule, tokenMap);
    const mustHaveRoom = ruleNeedsRoomSuffix(rule);
    if (templateLine) {
      return `${templateLine}${mustHaveRoom ? "[s]{C:inactive}(Must have room){}" : ""}`;
    }

    const phrases: string[] = [];
    for (const effect of rule.effects || []) phrases.push(effectPhrase(effect, tokenMap));
    for (const randomGroup of rule.randomGroups || []) {
      const odds = `${renderToken(randomGroup.chance_numerator, tokenMap)}/${renderToken(
        randomGroup.chance_denominator,
        tokenMap,
      )}`;
      for (const effect of randomGroup.effects || []) {
        phrases.push(`with ${odds} chance, ${effectPhrase(effect, tokenMap)}`);
      }
    }
    for (const loop of rule.loops || []) {
      const reps = renderToken(loop.repetitions, tokenMap);
      for (const effect of loop.effects || []) {
        phrases.push(`${effectPhrase(effect, tokenMap)} for ${reps} repetition(s)`);
      }
    }

    let clause = phrases.length > 0 ? phrases.join(", and ") : "apply an effect";
    const conditions = (rule.conditionGroups || [])
      .flatMap((group) => group.conditions || [])
      .map((condition) => conditionPhrase(condition, tokenMap))
      .filter(Boolean);
    const conditionSuffix = conditions.length > 0 ? ` if ${conditions.join(" and ")}` : "";

    const handTypeCond = conditionByType(rule, "hand_type");
    if (handTypeCond && conditions.length === 1 && phrases.length === 1) {
      return `${clause} if ${conditionPhrase(handTypeCond, tokenMap)}${mustHaveRoom ? "[s]{C:inactive}(Must have room){}" : ""}`;
    }

    const isDefaultTrigger = DEFAULT_TRIGGER_IDS.has(rule.trigger);
    if (isDefaultTrigger) {
      return `${clause}${conditionSuffix}${mustHaveRoom ? "[s]{C:inactive}(Must have room){}" : ""}`;
    }

    const trigger = triggerPhrase(rule.trigger, itemType);
    const simpleRule =
      phrases.length === 1 &&
      conditions.length <= 1 &&
      (rule.randomGroups?.length || 0) === 0 &&
      (rule.loops?.length || 0) === 0;
    if (simpleRule && conditionSuffix) {
      return `${clause}${conditionSuffix}${mustHaveRoom ? "[s]{C:inactive}(Must have room){}" : ""}`;
    }
    return `when ${trigger}, ${clause}${conditionSuffix}${mustHaveRoom ? "[s]{C:inactive}(Must have room){}" : ""}`;
  });

  const raw = lines
    .join("[s]")
    .replace(/\bwhen\s+when\b/gi, "when")
    .replace(/\s+/g, " ")
    .replace(/\s*\[s\]\s*/g, "[s]")
    .trim();
  const statusRows = collectVariableStatusRows(rules, tokenMap);
  const withStatus = statusRows.length > 0 ? `${raw}[s]${statusRows.join("[s]")}` : raw;
  const wrapped = wrapLines(withStatus);
  return applyAutoFormatting(wrapped, "", true).formatted;
};

export const shouldOverwriteDescriptionOnRuleSave = (
  currentDescription: string | undefined,
  previousRules: Rule[] | undefined,
  itemType: ItemType,
): boolean => {
  const normalizedCurrent = normalizeDescription(currentDescription || "");
  if (!normalizedCurrent) return true;
  if (DEFAULT_DESCRIPTION_PLACEHOLDERS.has(normalizedCurrent)) return true;

  const previousAuto = normalizeDescription(
    generateDescriptionFromRules(previousRules, itemType),
  );
  return !!previousAuto && normalizedCurrent === previousAuto;
};
