pub mod colors;
pub mod conditions;
pub mod context;
pub mod effects;
pub mod triggers;
pub mod values;

// Game object compiler modules
pub mod booster;
pub mod consumable;
pub mod deck;
pub mod edition;
pub mod enhancement;
pub mod rarity;
pub mod seal;
pub mod voucher;

use crate::lua_ast::*;
use crate::types::*;
use context::CompileContext;
use std::collections::HashSet;

// Re-export compile functions for each game object type
pub use booster::compile_booster;
pub use consumable::{compile_consumable, compile_consumable_type};
pub use deck::compile_deck;
pub use edition::compile_edition;
pub use enhancement::compile_enhancement;
pub use rarity::compile_rarity;
pub use seal::compile_seal;
pub use voucher::compile_voucher;

/// Compile a complete joker definition into a Lua chunk.
pub fn compile_joker(joker: &JokerDef, mod_prefix: &str) -> Chunk {
    compile_joker_with_options(joker, mod_prefix, true)
}

/// Compile a complete joker definition into a Lua chunk with optional loc_txt emission.
pub fn compile_joker_with_options(
    joker: &JokerDef,
    mod_prefix: &str,
    include_loc_txt: bool,
) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Joker,
        mod_prefix.to_string(),
        joker.key.clone(),
        joker.blueprint_compat,
    );
    ctx.set_user_vars(joker.user_variables.clone());

    // Pre-pass: compile all effects to accumulate config variables
    let rule_outputs = compile_rules(&joker.rules, &mut ctx);

    // Build the SMODS.Joker table
    let joker_table = build_joker_table(joker, &ctx, &rule_outputs, include_loc_txt);

    // Wrap in SMODS.Joker { ... } (table-call syntax, no parens)
    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Joker"]),
        match joker_table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    let mut stmts = vec![lua_comment(format!(" {}", joker.name)), smods_call];
    stmts.extend(build_global_hook_stmts(&rule_outputs, &ctx));
    if joker.ignore_slot_limit {
        stmts.extend(build_ignore_slot_limit_stmts(&ctx));
    }

    Chunk { stmts }
}

/// Compile a single node for snippet preview.
///
/// Returns the Lua code that this specific node contributes.
pub fn compile_node_snippet(
    node_type: &str,
    params: &std::collections::HashMap<String, serde_json::Value>,
    object_type: ObjectType,
    mod_prefix: &str,
) -> String {
    let type_parts: Vec<&str> = node_type.split('.').collect();
    if type_parts.len() < 2 {
        return format!("-- unknown node type: {}", node_type);
    }

    let category = type_parts[0];
    let specific = type_parts[1];

    match category {
        "trigger" => {
            let ctx_expr = triggers::trigger_context(object_type, specific, false);
            let stmt = lua_if(ctx_expr, vec![lua_comment("... effects ...")]);
            crate::lua_ast::format_lua_source(&Emitter::new().emit_stmts(&[stmt]))
        }
        "condition" => {
            let condition = ConditionDef {
                id: String::new(),
                condition_type: specific.to_string(),
                negate: false,
                operator: None,
                params: convert_params(params),
            };
            let mut preview_ctx = CompileContext::new(
                object_type,
                mod_prefix.to_string(),
                "preview".to_string(),
                false,
            );
            match conditions::compile_condition(&condition, object_type, &mut preview_ctx) {
                Some(expr) => {
                    let stmt = lua_if(expr, vec![lua_comment("... effects ...")]);
                    crate::lua_ast::format_lua_source(&Emitter::new().emit_stmts(&[stmt]))
                }
                None => format!("-- condition '{}' not yet implemented", specific),
            }
        }
        "effect" => {
            let effect = EffectDef {
                id: String::new(),
                effect_type: specific.to_string(),
                params: convert_params(params),
            };
            let mut ctx = CompileContext::new(
                object_type,
                mod_prefix.to_string(),
                "preview".to_string(),
                false,
            );
            match effects::compile_effect(&effect, &mut ctx, "hand_played") {
                Some(output) => {
                    let stmts = effects::build_return_block(&[output]);
                    crate::lua_ast::format_lua_source(&Emitter::new().emit_stmts(&stmts))
                }
                None => format!("-- effect '{}' not yet implemented", specific),
            }
        }
        _ => format!("-- unknown category: {}", category),
    }
}

// ---------------------------------------------------------------------------
// Internal compilation
// ---------------------------------------------------------------------------

pub(crate) struct RuleOutput {
    pub(crate) rule_id: String,
    pub(crate) trigger: String,
    pub(crate) condition_expr: Option<Expr>,
    pub(crate) condition_segment_ids: Vec<String>,
    pub(crate) effect_stmts: Vec<Stmt>,
    pub(crate) is_passive: bool,
    pub(crate) passive_outputs: Vec<effects::passive::PassiveEffectOutput>,
    pub(crate) passive_hooks: Vec<PassiveHookSpec>,
    pub(crate) has_retrigger: bool,
    pub(crate) has_destroy: bool,
    pub(crate) blind_rewards: Vec<BlindRewardOutput>,
}

pub(crate) struct BlindRewardOutput {
    pub(crate) condition_expr: Option<Expr>,
    pub(crate) amount_expr: Expr,
    pub(crate) boss_only: bool,
}

