use crate::compiler::conditions::utils::str_param;
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
    let index_type = str_param(condition, &["index_type"]).unwrap_or("first");

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

fn rank_check_expr(condition: &ConditionDef) -> String {
    super::hand::rank_check_expr_for(condition, "context.other_card")
}

fn suit_check_expr(condition: &ConditionDef) -> String {
    super::hand::suit_check_expr_for(condition, "context.other_card")
}
