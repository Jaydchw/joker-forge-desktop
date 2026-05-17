use super::*;

fn make_rule_output(
    rule_id: &str,
    trigger: &str,
    condition_expr: Option<Expr>,
    message: &str,
) -> RuleOutput {
    RuleOutput {
        rule_id: rule_id.to_string(),
        trigger: trigger.to_string(),
        condition_expr,
        condition_segment_ids: vec![],
        effect_stmts: vec![lua_return(lua_table(vec![("message", lua_str(message))]))],
        is_passive: false,
        passive_outputs: vec![],
        passive_hooks: vec![],
        has_retrigger: false,
        has_destroy: false,
        blind_rewards: vec![],
    }
}

fn index_of(haystack: &str, needle: &str) -> usize {
    haystack
        .find(needle)
        .unwrap_or_else(|| panic!("Expected '{needle}' in:\n{haystack}"))
}

#[test]
fn rule_chain_places_conditional_before_unconditional_fallback() {
    let fallback = make_rule_output("r_fallback", "hand_played", None, "FALLBACK");
    let conditional = make_rule_output(
        "r_cond",
        "hand_played",
        Some(lua_path(&["context", "cond_a"])),
        "COND",
    );

    let rules = vec![&fallback, &conditional];
    let mut out = Vec::new();
    append_rule_chain_with_fallback(&mut out, &rules, |ro| ro.effect_stmts.clone());

    let code = Emitter::new().emit_stmts(&out);
    assert!(code.contains("if context.cond_a then"));
    assert!(code.contains("else"));
    assert!(index_of(&code, "message = 'COND'") < index_of(&code, "message = 'FALLBACK'"));
}

#[test]
fn rule_chain_keeps_conditional_order_then_fallback() {
    let fallback = make_rule_output("r_fallback", "hand_played", None, "FALLBACK");
    let cond_1 = make_rule_output(
        "r_cond_1",
        "hand_played",
        Some(lua_path(&["context", "cond_1"])),
        "COND_1",
    );
    let cond_2 = make_rule_output(
        "r_cond_2",
        "hand_played",
        Some(lua_path(&["context", "cond_2"])),
        "COND_2",
    );

    let rules = vec![&fallback, &cond_1, &cond_2];
    let mut out = Vec::new();
    append_rule_chain_with_fallback(&mut out, &rules, |ro| ro.effect_stmts.clone());

    let code = Emitter::new().emit_stmts(&out);
    let cond_1_idx = index_of(&code, "message = 'COND_1'");
    let cond_2_idx = index_of(&code, "message = 'COND_2'");
    let fallback_idx = index_of(&code, "message = 'FALLBACK'");
    assert!(cond_1_idx < cond_2_idx);
    assert!(cond_2_idx < fallback_idx);
}

#[test]
fn rule_chain_moves_all_unconditional_rules_to_fallback_tail() {
    let fallback_1 = make_rule_output("r_fallback_1", "hand_played", None, "FALLBACK_1");
    let cond = make_rule_output(
        "r_cond",
        "hand_played",
        Some(lua_path(&["context", "cond_a"])),
        "COND",
    );
    let fallback_2 = make_rule_output("r_fallback_2", "hand_played", None, "FALLBACK_2");

    let rules = vec![&fallback_1, &cond, &fallback_2];
    let mut out = Vec::new();
    append_rule_chain_with_fallback(&mut out, &rules, |ro| ro.effect_stmts.clone());

    let code = Emitter::new().emit_stmts(&out);
    let cond_idx = index_of(&code, "message = 'COND'");
    let fb_1_idx = index_of(&code, "message = 'FALLBACK_1'");
    let fb_2_idx = index_of(&code, "message = 'FALLBACK_2'");
    assert!(cond_idx < fb_1_idx);
    assert!(fb_1_idx < fb_2_idx);
}

#[test]
fn rule_chain_preserves_order_when_all_rules_unconditional() {
    let first = make_rule_output("r_first", "hand_played", None, "FIRST");
    let second = make_rule_output("r_second", "hand_played", None, "SECOND");

    let rules = vec![&first, &second];
    let mut out = Vec::new();
    append_rule_chain_with_fallback(&mut out, &rules, |ro| ro.effect_stmts.clone());

    let code = Emitter::new().emit_stmts(&out);
    assert!(!code.contains("if context."));
    assert!(index_of(&code, "message = 'FIRST'") < index_of(&code, "message = 'SECOND'"));
}