fn param_value_user_var_name(value: &ParamValue) -> Option<String> {
    match value {
        ParamValue::Str(s) => Some(s.clone()),
        ParamValue::Typed(t) => {
            if t.value_type == "user_var" || t.value_type == "userVariable" {
                t.value.as_str().map(|s| s.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

fn collect_rule_referenced_user_vars(rule: &RuleDef, refs: &mut HashSet<String>) {
    for group in &rule.condition_groups {
        for cond in &group.conditions {
            for value in cond.params.values() {
                if let Some(var_name) = param_value_user_var_name(value) {
                    refs.insert(var_name);
                }
            }
        }
    }

    for effect in &rule.effects {
        for value in effect.params.values() {
            if let Some(var_name) = param_value_user_var_name(value) {
                refs.insert(var_name);
            }
        }
    }

    for random in &rule.random_groups {
        if let Some(var_name) = param_value_user_var_name(&random.chance_numerator) {
            refs.insert(var_name);
        }
        if let Some(var_name) = param_value_user_var_name(&random.chance_denominator) {
            refs.insert(var_name);
        }
        for effect in &random.effects {
            for value in effect.params.values() {
                if let Some(var_name) = param_value_user_var_name(value) {
                    refs.insert(var_name);
                }
            }
        }
    }

    for loop_group in &rule.loop_groups {
        if let Some(var_name) = param_value_user_var_name(&loop_group.count) {
            refs.insert(var_name);
        }
        for effect in &loop_group.effects {
            for value in effect.params.values() {
                if let Some(var_name) = param_value_user_var_name(value) {
                    refs.insert(var_name);
                }
            }
        }
    }
}

fn collect_referenced_user_vars(rules: &[RuleDef]) -> HashSet<String> {
    let mut refs = HashSet::new();
    for rule in rules {
        collect_rule_referenced_user_vars(rule, &mut refs);
    }
    refs
}

pub(crate) enum PassiveHookSpec {
    DiscountItems {
        joker_key: String,
        discount_type: String,
        discount_method: String,
        discount_amount: f64,
    },
    ReduceFlushStraightRequirements {
        joker_key: String,
        reduction_value: i64,
    },
    Shortcut {
        joker_key: String,
    },
    Showman {
        joker_key: String,
    },
    CombineSuits {
        joker_key: String,
        suit_1: String,
        suit_2: String,
    },
    CombineRanks {
        joker_key: String,
        source_rank_type: String,
        source_ranks: Vec<String>,
        target_rank: String,
    },
}

pub(crate) fn compile_rules(rules: &[RuleDef], ctx: &mut CompileContext) -> Vec<RuleOutput> {
    rules
        .iter()
        .map(|rule| compile_single_rule(rule, ctx))
        .collect()
}

fn compile_single_rule(rule: &RuleDef, ctx: &mut CompileContext) -> RuleOutput {
    let trigger = rule.trigger.clone();
    let is_passive = trigger == "passive";

    // Compile conditions
    let condition_expr =
        conditions::compile_condition_chain(&rule.condition_groups, ctx.object_type, ctx);
    let condition_segment_ids = rule
        .condition_groups
        .iter()
        .flat_map(|group| group.conditions.iter())
        .filter_map(|condition| {
            if condition.id.trim().is_empty() {
                None
            } else {
                Some(format!("condition:{}:{}", rule.id, condition.id))
            }
        })
        .collect::<Vec<_>>();

    // Check for passive effects
    let mut passive_outputs = Vec::new();
    let mut passive_hooks = Vec::new();
    if is_passive {
        for effect in &rule.effects {
            if let Some(po) = effects::passive::compile_passive(effect, ctx) {
                passive_outputs.push(po);
            }
            if let Some(hook) = passive_hook_from_effect(effect, ctx) {
                passive_hooks.push(hook);
            }
        }
    }

    // Compile regular effects
    let mut effect_outputs = Vec::new();
    let mut blind_rewards = Vec::new();
    if !is_passive {
        for effect in &rule.effects {
            if effect.effect_type == "blind_reward"
                && (trigger == "round_end" || trigger == "boss_defeated")
            {
                blind_rewards.push(BlindRewardOutput {
                    condition_expr: condition_expr.clone(),
                    amount_expr: compile_blind_reward_amount(effect, ctx),
                    boss_only: trigger == "boss_defeated",
                });
                continue;
            }

            if let Some(mut eo) = effects::compile_effect(effect, ctx, &trigger) {
                eo.segment_id = effect_segment_id(&rule.id, effect);
                effect_outputs.push(eo);
            }
        }
    }

    // Compile random groups
    for rg in &rule.random_groups {
        let rg_effects = compile_random_group(&rule.id, rg, ctx, &trigger);
        effect_outputs.extend(rg_effects);
    }

    // Compile loop groups
    for lg in &rule.loop_groups {
        let lg_effects = compile_loop_group(&rule.id, lg, ctx, &trigger);
        effect_outputs.extend(lg_effects);
    }

    // Build the effect statements
    let effect_stmts = if effect_outputs.is_empty() {
        vec![]
    } else {
        effects::build_return_block(&effect_outputs)
    };

    RuleOutput {
        rule_id: rule.id.clone(),
        trigger,
        condition_expr,
        condition_segment_ids,
        effect_stmts,
        is_passive,
        passive_outputs,
        passive_hooks,
        has_retrigger: rule.retrigger,
        has_destroy: rule.destroy,
        blind_rewards,
    }
}

fn effect_segment_id(rule_id: &str, effect: &EffectDef) -> Option<String> {
    if effect.id.trim().is_empty() {
        None
    } else {
        Some(format!("effect:{}:{}", rule_id, effect.id))
    }
}

fn compile_random_group(
    rule_id: &str,
    rg: &RandomGroupDef,
    ctx: &mut CompileContext,
    trigger: &str,
) -> Vec<effects::EffectOutput> {
    // Compile the effects within the random group
    let mut inner_outputs = Vec::new();
    for effect in &rg.effects {
        if let Some(mut eo) = effects::compile_effect(effect, ctx, trigger) {
            eo.segment_id = effect_segment_id(rule_id, effect);
            inner_outputs.push(eo);
        }
    }

    if inner_outputs.is_empty() {
        return vec![];
    }

    // Build the inner return block
    let inner_stmts = effects::build_return_block(&inner_outputs);

    // Wrap in probability check:
    // if SMODS.pseudorandom_probability(...) then <inner> end
    let probability_index = ctx.next_probability_var_index();
    let random_group_index = ctx.next_random_group_index();
    let odds_var = format!("odds_{}", probability_index);
    let numerator_var = format!("numerator_{}", probability_index);
    let prob_check = lua_call(
        "SMODS.pseudorandom_probability",
        vec![
            lua_ident("card"),
            lua_str(format!("group{}", random_group_index)),
            lua_field(lua_raw_expr(ctx.ability_path()), &numerator_var),
            lua_field(lua_raw_expr(ctx.ability_path()), &odds_var),
            lua_str(ctx.smods_key()),
            lua_bool(false),
        ],
    );

    // Register probability config variables
    let numerator = rg.chance_numerator.as_i64().unwrap_or(1);
    let denom = rg.chance_denominator.as_i64().unwrap_or(2);
    ctx.add_config_int(&numerator_var, numerator);
    ctx.add_config_int(&odds_var, denom);

    let wrapped = effects::EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_if(prob_check, inner_stmts)],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    };

    vec![wrapped]
}

fn compile_loop_group(
    rule_id: &str,
    lg: &LoopGroupDef,
    ctx: &mut CompileContext,
    trigger: &str,
) -> Vec<effects::EffectOutput> {
    let mut inner_outputs = Vec::new();
    for effect in &lg.effects {
        if let Some(mut eo) = effects::compile_effect(effect, ctx, trigger) {
            eo.segment_id = effect_segment_id(rule_id, effect);
            inner_outputs.push(eo);
        }
    }

    if inner_outputs.is_empty() {
        return vec![];
    }

    let inner_stmts = effects::build_return_block(&inner_outputs);
    if inner_stmts.is_empty() {
        return vec![];
    }

    let loop_index = ctx.next_loop_var_index();
    let loop_var_name = format!("loop_count_{}", loop_index);
    let loop_count = lg.count.as_i64().unwrap_or(1).max(1);
    ctx.add_config_int(&loop_var_name, loop_count);

    let loop_stmt = Stmt::ForRange {
        var: "i".to_string(),
        start: lua_int(1),
        stop: lua_field(lua_raw_expr(ctx.ability_path()), &loop_var_name),
        step: None,
        body: inner_stmts,
    };

    vec![effects::EffectOutput {
        return_fields: vec![],
        pre_return: vec![loop_stmt],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    }]
}

fn compile_blind_reward_amount(effect: &EffectDef, ctx: &mut CompileContext) -> Expr {
    let resolved = values::resolve_config_value(&effect.params, "value", ctx, "blind_reward");
    resolved.expr
}

fn build_joker_table(
    joker: &JokerDef,
    ctx: &CompileContext,
    rule_outputs: &[RuleOutput],
    include_loc_txt: bool,
) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    // Basic properties
    entries.push(kv("key", lua_str(&joker.key)));

    // Config table with extra
    entries.push(section_begin("config"));
    let config_extra = ctx.build_config_extra_table();
    if !config_extra.is_empty() {
        entries.push(TableEntry::KeyValue(
            "config".to_string(),
            lua_table_raw(vec![TableEntry::KeyValue(
                "extra".to_string(),
                lua_table_raw(config_extra),
            )]),
        ));
    }
    entries.push(section_end("config"));

    if include_loc_txt {
        entries.push(section_begin("loc_txt"));
        // Localization, use ['name'], ['text'], ['unlock'] bracket keys
        // Text and unlock use numbered array entries: [1] = '...', [2] = '...'
        let text_entries: Vec<TableEntry> = joker
            .description
            .iter()
            .enumerate()
            .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
            .collect();

        let mut loc_txt_entries = vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&joker.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ];

        // Unlock description
        if let Some(unlock) = &joker.unlock {
            let unlock_entries: Vec<TableEntry> = unlock
                .description
                .iter()
                .enumerate()
                .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
                .collect();
            loc_txt_entries.push(TableEntry::IndexValue(
                lua_str("unlock"),
                lua_table_raw(unlock_entries),
            ));
        }

        entries.push(TableEntry::KeyValue(
            "loc_txt".to_string(),
            lua_table_raw(loc_txt_entries),
        ));
        entries.push(section_end("loc_txt"));
    }

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(joker.pos.x as i64)),
            ("y", lua_int(joker.pos.y as i64)),
        ]),
    ));

    // Soul position
    if let Some(soul) = &joker.soul_pos {
        entries.push(TableEntry::KeyValue(
            "soul_pos".to_string(),
            lua_table(vec![
                ("x", lua_int(soul.x as i64)),
                ("y", lua_int(soul.y as i64)),
            ]),
        ));
    }

    // Display size, only include when changed from default 1x scale.
    if let Some(size) = &joker.display_size {
        let epsilon = 0.0001_f64;
        let is_default = (size.w - 1.0).abs() < epsilon && (size.h - 1.0).abs() < epsilon;
        if !is_default {
            let scale_w = if size.w.fract() == 0.0 {
                lua_int(size.w as i64)
            } else {
                lua_num(size.w)
            };
            let scale_h = if size.h.fract() == 0.0 {
                lua_int(size.h as i64)
            } else {
                lua_num(size.h)
            };
            entries.push(TableEntry::KeyValue(
                "display_size".to_string(),
                lua_table(vec![
                    ("w", lua_mul(lua_int(71), scale_w)),
                    ("h", lua_mul(lua_int(95), scale_h)),
                ]),
            ));
        }
    }

    // Scalar properties
    entries.push(section_begin("props"));
    entries.push(kv("cost", lua_int(joker.cost as i64)));
    // Rarity, standard rarities are numeric, custom rarities are strings
    let rarity_expr = match joker.rarity.as_str() {
        "common" | "Common" | "1" => lua_int(1),
        "uncommon" | "Uncommon" | "2" => lua_int(2),
        "rare" | "Rare" | "3" => lua_int(3),
        "legendary" | "Legendary" | "4" => lua_int(4),
        other => lua_str(other), // Custom rarity key
    };
    entries.push(kv("rarity", rarity_expr));
    entries.push(kv("blueprint_compat", lua_bool(joker.blueprint_compat)));
    entries.push(kv("eternal_compat", lua_bool(joker.eternal_compat)));
    entries.push(kv("perishable_compat", lua_bool(joker.perishable_compat)));
    entries.push(kv("unlocked", lua_bool(joker.unlocked)));
    entries.push(kv("discovered", lua_bool(joker.discovered)));
    entries.push(kv("atlas", lua_str(&joker.atlas)));
    entries.push(section_end("props"));

    // In-pool function
    if let Some(appearance) = &joker.appearance {
        if let Some(pool_fn) = build_in_pool(appearance, ctx) {
            entries.push(TableEntry::KeyValue("in_pool".to_string(), pool_fn));
        }
    }

    // set_ability hook for forced stickers/editions and user-variable state initialization
    if let Some(set_ability_fn) = build_set_ability(joker) {
        entries.push(TableEntry::KeyValue(
            "set_ability".to_string(),
            set_ability_fn,
        ));
    }

    // Loc vars function
    entries.push(section_begin("loc_vars"));
    let loc_vars_fn = build_loc_vars(joker, ctx, rule_outputs);
    if let Some(f) = loc_vars_fn {
        entries.push(TableEntry::KeyValue("loc_vars".to_string(), f));
    }
    entries.push(section_end("loc_vars"));

    // Blind reward hook
    if let Some(calc_dollar_bonus) = build_calc_dollar_bonus(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue(
            "calc_dollar_bonus".to_string(),
            calc_dollar_bonus,
        ));
    }

    // Passive effect functions
    let (add_deck, remove_deck) = build_passive_functions(rule_outputs, ctx);
    if let Some(f) = add_deck {
        entries.push(TableEntry::KeyValue("add_to_deck".to_string(), f));
    }
    if let Some(f) = remove_deck {
        entries.push(TableEntry::KeyValue("remove_from_deck".to_string(), f));
    }

    // Calculate function
    let calc_fn = build_calculate_function(rule_outputs, ctx);
    if let Some(f) = calc_fn {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    lua_table_raw(entries)
}

