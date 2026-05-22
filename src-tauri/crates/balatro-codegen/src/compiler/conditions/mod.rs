pub mod card;
pub mod game_state;
pub mod hand;
pub mod joker;
pub mod utils;
pub mod variables;

use crate::compiler::context::CompileContext;
use crate::lua_ast::*;
use crate::types::{ConditionDef, ConditionGroupDef, LogicOp, ObjectType};

/// Compile a single condition into a Lua boolean expression.
///
/// Accepts a mutable compile context so that numeric condition parameters
/// are automatically registered in `config.extra` and referenced via
/// `card.ability.extra.<var>`, keeping them in sync with `loc_vars`.
pub fn compile_condition(
    condition: &ConditionDef,
    _object_type: ObjectType,
    ctx: &mut CompileContext,
) -> Option<Expr> {
    let expr = match condition.condition_type.as_str() {
        // Hand conditions
        "hand_type" => hand::hand_type(condition)?,
        "hand_count" => hand::hand_count(condition, ctx)?,
        "hand_size" => hand::hand_size(condition, ctx)?,
        "suit_count" => hand::suit_count(condition, ctx)?,
        "rank_count" => hand::rank_count(condition, ctx)?,
        "hand_level" => hand::hand_level(condition, ctx)?,
        "discarded_card_count" | "discarded_hand_count" => {
            hand::discarded_card_count(condition, ctx)?
        }
        "discarded_suit_count" => hand::discarded_suit_count(condition, ctx)?,
        "discarded_rank_count" => hand::discarded_rank_count(condition, ctx)?,
        "enhancement_count" | "hand_enhancement_count" => hand::enhancement_count(condition, ctx)?,
        "edition_count" | "hand_edition_count" => hand::edition_count(condition, ctx)?,
        "seal_count" | "hand_seal_count" => hand::seal_count(condition, ctx)?,
        "poker_hand_been_played" => hand::poker_hand_been_played(condition)?,
        "first_played_hand" => hand::first_played_hand(condition)?,
        "first_discarded_hand" => hand::first_discarded_hand(condition)?,
        "first_last_scored" => hand::first_last_scored(condition)?,
        "cards_selected" => hand::cards_selected(condition, ctx)?,
        "hand_drawn" => hand::hand_drawn(condition)?,

        // Card conditions
        "card_rank" => card::card_rank(condition)?,
        "card_suit" => card::card_suit(condition)?,
        "card_enhancement" => card::card_enhancement(condition)?,
        "card_edition" => card::card_edition(condition)?,
        "card_seal" => card::card_seal(condition)?,
        "card_index" => card::card_index(condition, ctx)?,

        // Joker conditions
        "specific_joker" | "specific_joker_owned" | "owned_joker" => {
            joker::specific_joker_owned(condition)?
        }
        "joker_rarity_count" => joker::joker_rarity_count(condition, ctx)?,
        "joker_position" => joker::joker_position(condition, ctx)?,
        "joker_index" => joker::joker_index(condition, ctx)?,
        "this_joker_index" => joker::this_joker_index(condition, ctx)?,
        "joker_flipped" => joker::joker_flipped(condition)?,
        "this_joker_flipped" => joker::this_joker_flipped(condition)?,
        "joker_selected" => joker::joker_selected(condition)?,
        "joker_sticker" => joker::joker_sticker(condition)?,
        "this_joker_sticker" => joker::this_joker_sticker(condition)?,
        "joker_edition" => joker::joker_edition(condition)?,
        "this_joker_edition" => joker::this_joker_edition(condition)?,
        "joker_key" => joker::joker_key(condition)?,
        "joker_rarity" => joker::joker_rarity(condition)?,

        // Game state conditions
        "ante_level" => game_state::ante_level(condition, ctx)?,
        "blind_type" => game_state::blind_type(condition)?,
        "boss_blind_type" => game_state::boss_blind_type(condition)?,
        "blind_name" => game_state::blind_name(condition)?,
        "blind_requirements" | "check_blind_requirements" => {
            game_state::check_blind_requirements(condition, ctx)?
        }
        "player_money" => game_state::player_money(condition, ctx)?,
        "remaining_hands" => game_state::remaining_hands(condition, ctx)?,
        "remaining_discards" => game_state::remaining_discards(condition, ctx)?,
        "joker_count" => game_state::joker_count(condition, ctx)?,
        "consumable_count" => game_state::consumable_count(condition, ctx)?,
        "deck_size" => game_state::deck_size(condition, ctx)?,
        "check_deck" => game_state::check_deck(condition)?,
        "deck_count" => game_state::deck_count(condition, ctx)?,
        "in_blind" => game_state::in_blind(condition)?,
        "game_speed" => game_state::game_speed(condition)?,
        "triggered_boss_blind" => game_state::triggered_boss_blind(condition)?,
        "check_flag" => game_state::check_flag(condition)?,
        "which_tag" => game_state::which_tag(condition)?,
        "consumable_type" => game_state::consumable_type(condition)?,
        "voucher_redeemed" => game_state::voucher_redeemed(condition)?,
        "system_condition" => game_state::system_condition(condition)?,
        "glass_card_destroyed" => game_state::glass_card_destroyed(condition)?,
        "lucky_card_triggered" => game_state::lucky_card_triggered(condition)?,
        "probability_identifier" => game_state::probability_identifier(condition)?,
        "probability_part_compare" => game_state::probability_part_compare(condition, ctx)?,
        "probability_succeeded" => game_state::probability_succeeded(condition)?,
        "booster_pack_type" | "booster_type" => game_state::booster_type(condition)?,

        // Variable conditions
        "internal_variable" => variables::internal_variable(condition, ctx)?,
        "key_variable" => variables::key_variable(condition, ctx)?,
        "text_variable" => variables::text_variable(condition, ctx)?,
        "poker_hand_variable" | "pokerhand_variable" => {
            variables::poker_hand_variable(condition, ctx)?
        }
        "rank_variable" => variables::rank_variable(condition, ctx)?,
        "suit_variable" => variables::suit_variable(condition, ctx)?,

        // Generic compare
        "generic_compare" => game_state::generic_compare(condition)?,
        _ => {
            return None;
        }
    };

    // Apply negation
    let expr = if condition.negate {
        lua_not(expr)
    } else {
        expr
    };

    Some(expr)
}

