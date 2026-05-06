mod common;

use balatro_codegen::types::ParamValue;
use balatro_codegen::types::{ConditionDef, ConditionGroupDef, LogicOp, RuleDef, TypedValue};
use balatro_codegen::{compile_joker, Emitter};
use serde_json::json;

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

#[test]
fn rank_count_group_with_typed_params_emits_condition_and_no_object_artifacts() {
    let mut joker = base_joker();
    joker.key = "j_rank_group_typed".to_string();

    let condition = ConditionDef {
        condition_type: "rank_count".to_string(),
        negate: false,
        operator: None,
        params: std::collections::HashMap::from([
            (
                "card_scope".to_string(),
                ParamValue::Typed(TypedValue {
                    value: json!("all_played"),
                    value_type: "unknown".to_string(),
                }),
            ),
            (
                "rank_type".to_string(),
                ParamValue::Typed(TypedValue {
                    value: json!("group"),
                    value_type: "unknown".to_string(),
                }),
            ),
            (
                "rank_group".to_string(),
                ParamValue::Typed(TypedValue {
                    value: json!("odd"),
                    value_type: "unknown".to_string(),
                }),
            ),
            (
                "quantifier".to_string(),
                ParamValue::Typed(TypedValue {
                    value: json!("all"),
                    value_type: "unknown".to_string(),
                }),
            ),
            (
                "count".to_string(),
                ParamValue::Typed(TypedValue {
                    value: json!(1),
                    value_type: "number".to_string(),
                }),
            ),
            (
                "specific_rank".to_string(),
                ParamValue::Typed(TypedValue {
                    value: json!({ "valueType": "unknown" }),
                    value_type: "object".to_string(),
                }),
            ),
        ]),
    };

    let conditional_rule = RuleDef {
        id: "rule_cond".to_string(),
        trigger: "hand_played".to_string(),
        retrigger: false,
        destroy: false,
        condition_groups: vec![ConditionGroupDef {
            logic_operator: LogicOp::And,
            conditions: vec![condition],
        }],
        effects: vec![
            effect(
                "modify_internal_variable",
                &[
                    ("variable_name", ParamValue::Str("Oddities".to_string())),
                    ("operation", ParamValue::Str("increment".to_string())),
                    ("value", ParamValue::Float(0.25)),
                ],
            ),
            effect(
                "apply_x_mult",
                &[("value", ParamValue::Str("Oddities".to_string()))],
            ),
        ],
        random_groups: vec![],
        loop_groups: vec![],
    };

    let fallback_rule = rule_with_effects(
        "rule_fallback",
        "hand_played",
        vec![effect(
            "apply_x_mult",
            &[("value", ParamValue::Str("Oddities".to_string()))],
        )],
    );

    joker.rules = vec![conditional_rule, fallback_rule];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("playing_card:get_id() == 14"));
    assert!(output.contains("if (function()"));
    assert!(output.contains("context.full_hand"));
    assert!(output.contains("else"));
    assert!(!output.contains("[object Object]"));
}

#[test]
fn joker_index_variants_target_other_and_self_joker() {
    let mut joker = base_joker();
    joker.key = "j_joker_index_targets".to_string();

    let mut other_cond = condition("joker_index");
    other_cond.params = std::collections::HashMap::from([(
        "position".to_string(),
        ParamValue::Str("first".to_string()),
    )]);

    let mut self_cond = condition("this_joker_index");
    self_cond.params = std::collections::HashMap::from([(
        "position".to_string(),
        ParamValue::Str("first".to_string()),
    )]);

    joker.rules = vec![
        rule_with_conditions(
            "other_idx",
            "joker_evaluated",
            vec![and_group(vec![other_cond])],
            vec![effect("add_mult", &[("value", ParamValue::Int(1))])],
        ),
        rule_with_conditions(
            "self_idx",
            "joker_evaluated",
            vec![and_group(vec![self_cond])],
            vec![effect("add_chips", &[("value", ParamValue::Int(1))])],
        ),
    ];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("context.other_joker"));
    assert!(output.contains("G.jokers.cards[1]"));
    assert!(
        output.contains("card == G.jokers.cards[1]")
            || output.contains("G.jokers.cards[1] == card")
    );
}