/// Build the `calculate` function from non-passive rules and passive
/// calculate statements.
fn build_calculate_function(rule_outputs: &[RuleOutput], ctx: &CompileContext) -> Option<Expr> {
    let non_passive: Vec<&RuleOutput> = rule_outputs
        .iter()
        .filter(|r| !r.is_passive && !r.effect_stmts.is_empty())
        .collect();

    let has_passive_calculate = rule_outputs
        .iter()
        .any(|r| r.is_passive && r.passive_outputs.iter().any(|po| !po.calculate_stmts.is_empty()));

    if non_passive.is_empty() && !has_passive_calculate {
        return None;
    }

    // Group rules by trigger
    let mut body: Vec<Stmt> = Vec::new();
    let has_any_destroy = non_passive.iter().any(|r| r.has_destroy);

    if has_any_destroy {
        body.push(lua_if(
            lua_and(
                lua_path(&["context", "destroy_card"]),
                lua_path(&["context", "destroy_card", "should_destroy"]),
            ),
            vec![lua_return(lua_table(vec![("remove", lua_bool(true))]))],
        ));
    }

    // Also include passive calculate statements
    for ro in rule_outputs {
        if ro.is_passive {
            for po in &ro.passive_outputs {
                body.extend(po.calculate_stmts.clone());
            }
        }
    }

    // Group non-passive rules by trigger type
    let mut triggers_seen: Vec<String> = Vec::new();
    for ro in &non_passive {
        if !triggers_seen.contains(&ro.trigger) {
            triggers_seen.push(ro.trigger.clone());
        }
    }

    for trigger in &triggers_seen {
        let rules_for_trigger: Vec<&RuleOutput> = non_passive
            .iter()
            .copied()
            .filter(|r| r.trigger == *trigger)
            .collect();

        let use_retrigger_context = rules_for_trigger.iter().any(|r| r.has_retrigger);
        let has_trigger_destroy = rules_for_trigger.iter().any(|r| r.has_destroy);

        // Get the trigger context expression
        let trigger_ctx = triggers::trigger_context_for_rule(
            ctx.object_type,
            trigger,
            ctx.blueprint_compat,
            use_retrigger_context,
        );

        let mut trigger_body: Vec<Stmt> = Vec::new();

        if has_trigger_destroy && trigger.as_str() != "card_discarded" {
            trigger_body.push(lua_assign(
                lua_path(&["context", "other_card", "should_destroy"]),
                lua_bool(false),
            ));
        }

        append_rule_chain_with_fallback(&mut trigger_body, &rules_for_trigger, |ro| {
            let mut rule_stmts = ro.effect_stmts.clone();
            if ro.has_destroy && trigger.as_str() != "card_discarded" {
                rule_stmts.insert(
                    0,
                    lua_assign(
                        lua_path(&["context", "other_card", "should_destroy"]),
                        lua_bool(true),
                    ),
                );
            }

            wrap_rule_segment(&ro.rule_id, rule_stmts)
        });

        if !trigger_body.is_empty() {
            let trigger_if = Stmt::If {
                branches: vec![(trigger_ctx, trigger_body)],
                else_body: None,
            };
            body.extend(wrap_trigger_stmt_for_rules(&rules_for_trigger, trigger_if));
        }
    }

    if body.is_empty() {
        return None;
    }

    Some(Expr::Function {
        params: vec!["self".into(), "card".into(), "context".into()],
        body,
    })
}

