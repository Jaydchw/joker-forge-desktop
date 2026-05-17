import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import type { EditorState } from "@codemirror/state";

// Lua language keywords

const LUA_KEYWORDS: Completion[] = [
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
].map((kw) => ({ label: kw, type: "keyword" }));

const LUA_BUILTINS: Completion[] = [
  { label: "print", type: "function", detail: "(...) → void" },
  { label: "type", type: "function", detail: "(v) → string" },
  { label: "tostring", type: "function", detail: "(v) → string" },
  { label: "tonumber", type: "function", detail: "(v) → number?" },
  { label: "pairs", type: "function", detail: "(t) → iterator" },
  { label: "ipairs", type: "function", detail: "(t) → iterator" },
  { label: "next", type: "function", detail: "(t, k?) → k, v" },
  { label: "select", type: "function", detail: "(n, ...) → ..." },
  { label: "unpack", type: "function", detail: "(t) → ..." },
  { label: "rawget", type: "function", detail: "(t, k) → v" },
  { label: "rawset", type: "function", detail: "(t, k, v) → t" },
  { label: "setmetatable", type: "function", detail: "(t, mt) → t" },
  { label: "getmetatable", type: "function", detail: "(t) → mt" },
  { label: "error", type: "function", detail: "(msg, level?)" },
  { label: "pcall", type: "function", detail: "(f, ...) → ok, ..." },
  { label: "xpcall", type: "function", detail: "(f, eh, ...) → ok, ..." },
  { label: "assert", type: "function", detail: "(v, msg?) → v" },
  { label: "require", type: "function", detail: "(name) → module" },
  { label: "math.random", type: "function", detail: "(m?, n?) → number" },
  { label: "math.floor", type: "function", detail: "(x) → int" },
  { label: "math.ceil", type: "function", detail: "(x) → int" },
  { label: "math.abs", type: "function", detail: "(x) → number" },
  { label: "math.min", type: "function", detail: "(...) → number" },
  { label: "math.max", type: "function", detail: "(...) → number" },
  { label: "math.huge", type: "constant", detail: "infinity" },
  { label: "string.format", type: "function", detail: "(fmt, ...) → string" },
  { label: "string.sub", type: "function", detail: "(s, i, j?) → string" },
  { label: "string.find", type: "function", detail: "(s, pat) → i, j" },
  { label: "string.match", type: "function", detail: "(s, pat) → captures" },
  { label: "string.gsub", type: "function", detail: "(s, pat, repl) → string" },
  { label: "string.len", type: "function", detail: "(s) → number" },
  { label: "table.insert", type: "function", detail: "(t, [pos,] v)" },
  { label: "table.remove", type: "function", detail: "(t, pos?) → v" },
  { label: "table.sort", type: "function", detail: "(t, comp?)" },
  { label: "table.concat", type: "function", detail: "(t, sep?) → string" },
];

// SMODS API

const SMODS_TYPES: Completion[] = [
  {
    label: "SMODS.Joker",
    type: "class",
    detail: "Register a joker",
    info: "SMODS.Joker { key, loc_txt, config, ... }",
  },
  {
    label: "SMODS.Consumable",
    type: "class",
    detail: "Register a consumable",
    info: "SMODS.Consumable { key, set, loc_txt, ... }",
  },
  {
    label: "SMODS.ConsumableType",
    type: "class",
    detail: "Register consumable type",
  },
  {
    label: "SMODS.Enhancement",
    type: "class",
    detail: "Register an enhancement",
  },
  { label: "SMODS.Seal", type: "class", detail: "Register a seal" },
  { label: "SMODS.Edition", type: "class", detail: "Register an edition" },
  { label: "SMODS.Rarity", type: "class", detail: "Register a rarity" },
  { label: "SMODS.Voucher", type: "class", detail: "Register a voucher" },
  { label: "SMODS.Back", type: "class", detail: "Register a deck" },
  { label: "SMODS.Booster", type: "class", detail: "Register a booster pack" },
  { label: "SMODS.Sound", type: "class", detail: "Register a sound" },
  { label: "SMODS.Atlas", type: "class", detail: "Register a texture atlas" },
];

