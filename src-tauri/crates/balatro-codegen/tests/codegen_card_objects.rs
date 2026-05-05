mod common;

use balatro_codegen::types::{ParamValue, RarityDef};
use balatro_codegen::{
    compile_edition, compile_enhancement, compile_rarity, compile_seal, Emitter,
};

use common::{
    and_group, base_edition, base_enhancement, base_seal, condition, effect, rule_with_conditions,
    rule_with_effects,
};

#[test]
fn enhancement_compiles_and_has_calculate() {
    let mut enhancement = base_enhancement();
    enhancement.rules = vec![rule_with_effects(
        "rule1",
        "card_scored",
        vec![effect("add_chips", &[("value", ParamValue::Int(5))])],
    )];

    let chunk = compile_enhancement(&enhancement, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("SMODS.Enhancement {"));
    assert!(output.contains("calculate = function"));
}

#[test]
fn seal_compiles_and_has_calculate() {
    let mut seal = base_seal();
    seal.rules = vec![rule_with_effects(
        "rule1",
        "card_scored",
        vec![effect("add_chips", &[("value", ParamValue::Int(5))])],
    )];

    let chunk = compile_seal(&seal, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("SMODS.Seal {"));
    assert!(output.contains("calculate = function"));
}

#[test]
fn edition_compiles_and_has_calculate() {
    let mut edition = base_edition();
    edition.rules = vec![rule_with_effects(
        "rule1",
        "card_scored",
        vec![effect("add_chips", &[("value", ParamValue::Int(5))])],
    )];

    let chunk = compile_edition(&edition, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("SMODS.Edition {"));
    assert!(output.contains("calculate = function"));
}

#[test]
fn enhancement_same_trigger_conditional_precedes_unconditional_fallback() {
    let mut enhancement = base_enhancement();
    enhancement.rules = vec![
        rule_with_effects(
            "fallback",
            "card_scored",
            vec![effect("add_chips", &[("value", ParamValue::Int(2))])],
        ),
        rule_with_conditions(
            "conditional",
            "card_scored",
            vec![and_group(vec![condition("first_played_hand")])],
            vec![effect("add_mult", &[("value", ParamValue::Int(7))])],
        ),
    ];

    let chunk = compile_enhancement(&enhancement, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    let cond_idx = output
        .find("mult = card.ability.extra.mult0")
        .expect("expected conditional payload in calculate");
    let fallback_idx = output
        .find("chips = card.ability.extra.chips0")
        .expect("expected fallback payload in calculate");

    assert!(cond_idx < fallback_idx);
}

#[test]
fn seal_invalid_badge_colour_is_omitted() {
    let mut seal = base_seal();
    seal.badge_colour = Some("HEX".to_string());

    let chunk = compile_seal(&seal, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(!output.contains("badge_colour = HEX("));
}

#[test]
fn edition_invalid_badge_colour_is_omitted() {
    let mut edition = base_edition();
    edition.badge_colour = Some("HEX".to_string());

    let chunk = compile_edition(&edition, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(!output.contains("badge_colour = HEX("));
}

#[test]
fn rarity_invalid_badge_colour_falls_back_to_default() {
    let rarity = RarityDef {
        key: "superrare".to_string(),
        name: "Super Rare".to_string(),
        badge_colour: "HEX".to_string(),
        default_weight: 0.1,
    };

    let chunk = compile_rarity(&rarity, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("badge_colour = HEX('6A7A8B')"));
}