/// Build `add_to_deck` and `remove_from_deck` from passive effects.
fn build_passive_functions(
    rule_outputs: &[RuleOutput],
    _ctx: &CompileContext,
) -> (Option<Expr>, Option<Expr>) {
    let mut add_stmts: Vec<Stmt> = Vec::new();
    let mut remove_stmts: Vec<Stmt> = Vec::new();

    for ro in rule_outputs {
        if ro.is_passive {
            for po in &ro.passive_outputs {
                add_stmts.extend(po.add_to_deck.clone());
                remove_stmts.extend(po.remove_from_deck.clone());
            }
        }
    }

    let add_fn = if add_stmts.is_empty() {
        None
    } else {
        Some(Expr::Function {
            params: vec!["self".into(), "card".into(), "from_debuff".into()],
            body: add_stmts,
        })
    };

    let remove_fn = if remove_stmts.is_empty() {
        None
    } else {
        Some(Expr::Function {
            params: vec!["self".into(), "card".into(), "from_debuff".into()],
            body: remove_stmts,
        })
    };

    (add_fn, remove_fn)
}

/// Build the `loc_vars` function for localization variables.
fn build_loc_vars(
    joker: &JokerDef,
    ctx: &CompileContext,
    _rule_outputs: &[RuleOutput],
) -> Option<Expr> {
    let vars = ctx.config_vars();
    let referenced_user_vars = collect_referenced_user_vars(&joker.rules);
    let has_user_vars = ctx
        .user_vars()
        .iter()
        .any(|uv| !uv.is_global || referenced_user_vars.contains(&uv.name));
    let has_info_queue = !joker.info_queues.is_empty();

    if vars.is_empty() && !has_user_vars && !has_info_queue {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();

    for (index, key) in joker.info_queues.iter().enumerate() {
        let object_path = if key.starts_with("tag_") {
            format!("G.P_TAGS[\"{}\"]", key)
        } else if key.starts_with("stake_") {
            format!("G.P_STAKES[\"{}\"]", key)
        } else if key.starts_with("j_")
            || key.starts_with("c_")
            || key.starts_with("v_")
            || key.starts_with("b_")
            || key.starts_with("m_")
            || key.starts_with("e_")
            || key.starts_with("p_")
        {
            format!("G.P_CENTERS[\"{}\"]", key)
        } else {
            format!("G.P_SEALS[\"{}\"]", key)
        };

        body.push(lua_raw_stmt(format!(
            "local info_queue_{} = {}; if info_queue_{} then info_queue[#info_queue + 1] = info_queue_{} else error(\"JOKERFORGE: Invalid key in infoQueues: '{}'.\") end",
            index, object_path, index, index, key
        )));
    }

    let mut var_refs: Vec<TableEntry> = Vec::new();
    let mut colour_refs: Vec<TableEntry> = Vec::new();
    for uv in ctx.user_vars() {
        if uv.is_global && !referenced_user_vars.contains(&uv.name) {
            continue;
        }
        match uv.var_type {
            crate::types::UserVarType::Suit => {
                let default_suit = uv.initial_value.to_string_lossy();
                var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "localize((G.GAME.current_round.{}_card or {{}}).suit or '{}', 'suits_singular')",
                    uv.name, default_suit
                ))));
                colour_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "G.C.SUITS[(G.GAME.current_round.{}_card or {{}}).suit or '{}']",
                    uv.name, default_suit
                ))));
            }
            crate::types::UserVarType::Rank => {
                let default_rank = uv.initial_value.to_string_lossy();
                var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "localize((G.GAME.current_round.{}_card or {{}}).rank or '{}', 'ranks')",
                    uv.name, default_rank
                ))));
            }
            crate::types::UserVarType::PokerHand => {
                let default_hand = uv.initial_value.to_string_lossy();
                var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "localize((G.GAME.current_round.{}_hand or '{}'), 'poker_hands')",
                    uv.name, default_hand
                ))));
            }
            _ => {
                if uv.is_global && uv.is_persistent {
                    var_refs.push(TableEntry::Value(lua_field(
                        lua_raw_expr("JF_GLOBALS"),
                        &uv.name,
                    )));
                } else if uv.is_global {
                    let default_lua = match uv.var_type {
                        crate::types::UserVarType::Number => {
                            let n = uv.initial_value.as_f64().unwrap_or(0.0);
                            if n.fract() == 0.0 {
                                format!("{}", n as i64)
                            } else {
                                format!("{}", n)
                            }
                        }
                        _ => format!(
                            "'{}'",
                            uv.initial_value
                                .to_string_lossy()
                                .replace('\\', "\\\\")
                                .replace('\'', "\\'")
                        ),
                    };
                    var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                        "((G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.{}) or {})",
                        uv.name, default_lua
                    ))));
                } else {
                    var_refs.push(TableEntry::Value(lua_field(
                        lua_raw_expr("self.config.extra"),
                        &uv.name,
                    )));
                }
            }
        }
    }

    var_refs.extend(
        vars.iter()
            .filter(|v| !v.name.starts_with("odds_") && !v.name.starts_with("numerator_"))
            .map(|v| TableEntry::Value(lua_field(lua_raw_expr("self.config.extra"), &v.name))),
    );

    let mut probability_pairs: Vec<(String, String)> = vars
        .iter()
        .filter_map(|v| {
            if !v.name.starts_with("odds_") {
                return None;
            }
            let suffix = v.name.trim_start_matches("odds_");
            Some((format!("numerator_{}", suffix), v.name.clone()))
        })
        .collect();
    probability_pairs.sort();
    probability_pairs.dedup();

    for (index, (num, den)) in probability_pairs.into_iter().enumerate() {
        let suffix = index.to_string();
        body.push(lua_raw_stmt(format!(
            "local new_numerator{suffix}, new_denominator{suffix} = SMODS.get_probability_vars(card, self.config.extra.{num}, self.config.extra.{den}, '{key}')",
            suffix = suffix,
            num = num,
            den = den,
            key = ctx.smods_key(),
        )));
        var_refs.push(TableEntry::Value(lua_ident(format!(
            "new_numerator{}",
            suffix
        ))));
        var_refs.push(TableEntry::Value(lua_ident(format!(
            "new_denominator{}",
            suffix
        ))));
    }

    let mut return_entries = vec![TableEntry::KeyValue(
        "vars".to_string(),
        lua_table_raw(var_refs),
    )];
    if !colour_refs.is_empty() {
        return_entries.push(TableEntry::KeyValue(
            "colours".to_string(),
            lua_table_raw(colour_refs),
        ));
    }
    body.push(lua_return(lua_table_raw(return_entries)));

    Some(Expr::Function {
        params: vec!["self".into(), "info_queue".into(), "card".into()],
        body,
    })
}

