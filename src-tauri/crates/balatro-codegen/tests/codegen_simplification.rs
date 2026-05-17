mod common;

use balatro_codegen::types::{ParamValue, RuleDef};
use balatro_codegen::{compile_consumable, compile_joker, Emitter};

use common::{base_consumable, base_joker, effect, rule_with_effects};

#[test]
fn create_consumable_count_one_emits_no_loop_or_state_machine() {
    let mut consumable = base_consumable();
    consumable.rules = vec![rule_with_effects(
        "use_rule",
        "card_used",
        vec![effect(
            "create_consumable",
            &[
                ("set", ParamValue::Str("Tarot".to_string())),
                ("specific_card", ParamValue::Str("c_fool".to_string())),
                ("count", ParamValue::Int(1)),
            ],
        )],
    )];

    let output = Emitter::new().emit_chunk(&compile_consumable(&consumable, "modprefix"));

    assert!(output.contains("SMODS.add_card({ area = G.consumeables, key = 'c_fool', set = 'Tarot' })"));
    assert!(!output.contains("for _ = 1"));
    assert!(!output.contains("_jf_"));
}

#[test]
fn create_playing_cards_count_one_emits_single_add_card() {
    let mut joker = base_joker();
    joker.rules = vec![rule_with_effects(
        "rule",
        "hand_played",
        vec![effect("create_playing_cards", &[("count", ParamValue::Int(1))])],
    )];

    let output = Emitter::new().emit_chunk(&compile_joker(&joker, "modprefix"));

    assert!(output.contains("SMODS.add_card({ set = 'Base' })"));
    assert!(!output.contains("for _ = 1"));
}

#[test]
fn destroy_cards_count_one_uses_single_target_destroy() {
    let mut consumable = base_consumable();
    consumable.rules = vec![rule_with_effects(
        "use_rule",
        "card_used",
        vec![effect(
            "destroy_cards",
            &[
                ("method", ParamValue::Str("random".to_string())),
                ("count", ParamValue::Int(1)),
            ],
        )],
    )];

    let output = Emitter::new().emit_chunk(&compile_consumable(&consumable, "modprefix"));

    assert!(output.contains("SMODS.destroy_cards({c})"));
    assert!(output.contains("pseudorandom_element(G.hand.cards, pseudoseed('destroy_cards'))"));
    assert!(!output.contains("local destroyed_cards = {}"));
}

#[test]
fn draw_cards_uses_smods_helper_directly() {
    let mut joker = base_joker();
    joker.rules = vec![rule_with_effects(
        "rule",
        "hand_played",
        vec![effect("draw_cards", &[("value", ParamValue::Int(2))])],
    )];

    let output = Emitter::new().emit_chunk(&compile_joker(&joker, "modprefix"));

    assert!(output.contains("SMODS.draw_cards(card.ability.extra.card_draw0)"));
    assert!(!output.contains("if G.hand and #G.hand.cards > 0"));
}

#[test]
fn level_up_hand_uses_smods_smart_level_up_helper() {
    let mut joker = base_joker();
    joker.rules = vec![rule_with_effects(
        "rule",
        "hand_played",
        vec![effect("level_up_hand", &[("amount", ParamValue::Int(1))])],
    )];

    let output = Emitter::new().emit_chunk(&compile_joker(&joker, "modprefix"));

    assert!(output.contains("SMODS.smart_level_up_hand("));
}

#[test]
fn edit_card_random_uses_smods_poll_helpers() {
    let mut joker = base_joker();
    joker.rules = vec![rule_with_effects(
        "rule",
        "hand_played",
        vec![effect(
            "edit_card",
            &[
                ("new_enhancement", ParamValue::Str("random".to_string())),
                ("new_edition", ParamValue::Str("random".to_string())),
            ],
        )],
    )];

    let output = Emitter::new().emit_chunk(&compile_joker(&joker, "modprefix"));

    assert!(output.contains("SMODS.poll_enhancement({ key = 'edit_card_enhancement', guaranteed = true, no_replace = true })"));
    assert!(output.contains("SMODS.poll_edition({ key = 'edit_card_edition', no_negative = true, guaranteed = true })"));
}

#[test]
fn edit_cards_single_random_target_has_no_bulk_scaffolding() {
    let mut consumable = base_consumable();
    consumable.rules = vec![rule_with_effects(
        "use_rule",
        "card_used",
        vec![effect(
            "edit_cards",
            &[
                ("selection_method", ParamValue::Str("random".to_string())),
                ("count", ParamValue::Int(1)),
                ("rank", ParamValue::Str("A".to_string())),
            ],
        )],
    )];

    let output = Emitter::new().emit_chunk(&compile_consumable(&consumable, "modprefix"));

    assert!(output.contains("local _card = pseudorandom_element(G.hand.cards, pseudoseed('edit_cards'))"));
    assert!(!output.contains("local affected_cards = {}"));
    assert!(!output.contains("pseudoshuffle(temp_hand"));
}

#[test]
fn economy_effects_do_not_wrap_simple_updates_in_events() {
    let mut joker = base_joker();
    joker.rules = vec![rule_with_effects(
        "rule",
        "hand_played",
        vec![
            effect("edit_interest_cap", &[("value", ParamValue::Int(1))]),
            effect("edit_reroll_price", &[("value", ParamValue::Int(1))]),
        ],
    )];

    let output = Emitter::new().emit_chunk(&compile_joker(&joker, "modprefix"));

    assert!(output.contains("G.GAME.interest_cap = G.GAME.interest_cap + card.ability.extra.interest_cap0"));
    assert!(output.contains("G.GAME.round_resets.reroll_cost = G.GAME.round_resets.reroll_cost + card.ability.extra.reroll_cost0"));
    assert!(!output.contains("G.E_MANAGER:add_event(Event({"));
}

#[test]
fn passive_placeholder_effects_emit_no_comment_code() {
    let mut joker = base_joker();
    joker.rules = vec![
        RuleDef {
            id: "passive".to_string(),
            trigger: "passive".to_string(),
            retrigger: false,
            destroy: false,
            condition_groups: vec![],
            effects: vec![
                effect("shortcut", &[]),
                effect("showman", &[]),
                effect("combine_suits", &[]),
                effect("reduce_flush_straight_requirement", &[("reduction_value", ParamValue::Int(1))]),
            ],
            random_groups: vec![],
            loop_groups: vec![],
        },
        rule_with_effects(
            "active",
            "hand_played",
            vec![effect("add_chips", &[("value", ParamValue::Int(1))])],
        ),
    ];

    let output = Emitter::new().emit_chunk(&compile_joker(&joker, "modprefix"));

    assert!(!output.contains("-- Shortcut"));
    assert!(!output.contains("-- Showman"));
    assert!(!output.contains("-- Combine suits"));
    assert!(!output.contains("-- Flush/Straight"));
}
