mod common;

use balatro_codegen::types::ConsumableTypeDef;
use balatro_codegen::types::ParamValue;
use balatro_codegen::{compile_consumable, compile_consumable_type, Emitter};

use common::{
    and_group, base_consumable, condition, effect, rule_with_conditions, rule_with_effects,
};

#[test]
fn consumable_generates_calculate_and_use_hooks() {
    let mut consumable = base_consumable();
    consumable.rules = vec![
        rule_with_effects(
            "calc_rule",
            "hand_played",
            vec![effect("add_chips", &[("value", ParamValue::Int(2))])],
        ),
        rule_with_effects(
            "use_rule",
            "card_used",
            vec![effect("add_mult", &[("value", ParamValue::Int(3))])],
        ),
    ];

    let chunk = compile_consumable(&consumable, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("SMODS.Consumable {"));
    assert!(output.contains("calculate = function"));
    assert!(output.contains("use = function"));
}

#[test]
fn consumable_with_only_card_used_rules_skips_calculate() {
    let mut consumable = base_consumable();
    consumable.rules = vec![rule_with_effects(
        "use_rule",
        "card_used",
        vec![effect("add_chips", &[("value", ParamValue::Int(2))])],
    )];

    let chunk = compile_consumable(&consumable, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("use = function"));
    assert!(!output.contains("calculate = function"));
}

#[test]
fn consumable_card_used_conditional_precedes_unconditional_fallback() {
    let mut consumable = base_consumable();
    consumable.rules = vec![
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

    let chunk = compile_consumable(&consumable, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    let cond_idx = output
        .find("mult = card.ability.extra.mult0")
        .expect("expected conditional payload in use function");
    let fallback_idx = output
        .find("chips = card.ability.extra.chips0")
        .expect("expected fallback payload in use function");

    assert!(cond_idx < fallback_idx);
}

#[test]
fn consumable_type_invalid_colours_fall_back_to_safe_default() {
    let ct = ConsumableTypeDef {
        key: "coolset".to_string(),
        name: "Cool Set".to_string(),
        collection_name: Some("Cool Cards".to_string()),
        primary_colour: "HEX".to_string(),
        secondary_colour: "not-a-colour".to_string(),
        collection_rows: (4, 5),
        default_card: None,
        shop_rate: Some(1.0),
    };

    let chunk = compile_consumable_type(&ct, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("primary_colour = HEX('666666')"));
    assert!(output.contains("secondary_colour = HEX('666666')"));
}