const SMODS_FUNCTIONS: Completion[] = [
  {
    label: "SMODS.add_card",
    type: "function",
    detail: "(t) → card",
    info: "Add card to the game (playing card, joker, etc)",
  },
  {
    label: "SMODS.create_card",
    type: "function",
    detail: "(t) → card",
    info: "Create a new card object",
  },
  {
    label: "SMODS.find_card",
    type: "function",
    detail: "(key) → cards",
    info: "Find cards by center key",
  },
  {
    label: "SMODS.destroy_cards",
    type: "function",
    detail: "(cards, context?)",
  },
  {
    label: "SMODS.draw_cards",
    type: "function",
    detail: "(n)",
    info: "Draw n cards from deck to hand",
  },
  {
    label: "SMODS.calculate_effect",
    type: "function",
    detail: "(effect, card)",
    info: "Apply a calculated effect",
  },
  {
    label: "SMODS.calculate_context",
    type: "function",
    detail: "(ctx)",
    info: "Trigger a context event",
  },
  {
    label: "SMODS.blueprint_effect",
    type: "function",
    detail: "(card)",
    info: "Get blueprint-compatible effect",
  },
  {
    label: "SMODS.change_base",
    type: "function",
    detail: "(card, suit?, rank?)",
    info: "Change card's base suit/rank",
  },
  { label: "SMODS.modify_rank", type: "function", detail: "(card, delta)" },
  { label: "SMODS.poll_seal", type: "function", detail: "(opts) → seal" },
  { label: "SMODS.change_booster_limit", type: "function", detail: "(delta)" },
  { label: "SMODS.change_discard_limit", type: "function", detail: "(delta)" },
  { label: "SMODS.change_play_limit", type: "function", detail: "(delta)" },
  { label: "SMODS.change_voucher_limit", type: "function", detail: "(delta)" },
  {
    label: "SMODS.get_probability_vars",
    type: "function",
    detail: "(num, den) → vars",
  },
  {
    label: "SMODS.pseudorandom_probability",
    type: "function",
    detail: "(seed, num, den) → bool",
  },
  { label: "SMODS.has_no_rank", type: "function", detail: "(card) → bool" },
  { label: "SMODS.has_no_suit", type: "function", detail: "(card) → bool" },
  { label: "SMODS.add_booster_to_shop", type: "function", detail: "(key?)" },
  { label: "SMODS.add_voucher_to_shop", type: "function", detail: "(key?)" },
  {
    label: "SMODS.current_mod",
    type: "variable",
    detail: "Current mod object",
  },
  {
    label: "SMODS.four_fingers",
    type: "variable",
    detail: "Four fingers hook",
  },
  { label: "SMODS.shortcut", type: "variable", detail: "Shortcut hook" },
  { label: "SMODS.showman", type: "variable", detail: "Showman hook" },
];

// Balatro game state (G.*)