#[test]
fn effect_alias_ids_compile_to_expected_lua() {
    let mut joker = base_joker();
    joker.key = "j_effect_aliases".to_string();
    joker.rules = vec![rule_with_effects(
        "rule_aliases",
        "hand_played",
        vec![
            effect("balance_chips_mult", &[]),
            effect("swap_chips_mult", &[]),
            effect("add_booster_shop", &[]),
            effect("add_voucher_shop", &[]),
            effect(
                "change_game_speed",
                &[("speed", ParamValue::Str("2".to_string()))],
            ),
            effect("free_rerolls", &[("value", ParamValue::Int(2))]),
            effect("prevent_game_over", &[]),
        ],
    )];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("balance = true"));
    assert!(output.contains("swap = true"));
    assert!(output.contains("SMODS.add_booster_to_shop("));
    assert!(output.contains("SMODS.add_voucher_to_shop("));
    assert!(output.contains("G.SETTINGS.GAMESPEED = 2"));
    assert!(output.contains("SMODS.change_free_rerolls(card.ability.extra.reroll_amount0)"));
    assert!(output.contains("saved = true"));
}

#[test]
fn passive_aliases_use_catalog_parameter_names() {
    let mut joker = base_joker();
    joker.key = "j_passive_aliases".to_string();

    joker.rules = vec![
        RuleDef {
            id: "passive_aliases".to_string(),
            trigger: "passive".to_string(),
            retrigger: false,
            destroy: false,
            condition_groups: vec![],
            effects: vec![
                effect("splash_effect", &[]),
                effect("allow_debt", &[("value", ParamValue::Int(20))]),
                effect("free_rerolls", &[("value", ParamValue::Int(3))]),
            ],
            random_groups: vec![],
            loop_groups: vec![],
        },
        rule_with_effects(
            "seed_calculate",
            "hand_played",
            vec![effect("add_chips", &[("value", ParamValue::Int(1))])],
        ),
    ];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains("context.modify_scoring_hand"));
    assert!(output
        .contains("G.GAME.bankrupt_at = G.GAME.bankrupt_at - card.ability.extra.debt_amount0"));
    assert!(output.contains("SMODS.change_free_rerolls(card.ability.extra.reroll_amount0)"));
}

#[test]
fn edit_hands_and_discards_ids_compile_for_active_and_passive_rules() {
    let mut joker = base_joker();
    joker.key = "j_edit_hands_discards".to_string();

    joker.rules = vec![
        rule_with_effects(
            "active_hands",
            "hand_played",
            vec![effect(
                "edit_hands",
                &[
                    ("operation", ParamValue::Str("add".to_string())),
                    ("duration", ParamValue::Str("round".to_string())),
                    ("value", ParamValue::Int(2)),
                ],
            )],
        ),
        RuleDef {
            id: "passive_discards".to_string(),
            trigger: "passive".to_string(),
            retrigger: false,
            destroy: false,
            condition_groups: vec![],
            effects: vec![effect(
                "edit_discards",
                &[
                    ("operation", ParamValue::Str("add".to_string())),
                    ("value", ParamValue::Int(1)),
                ],
            )],
            random_groups: vec![],
            loop_groups: vec![],
        },
    ];

    let chunk = compile_joker(&joker, "modprefix");
    let output = Emitter::new().emit_chunk(&chunk);

    assert!(output.contains(
        "G.GAME.current_round.hands_left = G.GAME.current_round.hands_left + card.ability.extra.hands0"
    ));
    assert!(output
        .contains("G.GAME.round_resets.discards = G.GAME.round_resets.discards + card.ability.extra.discards_change0"));
}