fn build_set_ability(joker: &JokerDef) -> Option<Expr> {
    let mut body: Vec<Stmt> = Vec::new();

    if joker.force_eternal {
        body.push(lua_raw_stmt("card:set_eternal(true)"));
    }
    if joker.force_perishable {
        body.push(lua_raw_stmt("card:add_sticker('perishable', true)"));
    }
    if joker.force_rental {
        body.push(lua_raw_stmt("card:add_sticker('rental', true)"));
    }
    if joker.force_foil {
        body.push(lua_raw_stmt("card:set_edition('e_foil', true)"));
    }
    if joker.force_holographic {
        body.push(lua_raw_stmt("card:set_edition('e_holo', true)"));
    }
    if joker.force_polychrome {
        body.push(lua_raw_stmt("card:set_edition('e_polychrome', true)"));
    }
    if joker.force_negative {
        body.push(lua_raw_stmt("card:set_edition('e_negative', true)"));
    }

    let mut needs_round_guard = false;
    for uv in &joker.user_variables {
        match uv.var_type {
            crate::types::UserVarType::Suit => {
                needs_round_guard = true;
                let default_suit = uv.initial_value.to_string_lossy();
                body.push(lua_raw_stmt(format!(
                    "G.GAME.current_round.{}_card = {{ suit = '{}' }}",
                    uv.name, default_suit
                )));
            }
            crate::types::UserVarType::Rank => {
                needs_round_guard = true;
                let default_rank = uv.initial_value.to_string_lossy();
                body.push(lua_raw_stmt(format!(
                    "G.GAME.current_round.{}_card = {{ rank = '{}', id = {} }}",
                    uv.name,
                    default_rank,
                    rank_to_id(&default_rank)
                )));
            }
            crate::types::UserVarType::PokerHand => {
                needs_round_guard = true;
                let default_hand = uv.initial_value.to_string_lossy();
                body.push(lua_raw_stmt(format!(
                    "G.GAME.current_round.{}_hand = '{}'",
                    uv.name, default_hand
                )));
            }
            _ => {}
        }
    }

    if body.is_empty() {
        return None;
    }

    if needs_round_guard {
        body.insert(
            0,
            lua_raw_stmt("if not G.GAME or not G.GAME.current_round then return end"),
        );
    }

    Some(Expr::Function {
        params: vec!["self".into(), "card".into(), "initial".into()],
        body,
    })
}

fn rank_to_id(rank: &str) -> i64 {
    match rank {
        "2" => 2,
        "3" => 3,
        "4" => 4,
        "5" => 5,
        "6" => 6,
        "7" => 7,
        "8" => 8,
        "9" => 9,
        "10" => 10,
        "Jack" | "J" => 11,
        "Queen" | "Q" => 12,
        "King" | "K" => 13,
        _ => 14,
    }
}

