use crate::compiler::context::CompileContext;
use crate::compiler::values::{comparison_op, resolve_condition_value};
use crate::lua_ast::*;
use crate::types::ConditionDef;

/// Hand Type condition: checks whether the scoring hand matches a poker hand.
pub fn hand_type(condition: &ConditionDef) -> Option<Expr> {
    let hand = condition.params.get("handType")?.as_str()?;
    let scope = condition
        .params
        .get("scope")
        .and_then(|v| v.as_str())
        .unwrap_or("scoring");

    match hand {
        "most_played_hand" => {
            // IIFE that checks whether the scoring hand is the most played
            Some(lua_raw_expr(
                "(function() \
                    local current_played = G.GAME.hands[context.scoring_name].played or 0; \
                    for handname, values in pairs(G.GAME.hands) do \
                        if handname ~= context.scoring_name and values.played > current_played and values.visible then \
                            return false \
                        end \
                    end; \
                    return true \
                end)()",
            ))
        }
        "least_played_hand" => {
            Some(lua_raw_expr(
                "(function() \
                    local current_played = G.GAME.hands[context.scoring_name].played or 0; \
                    for handname, values in pairs(G.GAME.hands) do \
                        if handname ~= context.scoring_name and values.played < current_played and values.visible then \
                            return false \
                        end \
                    end; \
                    return true \
                end)()",
            ))
        }
        _ => {
            let hand_ref = lua_str(hand);

            match scope {
                "scoring" => {
                    // context.scoring_name == 'hand'
                    Some(lua_eq(lua_path(&["context", "scoring_name"]), hand_ref))
                }
                "all_played" | "contains" => {
                    // next(context.poker_hands['hand'])
                    Some(lua_call(
                        "next",
                        vec![lua_index(
                            lua_path(&["context", "poker_hands"]),
                            hand_ref,
                        )],
                    ))
                }
                _ => {
                    Some(lua_eq(lua_path(&["context", "scoring_name"]), hand_ref))
                }
            }
        }
    }
}

/// Hand Count condition: checks the number of cards in the current hand.
pub fn hand_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("equals");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "hand_count")?;

    Some(comparison_op(
        operator,
        lua_len(lua_path(&["G", "hand", "cards"])),
        value_expr,
    ))
}

/// Hand Size condition: checks the hand size limit.
pub fn hand_size(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("equals");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "hand_size")?;

    Some(comparison_op(
        operator,
        lua_path(&["G", "hand", "config", "card_limit"]),
        value_expr,
    ))
}

/// Suit Count condition: number of cards of a specific suit in the scoring hand.
pub fn suit_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let suit = condition.params.get("suit")?.as_str()?;
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "suit_count")?;

    // Count cards with matching suit in scoring hand
    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.scoring_hand or {{}}) do \
         if v:is_suit('{}') then c = c + 1 end end return c end)()",
        suit
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

/// Rank Count condition: number of cards of a specific rank in the scoring hand.
pub fn rank_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let rank = condition.params.get("rank")?.as_str()?;
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "rank_count")?;

    let rank_id = rank_to_id(rank);
    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.scoring_hand or {{}}) do \
         if v:get_id() == {} then c = c + 1 end end return c end)()",
        rank_id
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

/// Hand Level condition: checks the level of the scoring hand.
pub fn hand_level(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "hand_level")?;

    Some(comparison_op(
        operator,
        lua_path(&["G", "GAME", "hands[context.scoring_name]", "level"]),
        value_expr,
    ))
}

/// Discarded Card Count: checks the number of discarded cards.
pub fn discarded_card_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("equals");
    let value_expr =
        resolve_condition_value(&condition.params, "value", ctx, "discarded_card_count")?;

    Some(comparison_op(
        operator,
        lua_len(lua_path(&["context", "full_hand"])),
        value_expr,
    ))
}

/// Discarded Suit Count: count of discarded cards of a specific suit.
pub fn discarded_suit_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let suit = condition
        .params
        .get("specific_suit")
        .and_then(|v| v.as_str())
        .unwrap_or("Hearts");
    let quantifier = condition
        .params
        .get("quantifier")
        .and_then(|v| v.as_str())
        .unwrap_or("at_least");
    let value_expr =
        resolve_condition_value(&condition.params, "count", ctx, "discarded_suit_count")
            .unwrap_or_else(|| lua_int(1));

    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.full_hand or {{}}) do \
         if v:is_suit('{}') then c = c + 1 end end return c end)()",
        suit
    ));

    let op = quantifier_to_op(quantifier);
    Some(comparison_op(op, count_expr, value_expr))
}

/// Discarded Rank Count: count of discarded cards of a specific rank.
pub fn discarded_rank_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let rank = condition
        .params
        .get("specific_rank")
        .and_then(|v| v.as_str())
        .unwrap_or("Ace");
    let quantifier = condition
        .params
        .get("quantifier")
        .and_then(|v| v.as_str())
        .unwrap_or("at_least");
    let value_expr =
        resolve_condition_value(&condition.params, "count", ctx, "discarded_rank_count")
            .unwrap_or_else(|| lua_int(1));

    let rank_id = rank_to_id(rank);
    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.full_hand or {{}}) do \
         if v:get_id() == {} then c = c + 1 end end return c end)()",
        rank_id
    ));

    let op = quantifier_to_op(quantifier);
    Some(comparison_op(op, count_expr, value_expr))
}