const GAME_GLOBALS: Completion[] = [
  // G.GAME
  { label: "G.GAME.dollars", type: "variable", detail: "Player money" },
  {
    label: "G.GAME.round_resets.ante",
    type: "variable",
    detail: "Current ante",
  },
  {
    label: "G.GAME.current_round.hands_left",
    type: "variable",
    detail: "Hands remaining",
  },
  {
    label: "G.GAME.current_round.discards_left",
    type: "variable",
    detail: "Discards remaining",
  },
  {
    label: "G.GAME.current_round.reroll_cost",
    type: "variable",
    detail: "Shop reroll cost",
  },
  { label: "G.GAME.blind", type: "variable", detail: "Current blind info" },
  {
    label: "G.GAME.blind.chips",
    type: "variable",
    detail: "Blind chip requirement",
  },
  { label: "G.GAME.blind.boss", type: "variable", detail: "Is boss blind?" },
  {
    label: "G.GAME.blind.in_blind",
    type: "variable",
    detail: "Currently in blind?",
  },
  { label: "G.GAME.hands", type: "variable", detail: "Poker hand stats table" },
  { label: "G.GAME.interest_cap", type: "variable", detail: "Max interest" },
  {
    label: "G.GAME.interest_amount",
    type: "variable",
    detail: "Interest per $5",
  },
  {
    label: "G.GAME.discount_percent",
    type: "variable",
    detail: "Shop discount %",
  },
  { label: "G.GAME.modifiers", type: "variable", detail: "Game modifiers" },
  {
    label: "G.GAME.modifiers.money_per_hand",
    type: "variable",
    detail: "$ per hand remaining",
  },
  {
    label: "G.GAME.modifiers.money_per_discard",
    type: "variable",
    detail: "$ per discard remaining",
  },
  { label: "G.GAME.win_ante", type: "variable", detail: "Ante to win" },
  { label: "G.GAME.chips", type: "variable", detail: "Current scored chips" },
  {
    label: "G.GAME.last_hand_played",
    type: "variable",
    detail: "Last hand type",
  },
  {
    label: "G.GAME.joker_buffer",
    type: "variable",
    detail: "Joker buffer count",
  },

  // Areas
  { label: "G.hand.cards", type: "variable", detail: "Cards in hand" },
  { label: "G.jokers.cards", type: "variable", detail: "Joker cards" },
  {
    label: "G.jokers.config.card_limit",
    type: "variable",
    detail: "Joker slot limit",
  },
  {
    label: "G.consumeables.cards",
    type: "variable",
    detail: "Consumable cards",
  },
  { label: "G.deck.cards", type: "variable", detail: "Cards in deck" },
  { label: "G.play.cards", type: "variable", detail: "Cards in play area" },
  { label: "G.discard.cards", type: "variable", detail: "Cards in discard" },
  { label: "G.playing_cards", type: "variable", detail: "All playing cards" },

  // Lookups
  { label: "G.P_CENTERS", type: "variable", detail: "Card centers (by key)" },
  { label: "G.P_SEALS", type: "variable", detail: "Seals table" },
  { label: "G.P_TAGS", type: "variable", detail: "Tags table" },

  // Colours
  { label: "G.C.MONEY", type: "variable", detail: "Money colour" },
  { label: "G.C.CHIPS", type: "variable", detail: "Chips colour" },
  { label: "G.C.MULT", type: "variable", detail: "Mult colour" },
  { label: "G.C.RED", type: "variable", detail: "Red colour" },
  { label: "G.C.GREEN", type: "variable", detail: "Green colour" },
  { label: "G.C.BLUE", type: "variable", detail: "Blue colour" },
  { label: "G.C.FILTER", type: "variable", detail: "Filter colour" },

  // Other
  { label: "G.E_MANAGER", type: "variable", detail: "Event manager" },
  { label: "G.SETTINGS", type: "variable", detail: "Game settings" },
];

// Context object (passed to calculate callback)

const CONTEXT_PROPS: Completion[] = [
  {
    label: "context.blueprint",
    type: "property",
    detail: "Is blueprint copy?",
  },
  {
    label: "context.blueprint_card",
    type: "property",
    detail: "Blueprint source card",
  },
  {
    label: "context.card",
    type: "property",
    detail: "The card being evaluated",
  },
  {
    label: "context.card_effects",
    type: "property",
    detail: "Card effects table",
  },
  {
    label: "context.scoring_hand",
    type: "property",
    detail: "Scored cards array",
  },
  { label: "context.scoring_name", type: "property", detail: "Hand type name" },
  { label: "context.full_hand", type: "property", detail: "All played cards" },
  {
    label: "context.individual",
    type: "property",
    detail: "Individual card eval?",
  },
  {
    label: "context.other_card",
    type: "property",
    detail: "Other triggered card",
  },
  {
    label: "context.other_joker",
    type: "property",
    detail: "Other triggered joker",
  },
  {
    label: "context.poker_hands",
    type: "property",
    detail: "Detected poker hands",
  },
  {
    label: "context.first_hand_drawn",
    type: "property",
    detail: "First hand of round?",
  },
  {
    label: "context.using_consumeable",
    type: "property",
    detail: "Using consumable?",
  },
  {
    label: "context.probability",
    type: "property",
    detail: "Probability context",
  },
  {
    label: "context.probability_result",
    type: "property",
    detail: "Probability result",
  },
];

// Card / self object properties