fn build_calc_dollar_bonus(rule_outputs: &[RuleOutput], _ctx: &CompileContext) -> Option<Expr> {
    let mut regular: Vec<&BlindRewardOutput> = Vec::new();
    let mut boss: Vec<&BlindRewardOutput> = Vec::new();

    for ro in rule_outputs {
        for reward in &ro.blind_rewards {
            if reward.boss_only {
                boss.push(reward);
            } else {
                regular.push(reward);
            }
        }
    }

    if regular.is_empty() && boss.is_empty() {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();
    body.push(lua_local("blind_reward", lua_int(0)));

    if !boss.is_empty() {
        let mut boss_body: Vec<Stmt> = Vec::new();
        for reward in &boss {
            let add_stmt = lua_assign(
                lua_ident("blind_reward"),
                lua_add(
                    lua_ident("blind_reward"),
                    lua_call("math.max", vec![reward.amount_expr.clone(), lua_int(0)]),
                ),
            );
            if let Some(cond) = &reward.condition_expr {
                boss_body.push(lua_if(cond.clone(), vec![add_stmt]));
            } else {
                boss_body.push(add_stmt);
            }
        }
        body.push(lua_if(
            lua_raw_expr("G.GAME.blind and G.GAME.blind.boss"),
            boss_body,
        ));
    }

    for reward in &regular {
        let add_stmt = lua_assign(
            lua_ident("blind_reward"),
            lua_add(
                lua_ident("blind_reward"),
                lua_call("math.max", vec![reward.amount_expr.clone(), lua_int(0)]),
            ),
        );
        if let Some(cond) = &reward.condition_expr {
            body.push(lua_if(cond.clone(), vec![add_stmt]));
        } else {
            body.push(add_stmt);
        }
    }

    body.push(lua_if(
        lua_gt(lua_ident("blind_reward"), lua_int(0)),
        vec![lua_return(lua_ident("blind_reward"))],
    ));

    Some(Expr::Function {
        params: vec!["card".into()],
        body,
    })
}

fn passive_hook_from_effect(
    effect: &EffectDef,
    ctx: &mut CompileContext,
) -> Option<PassiveHookSpec> {
    let joker_key = ctx.smods_key();
    match effect.effect_type.as_str() {
        "discount_items" => {
            let discount_type = effect
                .params
                .get("discount_type")
                .or_else(|| effect.params.get("discountType"))
                .and_then(|v| v.as_str())
                .unwrap_or("all_shop_items")
                .to_string();
            let discount_method = effect
                .params
                .get("discount_method")
                .or_else(|| effect.params.get("discountMethod"))
                .and_then(|v| v.as_str())
                .unwrap_or("flat_reduction")
                .to_string();
            let discount_amount = effect
                .params
                .get("discount_amount")
                .or_else(|| effect.params.get("discountAmount"))
                .and_then(|v| v.as_f64())
                .unwrap_or(1.0);
            Some(PassiveHookSpec::DiscountItems {
                joker_key,
                discount_type,
                discount_method,
                discount_amount,
            })
        }
        "reduce_flush_straight_requirements" | "reduce_flush_straight_requirement" => {
            let reduction_value = effect
                .params
                .get("reduction_value")
                .or_else(|| effect.params.get("reductionValue"))
                .and_then(|v| v.as_i64())
                .unwrap_or(1)
                .max(1);
            Some(PassiveHookSpec::ReduceFlushStraightRequirements {
                joker_key,
                reduction_value,
            })
        }
        "shortcut" => Some(PassiveHookSpec::Shortcut { joker_key }),
        "showman" => Some(PassiveHookSpec::Showman { joker_key }),
        "combine_suits" => {
            let suit_1 = effect
                .params
                .get("suit_1")
                .and_then(|v| v.as_str())
                .unwrap_or("Spades")
                .to_string();
            let suit_2 = effect
                .params
                .get("suit_2")
                .and_then(|v| v.as_str())
                .unwrap_or("Hearts")
                .to_string();
            Some(PassiveHookSpec::CombineSuits {
                joker_key,
                suit_1,
                suit_2,
            })
        }
        "combine_ranks" => {
            let source_rank_type = effect
                .params
                .get("source_rank_type")
                .and_then(|v| v.as_str())
                .unwrap_or("specific")
                .to_string();
            let source_ranks = effect
                .params
                .get("source_ranks")
                .and_then(|v| v.as_str())
                .unwrap_or("J,Q,K")
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            let target_rank = effect
                .params
                .get("target_rank")
                .and_then(|v| v.as_str())
                .unwrap_or("J")
                .to_string();
            Some(PassiveHookSpec::CombineRanks {
                joker_key,
                source_rank_type,
                source_ranks,
                target_rank,
            })
        }
        _ => None,
    }
}

fn build_global_hook_stmts(rule_outputs: &[RuleOutput], _ctx: &CompileContext) -> Vec<Stmt> {
    let mut hooks: Vec<&PassiveHookSpec> = Vec::new();
    for ro in rule_outputs {
        for hook in &ro.passive_hooks {
            hooks.push(hook);
        }
    }

    if hooks.is_empty() {
        return vec![];
    }

    let mut discount_hooks = Vec::new();
    let mut reduction_hooks = Vec::new();
    let mut shortcut_keys = Vec::new();
    let mut showman_keys = Vec::new();
    let mut combine_suit_hooks = Vec::new();
    let mut combine_rank_hooks = Vec::new();

    for hook in hooks {
        match hook {
            PassiveHookSpec::DiscountItems { .. } => discount_hooks.push(hook),
            PassiveHookSpec::ReduceFlushStraightRequirements { .. } => reduction_hooks.push(hook),
            PassiveHookSpec::Shortcut { joker_key } => shortcut_keys.push(joker_key.clone()),
            PassiveHookSpec::Showman { joker_key } => showman_keys.push(joker_key.clone()),
            PassiveHookSpec::CombineSuits { .. } => combine_suit_hooks.push(hook),
            PassiveHookSpec::CombineRanks { .. } => combine_rank_hooks.push(hook),
        }
    }

    let mut stmts = Vec::new();

    if !discount_hooks.is_empty() {
        let mut code = String::from(
            "local card_set_cost_ref = Card.set_cost\nfunction Card:set_cost()\n    card_set_cost_ref(self)",
        );
        for hook in discount_hooks {
            if let PassiveHookSpec::DiscountItems {
                joker_key,
                discount_type,
                discount_method,
                discount_amount,
            } = hook
            {
                let cond = discount_type_to_condition(discount_type);
                let logic = discount_method_to_logic(discount_method, *discount_amount);
                code.push_str(&format!(
                    "\n    if next(SMODS.find_card(\"{}\")) then\n        if {} then\n            {}\n        end\n    end",
                    joker_key, cond, logic
                ));
            }
        }
        code.push_str("\n    self.sell_cost = math.max(1, math.floor(self.cost / 2)) + (self.ability.extra_value or 0)\n    self.sell_cost_label = self.facing == 'back' and '?' or self.sell_cost\nend");
        stmts.push(lua_raw_stmt(code));
    }

    if !reduction_hooks.is_empty() {
        let mut code = String::from(
            "local smods_four_fingers_ref = SMODS.four_fingers\nfunction SMODS.four_fingers()",
        );
        for hook in reduction_hooks {
            if let PassiveHookSpec::ReduceFlushStraightRequirements {
                joker_key,
                reduction_value,
            } = hook
            {
                let target = 5_i64.saturating_sub(*reduction_value);
                code.push_str(&format!(
                    "\n    if next(SMODS.find_card(\"{}\")) then\n        return {}\n    end",
                    joker_key,
                    target.max(1)
                ));
            }
        }
        code.push_str("\n    return smods_four_fingers_ref()\nend");
        stmts.push(lua_raw_stmt(code));
    }

    if !shortcut_keys.is_empty() {
        shortcut_keys.sort();
        shortcut_keys.dedup();
        let mut code =
            String::from("local smods_shortcut_ref = SMODS.shortcut\nfunction SMODS.shortcut()");
        for key in &shortcut_keys {
            code.push_str(&format!(
                "\n    if next(SMODS.find_card(\"{}\")) then\n        return true\n    end",
                key
            ));
        }
        code.push_str("\n    return smods_shortcut_ref()\nend");
        stmts.push(lua_raw_stmt(code));
    }

    if !showman_keys.is_empty() {
        showman_keys.sort();
        showman_keys.dedup();
        let mut code = String::from(
            "local smods_showman_ref = SMODS.showman\nfunction SMODS.showman(card_key)",
        );
        for key in &showman_keys {
            code.push_str(&format!(
                "\n    if next(SMODS.find_card(\"{}\")) then\n        return true\n    end",
                key
            ));
        }
        code.push_str("\n    return smods_showman_ref(card_key)\nend");
        stmts.push(lua_raw_stmt(code));
    }

    if !combine_suit_hooks.is_empty() {
        let mut code = String::from(
            "local card_is_suit_ref = Card.is_suit\nfunction Card:is_suit(suit, bypass_debuff, flush_calc)\n    local ret = card_is_suit_ref(self, suit, bypass_debuff, flush_calc)\n    if not ret and not SMODS.has_no_suit(self) then",
        );
        for hook in combine_suit_hooks {
            if let PassiveHookSpec::CombineSuits {
                joker_key,
                suit_1,
                suit_2,
            } = hook
            {
                code.push_str(&format!(
                    "\n        if next(SMODS.find_card(\"{key}\")) then\n            if (suit == \"{s1}\" and self.base.suit == \"{s2}\") or (suit == \"{s2}\" and self.base.suit == \"{s1}\") then\n                ret = true\n            end\n        end",
                    key = joker_key,
                    s1 = suit_1,
                    s2 = suit_2
                ));
            }
        }
        code.push_str("\n    end\n    return ret\nend");
        stmts.push(lua_raw_stmt(code));
    }

    if !combine_rank_hooks.is_empty() {
        let mut face_hooks = Vec::new();
        let mut id_hooks = Vec::new();
        for hook in combine_rank_hooks {
            if let PassiveHookSpec::CombineRanks { target_rank, .. } = hook {
                if target_rank == "face_cards" {
                    face_hooks.push(hook);
                } else {
                    id_hooks.push(hook);
                }
            }
        }

        let source_check = |source_rank_type: &str, source_ranks: &[String], subject: &str| {
            match source_rank_type {
                "all" => "true".to_string(),
                "face_cards" => format!("({subject} >= 11 and {subject} <= 13)"),
                _ => {
                    let checks: Vec<String> = source_ranks
                        .iter()
                        .map(|r| format!("{} == {}", subject, conditions::utils::rank_to_id(r)))
                        .collect();
                    if checks.is_empty() {
                        "false".to_string()
                    } else {
                        format!("({})", checks.join(" or "))
                    }
                }
            }
        };

        if !face_hooks.is_empty() {
            let mut code = String::from(
                "local card_is_face_ref = Card.is_face\nfunction Card:is_face(from_boss)\n    if card_is_face_ref(self, from_boss) then return true end\n    local card_id = self:get_id()\n    if not card_id then return false end",
            );
            for hook in face_hooks {
                if let PassiveHookSpec::CombineRanks {
                    joker_key,
                    source_rank_type,
                    source_ranks,
                    ..
                } = hook
                {
                    code.push_str(&format!(
                        "\n    if next(SMODS.find_card(\"{key}\")) and {check} then\n        return true\n    end",
                        key = joker_key,
                        check = source_check(source_rank_type, source_ranks, "card_id")
                    ));
                }
            }
            code.push_str("\n    return false\nend");
            stmts.push(lua_raw_stmt(code));
        }

        if !id_hooks.is_empty() {
            let mut code = String::from(
                "local card_get_id_ref = Card.get_id\nfunction Card:get_id()\n    local original_id = card_get_id_ref(self)\n    if not original_id then return original_id end",
            );
            for hook in id_hooks {
                if let PassiveHookSpec::CombineRanks {
                    joker_key,
                    source_rank_type,
                    source_ranks,
                    target_rank,
                } = hook
                {
                    code.push_str(&format!(
                        "\n    if next(SMODS.find_card(\"{key}\")) and {check} then\n        return {target}\n    end",
                        key = joker_key,
                        check = source_check(source_rank_type, source_ranks, "original_id"),
                        target = conditions::utils::rank_to_id(target_rank)
                    ));
                }
            }
            code.push_str("\n    return original_id\nend");
            stmts.push(lua_raw_stmt(code));
        }
    }

    stmts
}

fn build_ignore_slot_limit_stmts(ctx: &CompileContext) -> Vec<Stmt> {
    vec![lua_raw_stmt(format!(
        "local check_for_buy_space_ref = G.FUNCS.check_for_buy_space\nG.FUNCS.check_for_buy_space = function(card)\n    if card.config.center.key == \"{}\" then\n        return true\n    end\n    return check_for_buy_space_ref(card)\nend\n\nlocal can_select_card_ref = G.FUNCS.can_select_card\nG.FUNCS.can_select_card = function(e)\n    if e.config.ref_table.config.center.key == \"{}\" then\n        e.config.colour = G.C.GREEN\n        e.config.button = \"use_card\"\n    else\n        can_select_card_ref(e)\n    end\nend",
        ctx.smods_key(),
        ctx.smods_key(),
    ))]
}

fn discount_type_to_condition(discount_type: &str) -> &'static str {
    match discount_type {
        "planet" => "(self.ability.set == 'Planet' or (self.ability.set == 'Booster' and self.config.center.kind == 'Celestial'))",
        "tarot" => "(self.ability.set == 'Tarot' or (self.ability.set == 'Booster' and self.config.center.kind == 'Arcana'))",
        "spectral" => "(self.ability.set == 'Spectral' or (self.ability.set == 'Booster' and self.config.center.kind == 'Spectral'))",
        "standard" => "(self.ability.set == 'Enhanced' or (self.ability.set == 'Booster' and self.config.center.kind == 'Standard'))",
        "jokers" => "self.ability.set == 'Joker'",
        "vouchers" => "self.ability.set == 'Voucher'",
        "all_consumables" => "(self.ability.set == 'Tarot' or self.ability.set == 'Planet' or self.ability.set == 'Spectral')",
        "all_cards" => "(self.ability.set == 'Joker' or self.ability.set == 'Tarot' or self.ability.set == 'Planet' or self.ability.set == 'Spectral' or self.ability.set == 'Enhanced' or self.ability.set == 'Booster')",
        _ => "(self.ability.set == 'Joker' or self.ability.set == 'Tarot' or self.ability.set == 'Planet' or self.ability.set == 'Spectral' or self.ability.set == 'Enhanced' or self.ability.set == 'Booster' or self.ability.set == 'Voucher')",
    }
}