/// Compile a full condition chain from condition groups.
///
/// Within each group, conditions are joined by per-condition operators
/// (falling back to the group operator). Between groups, the operator
/// is taken from the *preceding* group, matching the rule-builder UI
/// where the toggle appears between group blocks.
pub fn compile_condition_chain(
    groups: &[ConditionGroupDef],
    object_type: ObjectType,
    ctx: &mut CompileContext,
) -> Option<Expr> {
    if groups.is_empty() {
        return None;
    }

    let compiled_groups: Vec<(Expr, LogicOp)> = groups
        .iter()
        .filter_map(|group| {
            compile_condition_group(group, object_type, ctx)
                .map(|expr| (expr, group.logic_operator))
        })
        .collect();

    if compiled_groups.is_empty() {
        return None;
    }

    let mut iter = compiled_groups.into_iter();
    let (mut combined, mut pending_group_op) = iter.next()?;
    for (next_expr, next_group_op) in iter {
        combined = match pending_group_op {
            LogicOp::And => lua_and(combined, next_expr),
            LogicOp::Or => lua_or(combined, next_expr),
        };
        pending_group_op = next_group_op;
    }

    Some(combined)
}

/// Compile a single condition group.
fn compile_condition_group(
    group: &ConditionGroupDef,
    object_type: ObjectType,
    ctx: &mut CompileContext,
) -> Option<Expr> {
    if group.conditions.is_empty() {
        return None;
    }

    let mut compiled: Vec<(Expr, Option<LogicOp>)> = Vec::new();
    for condition in &group.conditions {
        if let Some(expr) = compile_condition(condition, object_type, ctx) {
            compiled.push((expr, condition.operator));
        }
    }

    if compiled.is_empty() {
        return None;
    }

    let mut iter = compiled.into_iter();
    let (mut combined, mut pending_op) = iter.next()?;

    for (expr, next_op) in iter {
        let op = pending_op.unwrap_or(group.logic_operator);
        combined = match op {
            LogicOp::And => lua_and(combined, expr),
            LogicOp::Or => lua_or(combined, expr),
        };
        pending_op = next_op;
    }

    Some(combined)
}