/// Enhancement Count: count of cards with a specific enhancement in hand/play.
pub fn enhancement_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let enhancement = condition
        .params
        .get("enhancement")
        .and_then(|v| v.as_str())
        .unwrap_or("any");
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "enhancement_count")?;

    let check = if enhancement == "any" {
        "v.config.center.key ~= 'c_base'".to_string()
    } else {
        format!("v.config.center.key == '{}'", enhancement)
    };

    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.scoring_hand or {{}}) do \
         if {} then c = c + 1 end end return c end)()",
        check
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

/// Edition Count: count of cards with a specific edition in hand/play.
pub fn edition_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let edition = condition
        .params
        .get("edition")
        .and_then(|v| v.as_str())
        .unwrap_or("any");
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "edition_count")?;

    let check = if edition == "any" {
        "v.edition and next(v.edition)".to_string()
    } else {
        format!("v.edition and v.edition.key == '{}'", edition)
    };

    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.scoring_hand or {{}}) do \
         if {} then c = c + 1 end end return c end)()",
        check
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

/// Seal Count: count of cards with a specific seal in hand/play.
pub fn seal_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let seal = condition
        .params
        .get("seal")
        .and_then(|v| v.as_str())
        .unwrap_or("any");
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("greater_than");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "seal_count")?;

    let check = if seal == "any" {
        "v.seal".to_string()
    } else {
        format!("v.seal == '{}'", seal)
    };

    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(context.scoring_hand or {{}}) do \
         if {} then c = c + 1 end end return c end)()",
        check
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

/// Poker Hand Been Played: check whether the current poker hand has been played before.
pub fn poker_hand_been_played(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_gt(
        lua_raw_expr("(G.GAME.hands[context.scoring_name].played or 0)"),
        lua_int(0),
    ))
}

/// First Played Hand: check whether this is the first hand played this round.
pub fn first_played_hand(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_eq(
        lua_path(&["G", "GAME", "current_round", "hands_played"]),
        lua_int(0),
    ))
}

/// First Discarded Hand: check whether this is the first discard this round.
pub fn first_discarded_hand(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_eq(
        lua_path(&["G", "GAME", "current_round", "discards_used"]),
        lua_int(0),
    ))
}

/// First/Last Scored: check whether scored card is first or last.
pub fn first_last_scored(condition: &ConditionDef) -> Option<Expr> {
    let position = condition
        .params
        .get("position")
        .and_then(|v| v.as_str())
        .unwrap_or("first");
    let check_type = condition
        .params
        .get("check_type")
        .and_then(|v| v.as_str())
        .unwrap_or("any");

    let index_expr = match position {
        "first" => "1",
        "last" => "#context.scoring_hand",
        _ => "1",
    };

    match check_type {
        "any" => Some(lua_eq(
            lua_path(&["context", "other_card"]),
            lua_raw_expr(format!("context.scoring_hand[{}]", index_expr)),
        )),
        "rank" => {
            let rank = condition
                .params
                .get("specific_rank")
                .and_then(|v| v.as_str())
                .unwrap_or("Ace");
            let rank_id = rank_to_id(rank);
            Some(lua_and(
                lua_eq(
                    lua_path(&["context", "other_card"]),
                    lua_raw_expr(format!("context.scoring_hand[{}]", index_expr)),
                ),
                lua_eq(
                    lua_method(lua_path(&["context", "other_card"]), "get_id", vec![]),
                    lua_int(rank_id.parse().unwrap_or(0)),
                ),
            ))
        }
        "suit" => {
            let suit = condition
                .params
                .get("specific_suit")
                .and_then(|v| v.as_str())
                .unwrap_or("Hearts");
            Some(lua_and(
                lua_eq(
                    lua_path(&["context", "other_card"]),
                    lua_raw_expr(format!("context.scoring_hand[{}]", index_expr)),
                ),
                lua_method(
                    lua_path(&["context", "other_card"]),
                    "is_suit",
                    vec![lua_str(suit)],
                ),
            ))
        }
        _ => Some(lua_eq(
            lua_path(&["context", "other_card"]),
            lua_raw_expr(format!("context.scoring_hand[{}]", index_expr)),
        )),
    }
}

/// Cards Selected: check count of selected/highlighted cards.
pub fn cards_selected(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = condition
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("equals");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "cards_selected")?;

    Some(comparison_op(
        operator,
        lua_len(lua_path(&["G", "hand", "highlighted"])),
        value_expr,
    ))
}

/// Hand Drawn: check whether hand has been drawn (context.first_hand_drawn).
pub fn hand_drawn(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_path(&["context", "first_hand_drawn"]))
}

/// Convert rank name to Balatro's numeric ID.
pub fn rank_id_from_name(rank: &str) -> &str {
    rank_to_id(rank)
}

fn rank_to_id(rank: &str) -> &str {
    match rank {
        "Ace" => "14",
        "King" => "13",
        "Queen" => "12",
        "Jack" => "11",
        "10" => "10",
        "9" => "9",
        "8" => "8",
        "7" => "7",
        "6" => "6",
        "5" => "5",
        "4" => "4",
        "3" => "3",
        "2" => "2",
        _ => rank,
    }
}

/// Convert quantifier to comparison operator string.
fn quantifier_to_op(quantifier: &str) -> &str {
    match quantifier {
        "all" => "equals",
        "none" => "equals",
        "exactly" => "equals",
        "at_least" => "greater_equals",
        "at_most" => "less_equals",
        _ => "greater_equals",
    }
}