fn discount_method_to_logic(discount_method: &str, amount: f64) -> String {
    match discount_method {
        "make_free" => "self.cost = 0".to_string(),
        "percentage_reduction" => format!(
            "self.cost = math.max(0, math.floor(self.cost * (1 - ({}) / 100)))",
            amount
        ),
        _ => format!("self.cost = math.max(0, self.cost - ({}))", amount),
    }
}

/// Build the `in_pool` function for appearance restrictions.
fn build_in_pool(appearance: &AppearanceDef, _ctx: &CompileContext) -> Option<Expr> {
    if appearance.appears_in.is_empty()
        && appearance.not_appears_in.is_empty()
        && appearance.appear_flags.is_empty()
    {
        return None;
    }

    let mut conditions: Vec<Expr> = Vec::new();

    // Not appears in checks
    for pool in &appearance.not_appears_in {
        let field = if pool.len() <= 3 { "source" } else { "type" };
        conditions.push(lua_not(lua_eq(
            lua_field(lua_ident("args"), field),
            lua_str(pool),
        )));
    }

    // Appears in checks
    if !appearance.appears_in.is_empty() {
        let appear_checks: Vec<Expr> = appearance
            .appears_in
            .iter()
            .map(|pool| {
                let field = if pool.len() <= 3 { "source" } else { "type" };
                lua_eq(lua_field(lua_ident("args"), field), lua_str(pool))
            })
            .collect();
        conditions.push(lua_or_chain(appear_checks));
    }

    let cond = if conditions.is_empty() {
        lua_bool(true)
    } else {
        lua_and_chain(conditions)
    };

    let body = vec![lua_return(cond)];

    Some(Expr::Function {
        params: vec!["self".into(), "args".into()],
        body,
    })
}

// ---------------------------------------------------------------------------
// Shared helpers for non-joker game objects
// ---------------------------------------------------------------------------

