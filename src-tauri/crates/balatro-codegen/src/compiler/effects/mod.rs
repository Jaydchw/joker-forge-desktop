pub mod card_transform;
pub mod creation;
pub mod deck_setup;
pub mod destruction;
pub mod economy;
pub mod misc;
pub mod passive;
pub mod scoring;
pub mod slot_management;
pub mod utils;
pub mod variables;

use crate::compiler::context::CompileContext;
use crate::lua_ast::*;
use crate::types::EffectDef;

/// The output of compiling a single effect.
#[derive(Debug, Default)]
pub struct EffectOutput {
    /// Key-value pairs to include in the `return { ... }` table.
    /// e.g., `[("chips": Expr::Int(50))]`
    pub return_fields: Vec<(String, Expr)>,

    /// Statements to execute before the return statement.
    /// Used for event queuing, card creation, variable mutation: etc.
    pub pre_return: Vec<Stmt>,

    /// Config variables to register (already tracked via CompileContext,
    /// but can be used for additional effect-local vars).
    pub config_vars: Vec<crate::types::ConfigVar>,

    /// Optional message expression for the effect.
    pub message: Option<Expr>,

    /// Optional colour expression (e.g.: `G.C.CHIPS`).
    pub colour: Option<Expr>,

    /// Optional source segment id used by preview highlighting.
    pub segment_id: Option<String>,
}

