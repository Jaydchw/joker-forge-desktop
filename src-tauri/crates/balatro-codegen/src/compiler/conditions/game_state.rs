use crate::compiler::conditions::utils::str_param;
use crate::compiler::context::CompileContext;
use crate::compiler::values::{comparison_op, resolve_condition_value};
use crate::lua_ast::*;
use crate::types::ConditionDef;

/// Ante Level condition.
pub fn ante_level(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    simple_compare(
        condition,
        lua_path(&["G", "GAME", "round_resets", "ante"]),
        ctx,
        "ante_level",
    )
}

/// Blind Type condition: boss, small, big.
pub fn blind_type(condition: &ConditionDef) -> Option<Expr> {
    let blind = str_param(condition, &["blind_type", "blindType"]).unwrap_or("small");
    Some(match blind {
        "boss" | "Boss" => lua_raw_expr("G.GAME.blind.boss"),
        "big" | "Big" => lua_raw_expr("G.GAME.blind:get_type() == 'Big'"),
        _ => lua_raw_expr("G.GAME.blind:get_type() == 'Small'"),
    })
}

/// Blind Name condition: checks blind name.
pub fn blind_name(condition: &ConditionDef) -> Option<Expr> {
    let name = str_param(condition, &["value", "blindName"]).unwrap_or("Small Blind");
    let operator = str_param(condition, &["operation", "operator"]).unwrap_or("equals");
    Some(comparison_op(
        operator,
        lua_path(&["G", "GAME", "blind", "name"]),
        lua_str(name),
    ))
}

/// Player Money condition.
pub fn player_money(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    simple_compare(
        condition,
        lua_path(&["G", "GAME", "dollars"]),
        ctx,
        "player_money",
    )
}

/// Remaining Hands condition.
pub fn remaining_hands(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    simple_compare(
        condition,
        lua_path(&["G", "GAME", "current_round", "hands_left"]),
        ctx,
        "remaining_hands",
    )
}

/// Remaining Discards condition.
pub fn remaining_discards(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    simple_compare(
        condition,
        lua_path(&["G", "GAME", "current_round", "discards_left"]),
        ctx,
        "remaining_discards",
    )
}

/// Joker Count condition.
pub fn joker_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    simple_compare(
        condition,
        lua_len(lua_path(&["G", "jokers", "cards"])),
        ctx,
        "joker_count",
    )
}

/// Consumable Count condition.
pub fn consumable_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    simple_compare(
        condition,
        lua_len(lua_path(&["G", "consumeables", "cards"])),
        ctx,
        "consumable_count",
    )
}

/// Deck Size condition.
pub fn deck_size(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let size_type = str_param(condition, &["size_type"]).unwrap_or("remaining");
    let subject = if size_type == "total" {
        lua_len(lua_path(&["G", "playing_cards"]))
    } else {
        lua_len(lua_path(&["G", "deck", "cards"]))
    };
    simple_compare(condition, subject, ctx, "deck_size")
}

/// Generic Compare condition: arbitrary comparison between two values.
pub fn generic_compare(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("equals");
    let value1 = resolve_condition_value(&condition.params, "value1", ctx, "generic_compare_lhs")?;
    let value2 = resolve_condition_value(&condition.params, "value2", ctx, "generic_compare_rhs")?;

    Some(comparison_op(operator, value1, value2))
}

/// Boss Blind Type condition: checks boss blind.
pub fn boss_blind_type(condition: &ConditionDef) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("equals");
    let value = condition.params.get("value")?.as_str()?;

    Some(comparison_op(
        operator,
        lua_path(&["G", "GAME", "blind", "config", "blind", "key"]),
        lua_str(value),
    ))
}