/// Build a generic `calculate` function for consumables, vouchers, decks: etc.
/// Filters out "card_used" triggers (handled by use/redeem/apply hooks).
pub(crate) fn build_shared_calculate_function(
    rule_outputs: &[RuleOutput],
    ctx: &CompileContext,
) -> Option<Expr> {
    let non_passive: Vec<&RuleOutput> = rule_outputs
        .iter()
        .filter(|r| !r.is_passive && r.trigger != "card_used" && !r.effect_stmts.is_empty())
        .collect();

    if non_passive.is_empty() {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();

    let mut triggers_seen: Vec<String> = Vec::new();
    for ro in &non_passive {
        if !triggers_seen.contains(&ro.trigger) {
            triggers_seen.push(ro.trigger.clone());
        }
    }

    for trigger in &triggers_seen {
        let rules_for_trigger: Vec<&RuleOutput> = non_passive
            .iter()
            .copied()
            .filter(|r| r.trigger == *trigger)
            .collect();

        let trigger_ctx = triggers::trigger_context(ctx.object_type, trigger, false);

        let mut trigger_body: Vec<Stmt> = Vec::new();
        append_rule_chain_with_fallback(&mut trigger_body, &rules_for_trigger, |ro| {
            wrap_rule_segment(&ro.rule_id, ro.effect_stmts.clone())
        });

        if !trigger_body.is_empty() {
            let trigger_if = Stmt::If {
                branches: vec![(trigger_ctx, trigger_body)],
                else_body: None,
            };
            body.extend(wrap_trigger_stmt_for_rules(&rules_for_trigger, trigger_if));
        }
    }

    if body.is_empty() {
        return None;
    }

    Some(Expr::Function {
        params: vec!["self".into(), "card".into(), "context".into()],
        body,
    })
}

/// Emits trigger rules as a condition chain with unconditional fallback.
///
/// For rules that share the same trigger, conditional rules are emitted first,
/// and unconditional rules are emitted last as the fallback path. This prevents
/// unconditional early returns from shadowing conditional branches.
pub(crate) fn append_rule_chain_with_fallback<F>(
    out: &mut Vec<Stmt>,
    rules_for_trigger: &[&RuleOutput],
    mut build_rule_stmts: F,
) where
    F: FnMut(&RuleOutput) -> Vec<Stmt>,
{
    let mut conditional_rules: Vec<&RuleOutput> = Vec::new();
    let mut unconditional_rules: Vec<&RuleOutput> = Vec::new();

    for ro in rules_for_trigger {
        if ro.condition_expr.is_some() {
            conditional_rules.push(*ro);
        } else {
            unconditional_rules.push(*ro);
        }
    }

    if conditional_rules.is_empty() {
        // Lua requires `return` to be the last statement in a block.
        // Always wrap unconditional rule bodies in `do ... end` so early
        // returns stay scoped and emitted Lua matches snapshot fixtures.
        for ro in unconditional_rules {
            let mut anchored_rule = build_rule_anchor_stmts(ro);
            let rule_stmts = build_rule_stmts(ro);
            anchored_rule.push(Stmt::DoBlock(rule_stmts));
            out.extend(anchored_rule);
        }
        return;
    }

    let mut fallback_tail: Option<Vec<Stmt>> = if unconditional_rules.is_empty() {
        None
    } else {
        let mut tail = Vec::new();
        for ro in unconditional_rules {
            tail.push(Stmt::DoBlock(build_rule_stmts(ro)));
        }
        Some(tail)
    };

    for ro in conditional_rules.into_iter().rev() {
        let cond = ro
            .condition_expr
            .clone()
            .expect("condition_expr should exist for conditional rule chain");
        let then_body = build_rule_stmts(ro);
        let next = Stmt::If {
            branches: vec![(cond, then_body)],
            else_body: fallback_tail,
        };
        let mut wrapped = build_rule_anchor_stmts(ro);
        wrapped.push(next);
        fallback_tail = Some(wrapped);
    }

    if let Some(stmts) = fallback_tail {
        out.extend(stmts);
    }
}

fn build_rule_anchor_stmts(ro: &RuleOutput) -> Vec<Stmt> {
    let mut anchors = Vec::new();
    for condition_segment_id in &ro.condition_segment_ids {
        anchors.push(stmt_section_begin(condition_segment_id));
        anchors.push(stmt_section_end(condition_segment_id));
    }
    anchors
}

fn wrap_trigger_stmt_for_rules(rules: &[&RuleOutput], trigger_stmt: Stmt) -> Vec<Stmt> {
    let mut wrapped = Vec::with_capacity(rules.len() * 2 + 1);
    for ro in rules {
        wrapped.push(stmt_section_begin(&format!("trigger:{}", ro.rule_id)));
    }
    wrapped.push(trigger_stmt);
    for ro in rules.iter().rev() {
        wrapped.push(stmt_section_end(&format!("trigger:{}", ro.rule_id)));
    }
    wrapped
}

pub(crate) fn wrap_rule_segment(rule_id: &str, stmts: Vec<Stmt>) -> Vec<Stmt> {
    let section_id = format!("rule:{}", rule_id);
    let mut wrapped = vec![stmt_section_begin(&section_id)];
    wrapped.extend(stmts);
    wrapped.push(stmt_section_end(&section_id));
    wrapped
}

/// Build a shared `loc_vars` function suitable for consumables, vouchers, decks: etc.
/// Uses the same pattern as the joker loc_vars but without joker-specific features.
pub(crate) fn build_shared_loc_vars(
    ctx: &CompileContext,
    _rule_outputs: &[RuleOutput],
) -> Option<Expr> {
    let vars = ctx.config_vars();
    let has_user_vars = ctx.user_vars().iter().any(|uv| !uv.is_global);

    if vars.is_empty() && !has_user_vars {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();

    let mut var_refs: Vec<TableEntry> = Vec::new();
    // User variables
    for uv in ctx.user_vars() {
        if uv.is_global {
            continue;
        }
        match uv.var_type {
            crate::types::UserVarType::Suit => {
                let default_suit = uv.initial_value.to_string_lossy();
                var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "localize((G.GAME.current_round.{}_card or {{}}).suit or '{}', 'suits_singular')",
                    uv.name, default_suit
                ))));
            }
            crate::types::UserVarType::Rank => {
                let default_rank = uv.initial_value.to_string_lossy();
                var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "localize((G.GAME.current_round.{}_card or {{}}).rank or '{}', 'ranks')",
                    uv.name, default_rank
                ))));
            }
            crate::types::UserVarType::PokerHand => {
                let default_hand = uv.initial_value.to_string_lossy();
                var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                    "localize((G.GAME.current_round.{}_hand or '{}'), 'poker_hands')",
                    uv.name, default_hand
                ))));
            }
            _ => {
                if uv.is_global && uv.is_persistent {
                    var_refs.push(TableEntry::Value(lua_field(
                        lua_raw_expr("JF_GLOBALS"),
                        &uv.name,
                    )));
                } else if uv.is_global {
                    let default_lua = match uv.var_type {
                        crate::types::UserVarType::Number => {
                            let n = uv.initial_value.as_f64().unwrap_or(0.0);
                            if n.fract() == 0.0 {
                                format!("{}", n as i64)
                            } else {
                                format!("{}", n)
                            }
                        }
                        _ => format!(
                            "'{}'",
                            uv.initial_value
                                .to_string_lossy()
                                .replace('\\', "\\\\")
                                .replace('\'', "\\'")
                        ),
                    };
                    var_refs.push(TableEntry::Value(lua_raw_expr(format!(
                        "((G.GAME and G.GAME.jf_global_vars and G.GAME.jf_global_vars.{}) or {})",
                        uv.name, default_lua
                    ))));
                } else {
                    var_refs.push(TableEntry::Value(lua_field(
                        lua_raw_expr("self.config.extra"),
                        &uv.name,
                    )));
                }
            }
        }
    }

    var_refs.extend(
        vars.iter()
            .filter(|v| !v.name.starts_with("odds_") && !v.name.starts_with("numerator_"))
            .map(|v| TableEntry::Value(lua_field(lua_raw_expr("self.config.extra"), &v.name))),
    );

    // Probability variables
    let mut probability_pairs: Vec<(String, String)> = vars
        .iter()
        .filter_map(|v| {
            if !v.name.starts_with("odds_") {
                return None;
            }
            let suffix = v.name.trim_start_matches("odds_");
            Some((format!("numerator_{}", suffix), v.name.clone()))
        })
        .collect();
    probability_pairs.sort();
    probability_pairs.dedup();

    for (index, (num, den)) in probability_pairs.into_iter().enumerate() {
        let suffix = index.to_string();
        body.push(lua_raw_stmt(format!(
            "local new_numerator{suffix}, new_denominator{suffix} = SMODS.get_probability_vars(card, self.config.extra.{num}, self.config.extra.{den}, '{key}')",
            suffix = suffix,
            num = num,
            den = den,
            key = ctx.smods_key(),
        )));
        var_refs.push(TableEntry::Value(lua_ident(format!(
            "new_numerator{}",
            suffix
        ))));
        var_refs.push(TableEntry::Value(lua_ident(format!(
            "new_denominator{}",
            suffix
        ))));
    }

    let return_entries = vec![TableEntry::KeyValue(
        "vars".to_string(),
        lua_table_raw(var_refs),
    )];
    body.push(lua_return(lua_table_raw(return_entries)));

    Some(Expr::Function {
        params: vec!["self".into(), "info_queue".into(), "card".into()],
        body,
    })
}

/// Helper to create a key-value table entry.
fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}

/// Convert serde_json Value params to ParamValue params.
fn convert_params(
    params: &std::collections::HashMap<String, serde_json::Value>,
) -> std::collections::HashMap<String, ParamValue> {
    params
        .iter()
        .map(|(k, v)| {
            let pv = match v {
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        ParamValue::Int(i)
                    } else {
                        ParamValue::Float(n.as_f64().unwrap_or(0.0))
                    }
                }
                serde_json::Value::Bool(b) => ParamValue::Bool(*b),
                serde_json::Value::String(s) => ParamValue::Str(s.clone()),
                _ => ParamValue::Str(v.to_string()),
            };
            (k.clone(), pv)
        })
        .collect()
}

#[cfg(test)]
mod tests;