/// Compile a single effect into its Lua AST representation.
///
/// Returns `None` for unknown/unimplemented effect types.
pub fn compile_effect(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    trigger: &str,
) -> Option<EffectOutput> {
    let result = match effect.effect_type.as_str() {
        // --------------- Scoring ---------------
        "add_chips" => scoring::add_chips(effect, ctx),
        "add_mult" => scoring::add_mult(effect, ctx),
        "apply_x_mult" => scoring::apply_x_mult(effect, ctx),
        "apply_x_chips" => scoring::apply_x_chips(effect, ctx),
        "apply_exp_chips" => scoring::apply_exp_chips(effect, ctx),
        "apply_exp_mult" => scoring::apply_exp_mult(effect, ctx),
        "apply_hyper_chips" => scoring::apply_hyper_chips(effect, ctx),
        "apply_hyper_mult" => scoring::apply_hyper_mult(effect, ctx),
        "balance_chips_and_mult" | "balance_chips_mult" | "balance" => {
            scoring::balance_chips_and_mult(effect, ctx)
        }
        "swap_chips_and_mult" | "swap_chips_mult" | "swap" => {
            scoring::swap_chips_and_mult(effect, ctx)
        }

        // --------------- Creation ---------------
        "create_joker" => creation::create_joker(effect, ctx),
        "create_consumable" | "add_consumable" => creation::create_consumable(effect, ctx),
        "create_playing_card" => creation::create_playing_card(effect, ctx),
        "create_playing_cards" => creation::create_playing_cards(effect, ctx),
        "create_tag" => creation::create_tag(effect, ctx),
        "create_copy_triggered_card" => creation::create_copy_triggered_card(effect, ctx, trigger),
        "create_copy_played_card" => creation::create_copy_played_card(effect, ctx, trigger),
        "create_last_played_planet" => creation::create_last_played_planet(effect, ctx),
        "copy_selected_cards" => creation::copy_selected_cards(effect, ctx),

        // --------------- Deck run-start setup ---------------
        "edit_starting_dollars" => deck_setup::edit_starting_dollars(effect, ctx),
        "add_starting_cards" => deck_setup::add_starting_cards(effect, ctx),
        "edit_all_starting_cards" => deck_setup::edit_all_starting_cards(effect, ctx),
        "edit_starting_suits" => deck_setup::edit_starting_suits(effect, ctx),
        "edit_starting_ranks" => deck_setup::edit_starting_ranks(effect, ctx),
        "remove_starting_cards" => deck_setup::remove_starting_cards(effect, ctx),

        // --------------- Destruction ---------------
        "destroy_card" | "destroy_playing_card" => destruction::destroy_card(effect, ctx, trigger),
        "destroy_joker" => destruction::destroy_joker(effect, ctx),
        "destroy_consumable" => destruction::destroy_consumable(effect, ctx),
        "destroy_cards" => destruction::destroy_cards(effect, ctx),

        // --------------- Card Transform ---------------
        "edit_card" | "edit_playing_card" => card_transform::edit_card(effect, ctx, trigger),
        "convert_all_cards_to_rank" => card_transform::convert_all_cards_to_rank(effect, ctx),
        "convert_all_cards_to_suit" => card_transform::convert_all_cards_to_suit(effect, ctx),
        "increment_rank" => card_transform::increment_rank(effect, ctx),
        "convert_left_to_right" => card_transform::convert_left_to_right(effect, ctx),

        // --------------- Slot Management ---------------
        "edit_joker_slots" => slot_management::edit_joker_slots(effect, ctx),
        "edit_joker_size" => slot_management::edit_joker_size(effect, ctx),
        "edit_consumable_slots" => slot_management::edit_consumable_slots(effect, ctx),
        "edit_hand_size" => slot_management::edit_item_size_typed(effect, ctx, "hand_size"),
        "edit_play_size" => slot_management::edit_item_size_typed(effect, ctx, "play_size"),
        "edit_discard_size" => slot_management::edit_item_size_typed(effect, ctx, "discard_size"),
        "edit_voucher_slots" => slot_management::edit_item_size_typed(effect, ctx, "voucher_slots"),
        "edit_booster_slots" => slot_management::edit_item_size_typed(effect, ctx, "booster_slots"),
        "edit_shop_slots" => slot_management::edit_item_size_typed(effect, ctx, "shop_slots"),
        "edit_hands" => slot_management::edit_round_counter_typed(effect, ctx, "hands"),
        "edit_discards" => slot_management::edit_round_counter_typed(effect, ctx, "discards"),

        // --------------- Economy ---------------
        "edit_reroll_price" => economy::edit_reroll_price(effect, ctx),
        "edit_interest_cap" => economy::edit_interest_cap(effect, ctx),
        "discount_items" => economy::discount_items(effect, ctx),
        "edit_item_weight" | "edit_rarity_weight" => economy::edit_item_weight(effect, ctx),
        "edit_win_ante" | "edit_winner_ante" => economy::edit_winner_ante(effect, ctx, trigger),
        "edit_hands_money" | "edit_end_round_hand_money" => {
            economy::edit_end_round_hand_money(effect, ctx)
        }
        "edit_discards_money" | "edit_end_round_discard_money" => {
            economy::edit_end_round_discard_money(effect, ctx)
        }
        "free_rerolls" => misc::free_rerolls(effect, ctx),

        // --------------- Economy (dollars) ---------------
        "set_dollars" => misc::set_dollars(effect, ctx),
        "set_sell_value" => misc::set_sell_value(effect, ctx),

        // --------------- Retrigger ---------------
        "retrigger" | "retrigger_playing_card" | "retrigger_cards" => misc::retrigger(effect, ctx),

        // --------------- Display ---------------
        "show_message" => misc::show_message(effect, ctx),
        "show_special_message" | "special_message" | "attention_text" => {
            misc::show_special_message(effect, ctx)
        }
        "play_sound" => misc::play_sound(effect, ctx),
        "juice_up_joker" => misc::juice_up_joker(effect, ctx),
        "juice_up_card" => misc::juice_up_card(effect, ctx),

        // --------------- Game State ---------------
        "level_up_hand" => misc::level_up_hand(effect, ctx),
        "edit_blind_size" => misc::edit_blind_size(effect, ctx),
        "set_ante" => misc::set_ante(effect, ctx),
        "disable_boss_blind" => misc::disable_boss_blind(effect, ctx),
        "force_game_over" => misc::force_game_over(effect, ctx),
        "win_game" => misc::win_game(effect, ctx),
        "crash_game" => misc::crash_game(effect, ctx),

        // --------------- Utility ---------------
        "shuffle_jokers" => misc::shuffle_jokers(effect, ctx),
        "flip_joker" => misc::flip_joker(effect, ctx),
        "copy_joker" => misc::copy_joker(effect, ctx, trigger),
        "copy_consumable" => misc::copy_consumable(effect, ctx, trigger),
        "draw_cards" => misc::draw_cards(effect, ctx),
        "emit_flag" => misc::emit_flag(effect, ctx),
        "add_booster_into_shop" | "add_booster_to_shop" | "add_booster_shop" => {
            misc::add_booster_into_shop(effect, ctx)
        }
        "add_voucher_into_shop" | "add_voucher_to_shop" | "add_voucher_shop" => {
            misc::add_voucher_into_shop(effect, ctx)
        }
        "edit_card_appearance" => misc::edit_card_appearance(effect, ctx),

        // --------------- New game state effects ---------------
        "edit_game_speed" | "change_game_speed" => misc::edit_game_speed(effect, ctx),
        "fix_probability" => misc::fix_probability(effect, ctx),
        "mod_probability" => misc::mod_probability(effect, ctx),
        "modify_blind_requirement" => misc::modify_blind_requirement(effect, ctx),
        "modify_all_blinds_requirement" => misc::modify_all_blinds_requirement(effect, ctx),
        "permanent_bonus" | "perma_bonus" => misc::permanent_bonus(effect, ctx),
        "redeem_voucher" => misc::redeem_voucher(effect, ctx),
        "unlock_joker" => misc::unlock_joker(effect, ctx),
        "saved" | "saved_effect" | "prevent_game_over" => misc::saved_effect(effect, ctx),
        "edit_joker" => misc::edit_joker(effect, ctx),
        "edit_booster_packs" => misc::edit_booster_packs(effect, ctx),
        "fool_effect" | "fool" => misc::fool_effect(effect, ctx),
        "edit_cards" => misc::edit_cards(effect, ctx),

        // --------------- Variable effects ---------------
        "modify_internal_variable" => variables::modify_internal_variable(effect, ctx, trigger),
        "change_key_variable" => variables::change_key_variable(effect, ctx),
        "change_text_variable" => variables::change_text_variable(effect, ctx),
        "change_rank_variable" => variables::change_rank_variable(effect, ctx),
        "change_suit_variable" => variables::change_suit_variable(effect, ctx),
        "change_poker_hand_variable" | "change_pokerhand_variable" => {
            variables::change_poker_hand_variable(effect, ctx)
        }

        _ => {
            return None;
        }
    };

    Some(result)
}