const CARD_PROPS: Completion[] = [
  { label: "card.ability", type: "property", detail: "Card ability table" },
  { label: "card.ability.extra", type: "property", detail: "Custom config" },
  { label: "card.base.id", type: "property", detail: "Rank ID (2-14)" },
  { label: "card.base.suit", type: "property", detail: "Suit name" },
  { label: "card.edition", type: "property", detail: "Card edition" },
  { label: "card.enhancement", type: "property", detail: "Card enhancement" },
  { label: "card.seal", type: "property", detail: "Card seal" },
  { label: "card.config.center.key", type: "property", detail: "Center key" },
  { label: "card.cost", type: "property", detail: "Card cost" },
  { label: "card.sell_cost", type: "property", detail: "Sell value" },
  { label: "card.set_cost", type: "function", detail: "()" },
];

const SELF_PROPS: Completion[] = [
  { label: "self.config", type: "property", detail: "Joker config table" },
  { label: "self.config.extra", type: "property", detail: "Custom extra vars" },
  { label: "self.config.center.key", type: "property", detail: "Center key" },
  { label: "self.key", type: "property", detail: "Joker key" },
  { label: "self.full_key", type: "property", detail: "mod:key" },
  { label: "self.ability", type: "property", detail: "Ability table" },
  {
    label: "self.ability_path",
    type: "property",
    detail: "Config path string",
  },
  { label: "self.cost", type: "property", detail: "Card cost" },
  { label: "self.sell_cost", type: "property", detail: "Sell value" },
  { label: "self.user_vars", type: "property", detail: "User variables" },
];

// Callback names (used in SMODS registration tables)

const CALLBACK_NAMES: Completion[] = [
  {
    label: "calculate",
    type: "function",
    detail: "(self, card, context)",
    info: "Main calculation callback",
  },
  {
    label: "loc_vars",
    type: "function",
    detail: "(self, info_queue, card)",
    info: "Localization variables",
  },
  {
    label: "set_ability",
    type: "function",
    detail: "(self, card, initial, delay)",
    info: "Called on card creation",
  },
  {
    label: "add_to_deck",
    type: "function",
    detail: "(self, card, from_debuff)",
    info: "Card added to deck",
  },
  {
    label: "remove_from_deck",
    type: "function",
    detail: "(self, card, from_debuff)",
    info: "Card removed from deck",
  },
  {
    label: "in_pool",
    type: "function",
    detail: "(self) → bool, table?",
    info: "Is this available in the pool?",
  },
  {
    label: "can_use",
    type: "function",
    detail: "(self, card)",
    info: "Can consumable be used?",
  },
  {
    label: "use",
    type: "function",
    detail: "(self, card, area, copier)",
    info: "Consumable use effect",
  },
  {
    label: "redeem",
    type: "function",
    detail: "(self, card)",
    info: "Voucher redeem",
  },
  {
    label: "apply",
    type: "function",
    detail: "(self, back)",
    info: "Deck/back apply",
  },
];

// Return fields (for calculate return tables)

const RETURN_FIELDS: Completion[] = [
  { label: "chips", type: "property", detail: "Add chips" },
  { label: "mult", type: "property", detail: "Add mult" },
  { label: "x_mult", type: "property", detail: "Multiply mult" },
  { label: "Xchips", type: "property", detail: "Multiply chips" },
  { label: "Xmult", type: "property", detail: "Multiply mult (X)" },
  { label: "retrigger", type: "property", detail: "Retrigger count" },
  { label: "message", type: "property", detail: "Display text" },
  { label: "colour", type: "property", detail: "Message colour" },
  { label: "extra", type: "property", detail: "Chained effects" },
  {
    label: "remove_playing_cards",
    type: "property",
    detail: "Cards to remove",
  },
  { label: "dollars", type: "property", detail: "Give/take money" },
  { label: "repetitions", type: "property", detail: "Repeat count" },
  { label: "swap", type: "property", detail: "Swap chips/mult" },
  { label: "level_up", type: "property", detail: "Level up hand" },
];

// Balatro helper functions

