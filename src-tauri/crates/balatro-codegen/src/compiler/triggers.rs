use crate::lua_ast::*;
use crate::types::ObjectType;

/// Generate the context check expression for a trigger.
///
/// Returns the Lua expression that goes inside `if <expr> then` to determine
/// whether the current calculate() invocation matches this trigger.
pub fn trigger_context(object_type: ObjectType, trigger: &str, blueprint_compat: bool) -> Expr {
    trigger_context_for_rule(object_type, trigger, blueprint_compat, false)
}

/// Generate trigger context with per-rule modifiers (e.g. retrigger effects).
pub fn trigger_context_for_rule(
    object_type: ObjectType,
    trigger: &str,
    blueprint_compat: bool,
    use_retrigger_context: bool,
) -> Expr {
    if use_retrigger_context {
        if let Some(expr) = retrigger_trigger_context(object_type, trigger, blueprint_compat) {
            return expr;
        }
    }

    let ctx = match object_type {
        ObjectType::Joker => joker_trigger_context(trigger, blueprint_compat),
        ObjectType::Consumable => consumable_trigger_context(trigger),
        ObjectType::Enhancement | ObjectType::Seal | ObjectType::Edition => {
            card_trigger_context(trigger, object_type)
        }
        ObjectType::Voucher => voucher_trigger_context(trigger),
        ObjectType::Deck => deck_trigger_context(trigger),
        // These types don't use calculate hooks with trigger contexts
        ObjectType::ConsumableType | ObjectType::Rarity | ObjectType::Booster => {
            return lua_raw_expr(format!(
                "--[[ {} has no trigger context ]] false",
                object_type.as_str()
            ))
        }
    };

    ctx.unwrap_or_else(|| {
        // Fallback: emit a raw context comment for unknown triggers
        lua_raw_expr(format!("--[[ unknown trigger: {} ]] false", trigger))
    })
}