/// Check Blind Requirements: checks whether blind requirements percentage is met.
pub fn check_blind_requirements(
    condition: &ConditionDef,
    ctx: &mut CompileContext,
) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("greater_equals");
    let value_expr = resolve_condition_value(&condition.params, "percentage", ctx, "blind_req")
        .unwrap_or_else(|| lua_int(25));

    // Compare (G.GAME.chips / G.GAME.blind.chips * 100) against percentage
    let ratio_expr =
        lua_raw_expr("((G.GAME.chips or 0) / (G.GAME.blind.chips or 1) * 100)".to_string());

    Some(comparison_op(operator, ratio_expr, value_expr))
}

/// Check Deck: checks what deck is being used.
pub fn check_deck(condition: &ConditionDef) -> Option<Expr> {
    let deck = condition.params.get("decks")?.as_str()?;

    Some(lua_eq(
        lua_path(&["G", "GAME", "selected_back", "name"]),
        lua_str(deck),
    ))
}

/// Deck Count: total deck card count (#G.playing_cards).
pub fn deck_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let property_type = str_param(condition, &["property_type"]).unwrap_or("enhancement");
    let operator = str_param(condition, &["operator"]).unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "deck_count")?;

    let check = match property_type {
        "rank" => {
            let rank = str_param(condition, &["rank"]).unwrap_or("any");
            if rank == "any" {
                "true".to_string()
            } else {
                let rank_id = super::hand::rank_id_from_name(rank);
                format!("v:get_id() == {}", rank_id)
            }
        }
        "suit" => {
            let suit = str_param(condition, &["suit"]).unwrap_or("any");
            if suit == "any" {
                "true".to_string()
            } else {
                format!("v:is_suit('{}')", suit)
            }
        }
        "enhancement" => {
            let enh = str_param(condition, &["enhancement"]).unwrap_or("any");
            if enh == "any" {
                "v.config.center.key ~= 'c_base'".to_string()
            } else if enh == "none" {
                "v.config.center.key == 'c_base'".to_string()
            } else {
                format!("v.config.center.key == '{}'", enh)
            }
        }
        "seal" => {
            let seal = str_param(condition, &["seal"]).unwrap_or("any");
            if seal == "any" {
                "v.seal ~= nil".to_string()
            } else if seal == "none" {
                "v.seal == nil".to_string()
            } else {
                format!("v.seal == '{}'", seal)
            }
        }
        "edition" => {
            let edition = str_param(condition, &["edition"]).unwrap_or("any");
            if edition == "any" {
                "v.edition and next(v.edition)".to_string()
            } else if edition == "none" {
                "not (v.edition and next(v.edition))".to_string()
            } else {
                format!("v.edition and v.edition.key == '{}'", edition)
            }
        }
        _ => "true".to_string(),
    };

    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(G.playing_cards or {{}}) do \
         if {} then c = c + 1 end end return c end)()",
        check
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

/// In Blind: check whether currently in a blind.
pub fn in_blind(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_raw_expr("G.GAME.blind and G.GAME.blind.in_blind"))
}

/// Game Speed: check game speed setting.
pub fn game_speed(condition: &ConditionDef) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("equals");
    let speed = str_param(condition, &["speed"]).unwrap_or("1");

    Some(comparison_op(
        operator,
        lua_path(&["G", "SETTINGS", "GAMESPEED"]),
        lua_raw_expr(speed),
    ))
}

/// Triggered Boss Blind: check whether boss blind effect was triggered.
pub fn triggered_boss_blind(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_path(&["G", "GAME", "blind", "triggered"]))
}

/// Check Flag: check a game flag.
pub fn check_flag(condition: &ConditionDef) -> Option<Expr> {
    let flag_name = condition.params.get("flag_name")?.as_str()?;

    Some(lua_path(&["G", "GAME", "pool_flags", flag_name]))
}

/// Which Tag: check the tag type.
pub fn which_tag(condition: &ConditionDef) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("equals");
    let value = condition.params.get("value")?.as_str()?;

    Some(comparison_op(
        operator,
        lua_path(&["context", "tag", "key"]),
        lua_str(value),
    ))
}