const BALATRO_HELPERS: Completion[] = [
  { label: "pseudorandom", type: "function", detail: "(seed) → number" },
  { label: "pseudorandom_element", type: "function", detail: "(t, seed) → v" },
  { label: "pseudoshuffle", type: "function", detail: "(t, seed) → t" },
  { label: "copy_card", type: "function", detail: "(card, area?) → card" },
  {
    label: "card_eval_status_text",
    type: "function",
    detail: "(card, text, ...)",
    info: "Show floating text on a card",
  },
  { label: "localize", type: "function", detail: "(key, ...) → string" },
  { label: "poll_edition", type: "function", detail: "(seed, opts) → edition" },
  {
    label: "ease_dollars",
    type: "function",
    detail: "(n, silent?)",
    info: "Add/remove money with animation",
  },
  {
    label: "ease_chips",
    type: "function",
    detail: "(n)",
    info: "Animate chip change",
  },
  {
    label: "ease_mult",
    type: "function",
    detail: "(n)",
    info: "Animate mult change",
  },
  {
    label: "level_up_hand",
    type: "function",
    detail: "(card, hand, n?)",
    info: "Level up a poker hand",
  },
  {
    label: "start_dissolve",
    type: "function",
    detail: "(cards)",
    info: "Dissolve animation",
  },
  { label: "play_sound", type: "function", detail: "(sound, pitch?, volume?)" },
  {
    label: "juice_card",
    type: "function",
    detail: "(card)",
    info: "Juice animation on card",
  },
  {
    label: "make_event",
    type: "function",
    detail: "(opts)",
    info: "Create a game event",
  },
];

// Combine all completions

const ALL_COMPLETIONS: Completion[] = [
  ...LUA_KEYWORDS,
  ...LUA_BUILTINS,
  ...SMODS_TYPES,
  ...SMODS_FUNCTIONS,
  ...GAME_GLOBALS,
  ...CONTEXT_PROPS,
  ...CARD_PROPS,
  ...SELF_PROPS,
  ...CALLBACK_NAMES,
  ...RETURN_FIELDS,
  ...BALATRO_HELPERS,
];

// Dynamic document tokens, scan current code for identifiers

// Matches dotted identifiers like card.ability.extra.dollars0
const DOC_TOKEN_RE = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g;

const STATIC_LABELS = new Set(ALL_COMPLETIONS.map((c) => c.label));

function extractDocumentTokens(state: EditorState): Completion[] {
  const text = state.doc.toString();
  const seen = new Set<string>();
  const tokens: Completion[] = [];

  for (const match of text.matchAll(DOC_TOKEN_RE)) {
    const token = match[0];
    // Skip short tokens, duplicates, and tokens already in static list
    if (token.length < 3) continue;
    if (seen.has(token)) continue;
    if (STATIC_LABELS.has(token)) continue;
    seen.add(token);

    // Also add dotted sub-paths (e.g. card.ability.extra.dollars0 ->
    // card.ability, card.ability.extra, card.ability.extra.dollars0)
    if (token.includes(".")) {
      const parts = token.split(".");
      for (let i = 2; i <= parts.length; i++) {
        const sub = parts.slice(0, i).join(".");
        if (sub.length >= 3 && !seen.has(sub) && !STATIC_LABELS.has(sub)) {
          seen.add(sub);
          tokens.push({
            label: sub,
            type: "text",
            boost: -1, // rank below static completions
          });
        }
      }
    } else {
      tokens.push({
        label: token,
        type: "text",
        boost: -1,
      });
    }
  }

  return tokens;
}

// CompletionSource for CodeMirror

// Match word characters and dots (for G.GAME.dollars, SMODS.Joker, etc.)
const WORD_RE = /[\w.]+$/;

export function luaSmodsCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const word = context.matchBefore(WORD_RE);
  if (!word) return null;
  // Only activate after at least 2 characters or explicit request
  if (word.from === word.to && !context.explicit) return null;
  if (word.text.length < 2 && !context.explicit) return null;

  const prefix = word.text.toLowerCase();

  // Combine static + dynamic document completions
  const docTokens = extractDocumentTokens(context.state);
  let candidates = [...ALL_COMPLETIONS, ...docTokens];

  // If typing after a dot, narrow to relevant property completions
  if (prefix.includes(".")) {
    const parts = prefix.split(".");
    const base = parts.slice(0, -1).join(".");
    const filtered = candidates.filter((c) =>
      c.label.toLowerCase().startsWith(base + "."),
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  return {
    from: word.from,
    options: candidates,
    validFor: WORD_RE,
  };
}