#[test]
fn rule_chain_with_only_conditionals_has_no_unconditional_fallback() {
    let cond_1 = make_rule_output(
        "r_cond_1",
        "hand_played",
        Some(lua_path(&["context", "cond_1"])),
        "COND_1",
    );
    let cond_2 = make_rule_output(
        "r_cond_2",
        "hand_played",
        Some(lua_path(&["context", "cond_2"])),
        "COND_2",
    );

    let rules = vec![&cond_1, &cond_2];
    let mut out = Vec::new();
    append_rule_chain_with_fallback(&mut out, &rules, |ro| ro.effect_stmts.clone());

    let code = Emitter::new().emit_stmts(&out);
    assert!(code.contains("if context.cond_1 then"));
    assert!(code.contains("if context.cond_2 then"));
    assert!(!code.contains("FALLBACK"));
}

#[test]
fn shared_calculate_groups_same_trigger_with_fallback_order() {
    let ctx = CompileContext::new(
        ObjectType::Consumable,
        "mod".to_string(),
        "c_test".to_string(),
        false,
    );

    let conditional = make_rule_output(
        "r_cond",
        "hand_played",
        Some(lua_path(&["context", "cond_a"])),
        "COND",
    );
    let fallback = make_rule_output("r_fallback", "hand_played", None, "FALLBACK");

    let calc = build_shared_calculate_function(&[fallback, conditional], &ctx)
        .expect("calculate function should be generated");
    let code = Emitter::new().emit_expr_to_string(&calc);

    assert!(code.contains("if context."));
    assert!(index_of(&code, "message = 'COND'") < index_of(&code, "message = 'FALLBACK'"));
}

#[test]
fn shared_calculate_ignores_card_used_trigger_rules() {
    let ctx = CompileContext::new(
        ObjectType::Consumable,
        "mod".to_string(),
        "c_test".to_string(),
        false,
    );

    let card_used = make_rule_output("r_use", "card_used", None, "USE_ONLY");
    let calc_rule = make_rule_output("r_calc", "hand_played", None, "CALC_ONLY");

    let calc = build_shared_calculate_function(&[card_used, calc_rule], &ctx)
        .expect("calculate function should be generated");
    let code = Emitter::new().emit_expr_to_string(&calc);

    assert!(code.contains("CALC_ONLY"));
    assert!(!code.contains("USE_ONLY"));
}

#[test]
fn joker_calculate_wraps_rules_and_keeps_fallback_last_for_same_trigger() {
    let ctx = CompileContext::new(
        ObjectType::Joker,
        "mod".to_string(),
        "j_test".to_string(),
        false,
    );

    let fallback = make_rule_output("rule_fallback", "first_hand_drawn", None, "FALLBACK");
    let conditional = make_rule_output(
        "rule_cond",
        "first_hand_drawn",
        Some(lua_path(&["context", "cond_a"])),
        "COND",
    );

    let calc = build_calculate_function(&[fallback, conditional], &ctx)
        .expect("calculate function should be generated");
    let code = Emitter::new().emit_expr_to_string(&calc);

    assert!(index_of(&code, "message = 'COND'") < index_of(&code, "message = 'FALLBACK'"));
}

#[test]
fn shared_calculate_keeps_triggers_isolated() {
    let ctx = CompileContext::new(
        ObjectType::Deck,
        "mod".to_string(),
        "b_test".to_string(),
        false,
    );

    let hand_rule = make_rule_output("r_hand", "hand_played", None, "HAND");
    let round_rule = make_rule_output("r_round", "round_end", None, "ROUND");

    let calc = build_shared_calculate_function(&[hand_rule, round_rule], &ctx)
        .expect("calculate function should be generated");
    let code = Emitter::new().emit_expr_to_string(&calc);

    assert!(code.contains("message = 'HAND'"));
    assert!(code.contains("message = 'ROUND'"));
    assert!(code.matches("if context.").count() >= 2);
}
