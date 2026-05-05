mod common;

use balatro_codegen::types::ParamValue;
use balatro_codegen::{compile_joker, Emitter};

use common::{and_group, base_joker, condition, effect, rule_with_conditions, rule_with_effects};

#[test]
fn joker_uses_table_call_syntax_and_basic_sections() {
    let mut joker = base_joker();
    joker.key = "newjoker3".to_string();
    joker.name = "New Joker".to_string();
    joker.description = vec!["A {C:blue}custom{} joker with {C:red}unique{} effects.".to_string()];
    joker.rules = vec![rule_with_effects(
        "rule1",
        "hand_played",
        vec![effect("add_chips", &[("value", ParamValue::Int(10))])],
    )];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("SMODS.Joker {"));
    assert!(!output.contains("SMODS.Joker("));
    assert!(output.contains("['name'] = 'New Joker'"));
    assert!(output.contains("[1] = 'A {C:blue}custom{} joker"));
    assert!(output.contains("rarity = 1"));
    assert!(output.contains("config ="));
    assert!(output.contains("chips0 = 10"));
    assert!(!output.contains("SMODS.calculate_effect"));
    assert!(output.contains("return {"));
}

#[test]
fn joker_string_numeric_param_is_config_backed() {
    let mut joker = base_joker();
    joker.key = "newjoker_string_value".to_string();
    joker.rules = vec![rule_with_effects(
        "rule1",
        "hand_played",
        vec![effect(
            "add_chips",
            &[("value", ParamValue::Str("10".to_string()))],
        )],
    )];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("chips0 = 10"));
    assert!(output.contains("chips = card.ability.extra.chips0"));
    assert!(!output.contains("return { chips = 10"));
}

#[test]
fn joker_multiple_effects_nest_second_effect_under_extra() {
    let mut joker = base_joker();
    joker.key = "newjoker_multi_effect".to_string();
    joker.rules = vec![rule_with_effects(
        "rule1",
        "hand_played",
        vec![
            effect("add_chips", &[("value", ParamValue::Int(10))]),
            effect("add_mult", &[("value", ParamValue::Int(3))]),
        ],
    )];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("chips = card.ability.extra.chips0"));
    assert!(output.contains("extra = {") && output.contains("mult = card.ability.extra.mult0"));
}

#[test]
fn same_trigger_conditional_rule_runs_before_unconditional_fallback() {
    let mut joker = base_joker();
    joker.key = "j_fallback_order".to_string();
    joker.rules = vec![
        rule_with_effects(
            "fallback",
            "first_hand_drawn",
            vec![effect("add_chips", &[("value", ParamValue::Int(2))])],
        ),
        rule_with_conditions(
            "conditional",
            "first_hand_drawn",
            vec![and_group(vec![condition("first_played_hand")])],
            vec![effect("add_mult", &[("value", ParamValue::Int(7))])],
        ),
    ];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    let cond_idx = output
        .find("mult = card.ability.extra.mult0")
        .expect("expected conditional return payload");
    let fallback_idx = output
        .find("chips = card.ability.extra.chips0")
        .expect("expected fallback return payload");

    assert!(
        cond_idx < fallback_idx,
        "conditional branch should appear before unconditional fallback for same trigger"
    );
}