/// Consumable Type: check the type of consumable being used/bought.
pub fn consumable_type(condition: &ConditionDef) -> Option<Expr> {
    let consumable_type = str_param(condition, &["consumable_type"]).unwrap_or("any");
    let specific_card = str_param(condition, &["specific_card"]).unwrap_or("any");

    if specific_card != "any" {
        return Some(lua_eq(
            lua_path(&["context", "consumeable", "config", "center", "key"]),
            lua_str(specific_card),
        ));
    }

    if consumable_type != "any" {
        return Some(lua_eq(
            lua_path(&["context", "consumeable", "config", "center", "set"]),
            lua_str(consumable_type),
        ));
    }

    Some(lua_bool(true))
}

/// Voucher Redeemed: check whether a specific voucher was redeemed.
pub fn voucher_redeemed(condition: &ConditionDef) -> Option<Expr> {
    let voucher = condition.params.get("voucher")?.as_str()?;

    Some(lua_path(&["G", "GAME", "used_vouchers", voucher]))
}

/// System condition: check what OS the player is on.
pub fn system_condition(condition: &ConditionDef) -> Option<Expr> {
    let system = str_param(condition, &["system"]).unwrap_or("Windows");

    Some(lua_eq(
        lua_call("love.system.getOS", vec![]),
        lua_str(system),
    ))
}

/// Glass Card Destroyed: check glass card destroyed context.
pub fn glass_card_destroyed(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_path(&["context", "glass_shattered"]))
}

/// Lucky Card Triggered: check lucky card triggered context.
pub fn lucky_card_triggered(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_path(&["context", "lucky_trigger"]))
}

/// Probability Succeeded: check whether probability succeeded or failed.
pub fn probability_succeeded(condition: &ConditionDef) -> Option<Expr> {
    let status = str_param(condition, &["status"]).unwrap_or("succeeded");

    match status {
        "succeeded" => Some(lua_path(&["context", "probability_result"])),
        "failed" => Some(lua_not(lua_path(&["context", "probability_result"]))),
        _ => Some(lua_path(&["context", "probability_result"])),
    }
}

/// Probability Identifier: identify probability group.
pub fn probability_identifier(condition: &ConditionDef) -> Option<Expr> {
    let mode = str_param(condition, &["mode"]).unwrap_or("vanilla");

    let key = match mode {
        "custom" => match str_param(condition, &["card_key"]) {
            Some(key) => key,
            None => {
                return Some(super::utils::invalid_condition(
                    "probability_identifier",
                    "no identifier key given",
                ))
            }
        },
        _ => str_param(condition, &["specific_card"]).unwrap_or("8ball"),
    };

    Some(lua_eq(lua_path(&["context", "identifier"]), lua_str(key)))
}

/// Probability Part Compare: compare probability parts.
pub fn probability_part_compare(
    condition: &ConditionDef,
    ctx: &mut CompileContext,
) -> Option<Expr> {
    let part = str_param(condition, &["part"]).unwrap_or("numerator");
    let operator = str_param(condition, &["operator"]).unwrap_or("equals");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "probability_part")?;

    let lhs = match part {
        "numerator" => lua_path(&["context", "probability", "numerator"]),
        "denominator" => lua_path(&["context", "probability", "denominator"]),
        _ => lua_path(&["context", "probability", "numerator"]),
    };

    Some(comparison_op(operator, lhs, value_expr))
}

/// Booster Type: check booster pack type.
pub fn booster_type(condition: &ConditionDef) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("equals");
    let booster_key = str_param(condition, &["booster_key"]).unwrap_or("");

    Some(comparison_op(
        operator,
        lua_path(&["context", "booster", "config", "center", "key"]),
        lua_str(booster_key),
    ))
}

/// Helper for conditions that compare a game state expression against a value.
/// Registers the numeric value in `config.extra` using the condition type as slug.
fn simple_compare(
    condition: &ConditionDef,
    game_expr: Expr,
    ctx: &mut CompileContext,
    condition_type: &str,
) -> Option<Expr> {
    let operator = str_param(condition, &["operator"]).unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, condition_type)?;

    Some(comparison_op(operator, game_expr, value_expr))
}
