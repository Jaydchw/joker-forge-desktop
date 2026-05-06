use crate::compiler::context::CompileContext;
use crate::compiler::values::resolve_condition_value;
use crate::lua_ast::*;
use crate::types::ConditionDef;

/// Card Rank condition: checks the rank of the currently evaluated card.
pub fn card_rank(condition: &ConditionDef) -> Option<Expr> {
    let check = rank_check_expr(condition);
    Some(lua_raw_expr(check))
}

/// Card Suit condition: checks the suit of the currently evaluated card.
pub fn card_suit(condition: &ConditionDef) -> Option<Expr> {
    let check = suit_check_expr(condition);
    Some(lua_raw_expr(check))
}

/// Card Enhancement condition: checks whether the card has a specific enhancement.
pub fn card_enhancement(condition: &ConditionDef) -> Option<Expr> {
    let enhancement = condition.params.get("enhancement")?.as_str()?;

    Some(lua_eq(
        lua_path(&["context", "other_card", "config", "center", "key"]),
        lua_str(enhancement),
    ))
}

/// Card Edition condition: checks whether the card has a specific edition.
pub fn card_edition(condition: &ConditionDef) -> Option<Expr> {
    let edition = condition.params.get("edition")?.as_str()?;

    Some(lua_eq(
        lua_path(&["context", "other_card", "edition", "key"]),
        lua_str(edition),
    ))
}

/// Card Seal condition: checks whether the card has a specific seal.
pub fn card_seal(condition: &ConditionDef) -> Option<Expr> {
    let seal = condition.params.get("seal")?.as_str()?;

    Some(lua_eq(
        lua_path(&["context", "other_card", "seal"]),
        lua_str(seal),
    ))
}

/// Card Index condition: checks the card's position in the scoring hand.
pub fn card_index(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let index_type = condition
        .params
        .get("index_type")
        .and_then(|v| v.as_str())
        .unwrap_or("first");

    match index_type {
        "first" => Some(lua_eq(
            lua_path(&["context", "other_card"]),
            lua_raw_expr("context.scoring_hand[1]"),
        )),
        "last" => Some(lua_eq(
            lua_path(&["context", "other_card"]),
            lua_raw_expr("context.scoring_hand[#context.scoring_hand]"),
        )),
        "number" => {
            let index_expr =
                resolve_condition_value(&condition.params, "index_number", ctx, "card_index")
                    .unwrap_or_else(|| lua_int(1));
            Some(lua_eq(
                lua_path(&["context", "other_card"]),
                lua_index(lua_path(&["context", "scoring_hand"]), index_expr),
            ))
        }
        _ => Some(lua_eq(
            lua_path(&["context", "other_card"]),
            lua_raw_expr("context.scoring_hand[1]"),
        )),
    }
}

fn rank_to_id(rank: &str) -> &str {
    match rank {
        "Ace" => "14",
        "King" => "13",
        "Queen" => "12",
        "Jack" => "11",
        _ => rank,
    }
}

fn rank_check_expr(condition: &ConditionDef) -> String {
    let card_ref = "context.other_card";

    if let Some(var_name) = rank_var_name(condition) {
        return format!(
            "{card}:get_id() == ((G.GAME.current_round.{name}_card or {{}}).id or 0)",
            card = card_ref,
            name = var_name
        );
    }

    let rank_type = condition
        .params
        .get("rank_type")
        .and_then(|v| v.as_str())
        .unwrap_or("specific");

    if rank_type == "group" {
        let rank_group = condition
            .params
            .get("rank_group")
            .and_then(|v| v.as_str())
            .unwrap_or("odd");
        return match rank_group {
            "face" => format!("{card}:is_face()", card = card_ref),
            "even" => format!(
                "({card}:get_id() == 2 or {card}:get_id() == 4 or {card}:get_id() == 6 or {card}:get_id() == 8 or {card}:get_id() == 10)",
                card = card_ref
            ),
            _ => format!(
                "({card}:get_id() == 14 or {card}:get_id() == 3 or {card}:get_id() == 5 or {card}:get_id() == 7 or {card}:get_id() == 9)",
                card = card_ref
            ),
        };
    }

    let rank = condition
        .params
        .get("specific_rank")
        .and_then(|v| v.as_str())
        .or_else(|| condition.params.get("rank").and_then(|v| v.as_str()))
        .unwrap_or("Ace");
    let rank_id = rank_to_id(rank);
    format!("{card}:get_id() == {id}", card = card_ref, id = rank_id)
}

fn suit_check_expr(condition: &ConditionDef) -> String {
    let card_ref = "context.other_card";

    if let Some(var_name) = suit_var_name(condition) {
        return format!(
            "{card}:is_suit((G.GAME.current_round.{name}_card or {{}}).suit or 'Spades')",
            card = card_ref,
            name = var_name
        );
    }

    let suit_type = condition
        .params
        .get("suit_type")
        .and_then(|v| v.as_str())
        .unwrap_or("specific");

    if suit_type == "group" {
        let suit_group = condition
            .params
            .get("suit_group")
            .and_then(|v| v.as_str())
            .unwrap_or("red");
        return match suit_group {
            "black" => format!(
                "{card}:is_suit('Spades') or {card}:is_suit('Clubs')",
                card = card_ref
            ),
            _ => format!(
                "{card}:is_suit('Hearts') or {card}:is_suit('Diamonds')",
                card = card_ref
            ),
        };
    }

    let suit = condition
        .params
        .get("specific_suit")
        .and_then(|v| v.as_str())
        .or_else(|| condition.params.get("suit").and_then(|v| v.as_str()))
        .unwrap_or("Hearts");
    format!("{card}:is_suit('{suit}')", card = card_ref, suit = suit)
}

fn suit_var_name(condition: &ConditionDef) -> Option<&str> {
    let suit_type = condition.params.get("suit_type")?;
    if let crate::types::ParamValue::Typed(typed) = suit_type {
        if typed.value_type == "user_var" || typed.value_type == "userVariable" {
            return typed.value.as_str();
        }
    }
    let specific = condition.params.get("specific_suit")?;
    if let crate::types::ParamValue::Typed(typed) = specific {
        if typed.value_type == "user_var" || typed.value_type == "userVariable" {
            return typed.value.as_str();
        }
    }
    None
}

fn rank_var_name(condition: &ConditionDef) -> Option<&str> {
    let rank_type = condition.params.get("rank_type")?;
    if let crate::types::ParamValue::Typed(typed) = rank_type {
        if typed.value_type == "user_var" || typed.value_type == "userVariable" {
            return typed.value.as_str();
        }
    }
    let specific = condition.params.get("specific_rank")?;
    if let crate::types::ParamValue::Typed(typed) = specific {
        if typed.value_type == "user_var" || typed.value_type == "userVariable" {
            return typed.value.as_str();
        }
    }
    None
}
