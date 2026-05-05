mod common;

use balatro_codegen::types::ParamValue;
use balatro_codegen::{compile_deck, Emitter};

use common::{and_group, base_deck, condition, effect, rule_with_conditions, rule_with_effects};

#[test]
fn deck_generates_calculate_and_apply_hooks() {
    let mut deck = base_deck();
    deck.rules = vec![
        rule_with_effects(
            "calc_rule",
            "hand_played",
            vec![effect("add_chips", &[("value", ParamValue::Int(2))])],
        ),
        rule_with_effects(
            "apply_rule",
            "card_used",
            vec![effect("add_mult", &[("value", ParamValue::Int(3))])],
        ),
    ];

    let chunk = compile_deck(&deck, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("SMODS.Back {"));
    assert!(output.contains("calculate = function"));
    assert!(output.contains("apply = function"));
}

#[test]
fn deck_card_used_conditional_precedes_unconditional_fallback() {
    let mut deck = base_deck();
    deck.rules = vec![
        rule_with_effects(
            "fallback",
            "card_used",
            vec![effect("add_chips", &[("value", ParamValue::Int(2))])],
        ),
        rule_with_conditions(
            "conditional",
            "card_used",
            vec![and_group(vec![condition("first_played_hand")])],
            vec![effect("add_mult", &[("value", ParamValue::Int(7))])],
        ),
    ];

    let chunk = compile_deck(&deck, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    let cond_idx = output
        .find("mult = back.ability.extra.mult0")
        .expect("expected conditional payload in apply function");
    let fallback_idx = output
        .find("chips = back.ability.extra.chips0")
        .expect("expected fallback payload in apply function");

    assert!(cond_idx < fallback_idx);
}