/// Build the combined return statement from multiple effect outputs.
///
/// Merges all return fields into a single table: collects pre-return code,
/// and adds SMODS.calculate_effect wrapping where needed.
pub fn build_return_block(effects: &[EffectOutput]) -> Vec<Stmt> {
    let mut stmts: Vec<Stmt> = Vec::new();

    // Collect pre-return code from all effects
    for eff in effects {
        if let Some(segment_id) = &eff.segment_id {
            stmts.push(stmt_section_begin(segment_id));
            stmts.extend(eff.pre_return.clone());
            stmts.push(stmt_section_end(segment_id));
        } else {
            stmts.extend(eff.pre_return.clone());
        }
    }

    // Keep only effects that contribute return-table content.
    let content_effects: Vec<&EffectOutput> = effects
        .iter()
        .filter(|eff| {
            !eff.return_fields.is_empty() || eff.message.is_some() || eff.colour.is_some()
        })
        .collect();

    if let Some((first, rest)) = content_effects.split_first() {
        let mut root_entries = effect_entries(first);

        // Chain additional effects through nested `extra = { ... }` tables:
        // return { first..., extra = { second..., extra = { third... } } }
        if !rest.is_empty() {
            let mut nested_extra = lua_table_raw(effect_entries(rest[rest.len() - 1]));
            if rest.len() > 1 {
                for eff in rest[..rest.len() - 1].iter().rev() {
                    let mut entries = effect_entries(eff);
                    entries.push(TableEntry::KeyValue("extra".to_string(), nested_extra));
                    nested_extra = lua_table_raw(entries);
                }
            }
            root_entries.push(TableEntry::KeyValue("extra".to_string(), nested_extra));
        }

        stmts.push(lua_return(lua_table_raw(root_entries)));
    }

    stmts
}

fn effect_entries(effect: &EffectOutput) -> Vec<TableEntry> {
    let mut entries: Vec<TableEntry> = Vec::new();

    if let Some(segment_id) = &effect.segment_id {
        entries.push(section_begin(segment_id));
    }

    for (key, val) in &effect.return_fields {
        entries.push(TableEntry::KeyValue(key.clone(), val.clone()));
    }

    if let Some(msg) = &effect.message {
        entries.push(TableEntry::KeyValue("message".to_string(), msg.clone()));
    }

    if let Some(col) = &effect.colour {
        entries.push(TableEntry::KeyValue("colour".to_string(), col.clone()));
    }

    if let Some(segment_id) = &effect.segment_id {
        entries.push(section_end(segment_id));
    }

    entries
}