/// Generate context for a retrigger-specific trigger path.
/// Retriggers use `context.repetition` instead of `context.individual`.
pub fn retrigger_trigger_context(
    object_type: ObjectType,
    trigger: &str,
    blueprint_compat: bool,
) -> Option<Expr> {
    match (object_type, trigger) {
        (ObjectType::Joker, "card_scored") => {
            let base = lua_and(
                lua_eq(ctx("cardarea"), lua_path(&["G", "play"])),
                ctx("repetition"),
            );
            Some(maybe_blueprint(base, blueprint_compat))
        }
        (ObjectType::Joker, "card_held_in_hand")
        | (ObjectType::Joker, "card_held_in_hand_end_of_round") => {
            let base = lua_and(
                ctx("repetition"),
                lua_and(
                    lua_eq(ctx("cardarea"), lua_path(&["G", "hand"])),
                    lua_and(
                        ctx("end_of_round"),
                        lua_raw_expr(
                            "(next(context.card_effects[1]) or #context.card_effects > 1)",
                        ),
                    ),
                ),
            );
            Some(maybe_blueprint(base, blueprint_compat))
        }
        (ObjectType::Enhancement | ObjectType::Seal | ObjectType::Edition, "card_scored") => {
            Some(lua_and(
                ctx("repetition"),
                lua_eq(ctx("cardarea"), lua_path(&["G", "play"])),
            ))
        }
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Joker triggers
// ---------------------------------------------------------------------------

fn joker_trigger_context(trigger: &str, bp: bool) -> Option<Expr> {
    let expr = match trigger {
        // Hand scoring
        "hand_played" => bp_check(ctx("joker_main"), bp),
        "before_hand_played" => bp_check(ctx("before"), bp),
        "after_hand_played" => bp_check(ctx("after"), bp),
        "card_scored" => bp_check(
            lua_and(
                ctx("individual"),
                lua_eq(ctx("cardarea"), lua_path(&["G", "play"])),
            ),
            bp,
        ),
        "joker_evaluated" => bp_check(ctx("other_joker"), bp),
        "joker_triggered" => bp_check(ctx("post_trigger"), bp),

        // In blind events
        "hand_drawn" => bp_check(ctx("hand_drawn"), bp),
        "first_hand_drawn" => bp_check(ctx("first_hand_drawn"), bp),
        "hand_discarded" => bp_check(ctx("pre_discard"), bp),
        "card_discarded" => bp_check(ctx("discard"), bp),
        "card_held_in_hand" => bp_check(
            lua_and(
                ctx("individual"),
                lua_and(
                    lua_eq(ctx("cardarea"), lua_path(&["G", "hand"])),
                    lua_not(ctx("end_of_round")),
                ),
            ),
            bp,
        ),
        "card_held_in_hand_end_of_round" => bp_check(
            lua_and(
                ctx("individual"),
                lua_and(
                    lua_eq(ctx("cardarea"), lua_path(&["G", "hand"])),
                    ctx("end_of_round"),
                ),
            ),
            bp,
        ),

        // Round events
        "round_end" => bp_check(
            lua_and(
                ctx("end_of_round"),
                lua_and(
                    lua_eq(ctx("game_over"), lua_bool(false)),
                    ctx("main_eval"),
                ),
            ),
            bp,
        ),
        "blind_selected" => bp_check(lua_and(ctx("setting_blind"), ctx("main_eval")), bp),
        "blind_skipped" => bp_check(lua_and(ctx("skip_blind"), ctx("main_eval")), bp),
        "blind_disabled" => bp_check(ctx("blind_disabled"), bp),
        "boss_defeated" => bp_check(
            lua_and(
                ctx("end_of_round"),
                lua_and(ctx("main_eval"), lua_raw_expr("G.GAME.blind.boss")),
            ),
            bp,
        ),
        "ante_start" => bp_check(ctx("ante_change"), bp),

        // Economy
        "card_bought" => bp_check(lua_and(ctx("buying_card"), ctx("main_eval")), bp),
        "card_sold" => bp_check(lua_and(ctx("selling_card"), ctx("main_eval")), bp),
        "selling_self" => bp_check(ctx("selling_self"), bp),
        "buying_self" => bp_check(ctx("buying_self"), bp),
        "shop_entered" => bp_check(ctx("starting_shop"), bp),
        "shop_exited" => bp_check(ctx("ending_shop"), bp),
        "shop_reroll" => bp_check(lua_and(ctx("reroll_shop"), ctx("main_eval")), bp),

        // Packs & consumables
        "consumable_used" => bp_check(ctx("using_consumeable"), bp),
        "playing_card_added" => bp_check(lua_and(ctx("playing_card_added"), ctx("main_eval")), bp),
        "booster_opened" => bp_check(lua_and(ctx("open_booster"), ctx("main_eval")), bp),
        "booster_skipped" => bp_check(ctx("skipping_booster"), bp),
        "booster_exited" => bp_check(ctx("ending_booster"), bp),

        // Tags
        "tag_added" => bp_check(ctx("tag_added"), bp),

        // Special
        "card_destroyed" => bp_check(ctx("remove_playing_cards"), bp),
        "game_over" => bp_check(
            lua_and(
                ctx("end_of_round"),
                lua_and(ctx("game_over"), ctx("main_eval")),
            ),
            bp,
        ),
        "change_probability" | "probability_result" => {
            bp_check(ctx("pseudorandom_result"), bp)
        }

        // Composite: fires on many player actions
        "player_action" => bp_check(
            lua_raw_expr(
                "(context.end_of_round or context.reroll_shop or context.buying_card or context.selling_card or context.ending_shop or context.starting_shop or context.ending_booster or context.skipping_booster or context.open_booster or context.skip_blind or context.before or context.pre_discard or context.setting_blind or context.using_consumeable)",
            ),
            bp,
        ),

        // Passive doesn't use a context check, handled separately
        "passive" => return None,

        // Dollar bonus triggers (handled via calc_dollar_bonus)
        "blind_reward" | "boss_blind_reward" => return None,

        _ => return None,
    };
    Some(expr)
}

// ---------------------------------------------------------------------------
// Consumable triggers
// ---------------------------------------------------------------------------

fn consumable_trigger_context(trigger: &str) -> Option<Expr> {
    // Consumables share many non-joker-main triggers
    shared_trigger_context(trigger)
}

// ---------------------------------------------------------------------------
// Card triggers (enhancement / seal / edition)
// ---------------------------------------------------------------------------

fn card_trigger_context(trigger: &str, object_type: ObjectType) -> Option<Expr> {
    let expr = match trigger {
        "card_scored" => {
            if object_type == ObjectType::Edition {
                // Editions trigger on pre_joker or main_scoring contexts
                lua_or(
                    ctx("pre_joker"),
                    lua_and(
                        ctx("main_scoring"),
                        lua_eq(ctx("cardarea"), lua_path(&["G", "play"])),
                    ),
                )
            } else {
                // Enhancements and seals: main_scoring context
                lua_and(
                    ctx("main_scoring"),
                    lua_eq(ctx("cardarea"), lua_path(&["G", "play"])),
                )
            }
        }
        "card_held_in_hand" => lua_and(
            lua_eq(ctx("cardarea"), lua_path(&["G", "hand"])),
            ctx("main_scoring"),
        ),
        "card_held_in_hand_end_of_round" => lua_and(
            ctx("end_of_round"),
            lua_and(
                lua_eq(ctx("cardarea"), lua_path(&["G", "hand"])),
                lua_and(
                    lua_eq(ctx("other_card"), lua_ident("card")),
                    ctx("individual"),
                ),
            ),
        ),
        "card_discarded" => lua_and(ctx("discard"), lua_eq(ctx("other_card"), lua_ident("card"))),
        _ => return None,
    };
    Some(expr)
}

// ---------------------------------------------------------------------------
// Voucher triggers
// ---------------------------------------------------------------------------

fn voucher_trigger_context(trigger: &str) -> Option<Expr> {
    // Vouchers share the same non-joker triggers
    shared_trigger_context(trigger)
}

// ---------------------------------------------------------------------------
// Deck triggers
// ---------------------------------------------------------------------------

fn deck_trigger_context(trigger: &str) -> Option<Expr> {
    // Decks share the same non-joker triggers, plus card scoring
    match trigger {
        "card_scored" => Some(lua_and(
            ctx("individual"),
            lua_eq(ctx("cardarea"), lua_path(&["G", "play"])),
        )),
        "hand_played" => Some(ctx("main_eval")),
        _ => shared_trigger_context(trigger),
    }
}

// ---------------------------------------------------------------------------
// Shared triggers for non-joker objects (consumables, vouchers, decks)
// ---------------------------------------------------------------------------

/// Trigger contexts shared across consumables, vouchers: and decks.
/// These are the same expressions as joker triggers but without blueprint checks
/// and without joker_main guards.
fn shared_trigger_context(trigger: &str) -> Option<Expr> {
    let expr = match trigger {
        "round_end" => lua_and(
            ctx("end_of_round"),
            lua_and(lua_eq(ctx("game_over"), lua_bool(false)), ctx("main_eval")),
        ),
        "blind_selected" => ctx("setting_blind"),
        "blind_skipped" => ctx("skip_blind"),
        "blind_disabled" => ctx("blind_disabled"),
        "boss_defeated" => lua_and(
            ctx("end_of_round"),
            lua_and(ctx("main_eval"), lua_raw_expr("G.GAME.blind.boss")),
        ),
        "booster_opened" => ctx("open_booster"),
        "booster_skipped" => ctx("skipping_booster"),
        "booster_exited" => ctx("ending_booster"),
        "shop_entered" => ctx("starting_shop"),
        "shop_exited" => ctx("ending_shop"),
        "hand_played" => ctx("main_eval"),
        _ => return None,
    };
    Some(expr)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Shorthand for `context.field`.
fn ctx(field: &str) -> Expr {
    lua_path(&["context", field])
}

/// Optionally wrap with `and not context.blueprint`.
fn maybe_blueprint(expr: Expr, blueprint_compat: bool) -> Expr {
    if blueprint_compat {
        expr
    } else {
        lua_and(expr, lua_not(ctx("blueprint")))
    }
}

fn bp_check(expr: Expr, blueprint_compat: bool) -> Expr {
    maybe_blueprint(expr, blueprint_compat)
}
