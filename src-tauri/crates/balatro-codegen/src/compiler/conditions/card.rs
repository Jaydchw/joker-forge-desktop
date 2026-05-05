use crate::compiler::context::CompileContext;
use crate::compiler::values::resolve_condition_value;
use crate::lua_ast::*;
use crate::types::ConditionDef;

/// Card Rank condition: checks the rank of the currently evaluated card.
pub fn card_rank(condition: &ConditionDef) -> Option<Expr> {
    let rank = condition.params.get("rank")?.as_str()?;
    let rank_id = rank_to_id(rank);

    Some(lua_eq(
        lua_method(lua_path(&["context", "other_card"]), "get_id", vec![]),
        lua_int(rank_id.parse().unwrap_or(0)),
    ))
}

/// Card Suit condition: checks the suit of the currently evaluated card.
pub fn card_suit(condition: &ConditionDef) -> Option<Expr> {
    let suit = condition.params.get("suit")?.as_str()?;

    Some(lua_method(
        lua_path(&["context", "other_card"]),
        "is_suit",
        vec![lua_str(suit)],
    ))
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
