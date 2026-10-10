pub mod colors;
pub mod conditions;
pub mod context;
mod description;
mod payout;
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
pub use booster::{compile_booster, compile_booster_with_options};
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
    ctx.rule_execution_mode = joker.rule_execution_mode;
    ctx.set_user_vars(joker.user_variables.clone());
    ctx.set_description_variables(joker.description_variables.clone());

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
            let trigger = if specific == "blind_reward" { "round_end" } else { "hand_played" };
            match effects::compile_effect(&effect, &mut ctx, trigger) {
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
    pub(crate) effect_stmts: Vec<Stmt>,
    pub(crate) is_passive: bool,
    pub(crate) passive_outputs: Vec<effects::passive::PassiveEffectOutput>,
    pub(crate) passive_hooks: Vec<PassiveHookSpec>,
    pub(crate) has_retrigger: bool,
    pub(crate) has_destroy: bool,
    pub(crate) blind_rewards: Vec<BlindRewardOutput>,
    pub(crate) has_grouped_payout: bool,
    pub(crate) grouped_payout_stmts: Vec<Stmt>,
}

pub(crate) struct BlindRewardOutput {
    pub(crate) condition_expr: Option<Expr>,
    pub(crate) amount_expr: Expr,
    pub(crate) boss_only: bool,
    pub(crate) segment_id: Option<String>,
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
        discount_amount: String,
        condition: Option<String>,
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
    ctx.set_referenced_user_vars(collect_referenced_user_vars(rules));
    ctx.set_probability_result_groups(rules.iter()
        .filter(|rule| rule.trigger == "probability_result")
        .flat_map(|rule| &rule.condition_groups)
        .flat_map(|group| &group.conditions)
        .filter(|condition| condition.condition_type == "probability_succeeded"
            && condition.params.get("source").and_then(ParamValue::as_str)
                .is_some_and(|source| source.trim() == "chance_group"))
        .filter_map(|condition| condition.params.get("group_id").and_then(ParamValue::as_str))
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_string)
        .collect());
    rules
        .iter()
        .enumerate()
        .flat_map(|(index, rule)| {
            ctx.begin_preview_rule(index);
            let has_retrigger_effects = rule.effects.iter()
                .chain(rule.random_groups.iter().flat_map(|group| &group.effects))
                .chain(rule.loop_groups.iter().flat_map(|group| &group.effects))
                .any(is_retrigger_effect);
            if has_retrigger_effects && triggers::retrigger_trigger_context(
                ctx.object_type, &rule.trigger, ctx.blueprint_compat,
            ).is_some() {
                // Repetition discovery consumes only repetition counts. Scoring
                // and mutations must run when the card is actually evaluated.
                vec![
                    compile_single_rule(rule, ctx, Some(false)),
                    compile_single_rule(rule, ctx, Some(true)),
                ]
            } else {
                vec![compile_single_rule(rule, ctx, None)]
            }
        })
        .collect()
}

fn is_retrigger_effect(effect: &EffectDef) -> bool {
    matches!(effect.effect_type.as_str(), "retrigger" | "retrigger_playing_card" | "retrigger_cards")
}

fn effect_matches_phase(effect: &EffectDef, repetition_phase: Option<bool>) -> bool {
    repetition_phase.map_or(true, |phase| is_retrigger_effect(effect) == phase)
}

fn compile_single_rule(rule: &RuleDef, ctx: &mut CompileContext, repetition_phase: Option<bool>) -> RuleOutput {
    let trigger = rule.trigger.clone();
    let is_passive = trigger == "passive";

    // Compile conditions
    let condition_expr =
        conditions::compile_condition_chain(&rule.condition_groups, &rule.id, ctx.object_type, ctx);

    // Check for passive effects
    let mut passive_outputs = Vec::new();
    let mut passive_hooks = Vec::new();
    let mut effect_outputs = Vec::new();
    if is_passive {
        for (index, effect) in rule.effects.iter().enumerate() {
            ctx.set_preview_node(vec![serde_json::json!("effects"), serde_json::json!(index)], &effect.params);
            let config_start = ctx.config_vars().len();
            // Vouchers retain these changes after redemption; Jokers supply
            // their passive changes only while held.
            if ctx.object_type == ObjectType::Voucher
                && matches!(effect.effect_type.as_str(), "discount_items" | "edit_joker_size" | "edit_booster_packs")
            {
                if let Some(mut eo) = effects::compile_effect(effect, ctx, "card_used") {
                    eo.segment_id = effect_segment_id(&rule.id, effect);
                    effect_outputs.push(eo);
                }
                ctx.record_effect_config_names(&effect.id, config_start);
                continue;
            }
            if let Some(po) = effects::passive::compile_passive(effect, ctx) {
                passive_outputs.push(po);
            }
            if let Some(hook) = passive_hook_from_effect(effect, ctx, condition_expr.as_ref()) {
                passive_hooks.push(hook);
            }
            ctx.record_effect_config_names(&effect.id, config_start);
        }
    }

    // Compile regular effects
    let mut blind_rewards = Vec::new();
    if !is_passive {
        for (index, effect) in rule.effects.iter().enumerate() {
            if !effect_matches_phase(effect, repetition_phase) {
                continue;
            }
            ctx.set_preview_node(vec![serde_json::json!("effects"), serde_json::json!(index)], &effect.params);
            if effect.effect_type == "blind_reward"
                && (trigger == "round_end" || trigger == "boss_defeated")
            {
                let config_start = ctx.config_vars().len();
                blind_rewards.push(BlindRewardOutput {
                    condition_expr: condition_expr.clone(),
                    amount_expr: compile_blind_reward_amount(effect, ctx),
                    boss_only: trigger == "boss_defeated",
                    segment_id: effect_segment_id(&rule.id, effect),
                });
                ctx.record_effect_config_names(&effect.id, config_start);
                continue;
            }

            if let Some(mut eo) = effects::compile_effect(effect, ctx, &trigger) {
                eo.segment_id = effect_segment_id(&rule.id, effect);
                effect_outputs.push(eo);
            }
        }
    }

    let mut has_regular_effects = !effect_outputs.is_empty();
    let has_grouped_payout = rule.random_groups.iter().flat_map(|g| &g.effects)
        .chain(rule.loop_groups.iter().flat_map(|g| &g.effects))
        .any(|effect| effect_matches_phase(effect, repetition_phase)
            && payout::is_reward(effect, ctx, &trigger));

    // Compile random groups
    for (index, rg) in rule.random_groups.iter().enumerate() {
        let rg_effects = compile_random_group(&rule.id, index, rg, ctx, &trigger, repetition_phase, &mut has_regular_effects);
        effect_outputs.extend(rg_effects);
    }

    // Compile loop groups
    for (index, lg) in rule.loop_groups.iter().enumerate() {
        let lg_effects = compile_loop_group(&rule.id, index, lg, ctx, &trigger, repetition_phase, &mut has_regular_effects);
        effect_outputs.extend(lg_effects);
    }

    // Build the effect statements
    let collect_groups = (!rule.random_groups.is_empty() || !rule.loop_groups.is_empty())
        && !(matches!(ctx.object_type, ObjectType::Consumable | ObjectType::Deck)
            && trigger == "card_used");
    let mut effect_stmts = if collect_groups {
        // Group effects must not return out of the calculate hook mid-loop or
        // before sibling effects. Consumable use resolves each table, and deck
        // apply performs setup statements without returning calculation effects.
        // Capture direct effects before groups in their configured order.
        let stmts = effect_outputs.iter()
            .flat_map(|output| effects::build_return_block(std::slice::from_ref(output)))
            .collect();
        effects::collect_group_effects(stmts)
    } else {
        effects::build_return_block(&effect_outputs)
    };

    let grouped_payout_stmts = if has_grouped_payout && !has_regular_effects && !rule.destroy {
        std::mem::take(&mut effect_stmts)
    } else {
        vec![]
    };

    RuleOutput {
        rule_id: rule.id.clone(),
        trigger,
        condition_expr,
        effect_stmts,
        is_passive,
        passive_outputs,
        passive_hooks,
        has_retrigger: repetition_phase == Some(true),
        has_destroy: rule.destroy && repetition_phase != Some(true),
        blind_rewards,
        has_grouped_payout,
        grouped_payout_stmts,
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
    group_index: usize,
    rg: &RandomGroupDef,
    ctx: &mut CompileContext,
    trigger: &str,
    repetition_phase: Option<bool>,
    has_regular_effects: &mut bool,
) -> Vec<effects::EffectOutput> {
    let publishes_result = ctx.object_type == ObjectType::Joker
        && ctx.probability_group_is_referenced(&rg.id);
    *has_regular_effects |= publishes_result;
    if repetition_phase.is_some() && !rg.effects.is_empty()
        && !rg.effects.iter().any(|effect| effect_matches_phase(effect, repetition_phase))
    {
        return vec![];
    }
    let numerator = rg.chance_numerator.as_i64().unwrap_or(1);
    let denom = rg.chance_denominator.as_i64().unwrap_or(2);
    ctx.register_description_probability(&rg.id, context::DescriptionProbability {
        config_names: None,
        numerator,
        denominator: denom,
    });
    // Compile the effects within the random group
    let mut inner_outputs = Vec::new();
    for (index, effect) in rg.effects.iter().enumerate() {
        if !effect_matches_phase(effect, repetition_phase) {
            continue;
        }
        ctx.set_preview_node(vec![serde_json::json!("randomGroups"), serde_json::json!(group_index), serde_json::json!("effects"), serde_json::json!(index)], &effect.params);
        if let Some(mut eo) = effects::compile_effect(effect, ctx, trigger) {
            *has_regular_effects |= !payout::is_reward(effect, ctx, trigger);
            eo.segment_id = effect_segment_id(rule_id, effect);
            inner_outputs.push(eo);
        }
    }

    if inner_outputs.is_empty() && !publishes_result {
        return vec![];
    }

    // Build the inner return block
    let inner_stmts = effects::build_return_block(&inner_outputs);

    // Each chance group has its own seed and configurable odds.
    let probability_index = ctx.next_probability_var_index();
    let random_group_index = ctx.next_random_group_index();
    let odds_var = format!("odds_{}", probability_index);
    let numerator_var = format!("numerator_{}", probability_index);
    let mut probability_stmts = Vec::new();
    let prob_check = if publishes_result {
        compile_targeted_probability_roll(rule_id, rg, ctx, &numerator_var, &odds_var,
            probability_index, random_group_index, &mut probability_stmts)
    } else if trigger == "probability_result" {
        let numerator: String = format!("rolled_numerator_{}", probability_index);
        let denominator = format!("rolled_denominator_{}", probability_index);
        let probability_vars = lua_call(
            "SMODS.get_probability_vars",
            vec![
                lua_ident("card"),
                lua_field(lua_raw_expr(ctx.ability_path()), &numerator_var),
                lua_field(lua_raw_expr(ctx.ability_path()), &odds_var),
                lua_str(ctx.smods_key()),
                lua_bool(true),
                lua_bool(false),
            ],
        );
        probability_stmts.push(lua_raw_stmt(format!(
            "local {}, {} = {}",
            numerator, denominator, probability_vars
        )));
        lua_lt(
            lua_call(
                "pseudorandom",
                vec![lua_str(format!("group{}", random_group_index))],
            ),
            lua_div(lua_ident(numerator), lua_ident(denominator)),
        )
    } else {
        lua_call(
            "SMODS.pseudorandom_probability",
            vec![
                lua_ident("card"),
                lua_str(format!("group{}", random_group_index)),
                lua_field(lua_raw_expr(ctx.ability_path()), &numerator_var),
                lua_field(lua_raw_expr(ctx.ability_path()), &odds_var),
                lua_str(ctx.smods_key()),
                lua_bool(false),
            ],
        )
    };
    probability_stmts.push(lua_if(prob_check, inner_stmts));

    // Register probability config variables
    ctx.add_config_int(&numerator_var, numerator);
    ctx.add_config_int(&odds_var, denom);
    ctx.bind_preview_group_value(&numerator_var, vec![serde_json::json!("randomGroups"), serde_json::json!(group_index), serde_json::json!("chance_numerator"), serde_json::json!("value")], &rg.chance_numerator);
    ctx.bind_preview_group_value(&odds_var, vec![serde_json::json!("randomGroups"), serde_json::json!(group_index), serde_json::json!("chance_denominator"), serde_json::json!("value")], &rg.chance_denominator);
    ctx.register_description_probability(&rg.id, context::DescriptionProbability {
        config_names: Some((numerator_var, odds_var)),
        numerator,
        denominator: denom,
    });

    let wrapped = effects::EffectOutput {
        return_fields: vec![],
        pre_return: probability_stmts,
        config_vars: vec![],
        message: None,
        colour: None,

        segment_id: None,
    };

    vec![wrapped]
}

fn targeted_probability_value(value: &ParamValue, config_name: &str, ctx: &CompileContext) -> Expr {
    if values::is_explicit_game_var(value) {
        values::resolve_value(value, ctx.object_type, None)
    } else if let Some(name) = param_value_user_var_name(value).filter(|name| ctx.has_user_var(name)) {
        ctx.user_var_expr(&name)
    } else if matches!(value, ParamValue::Typed(typed) if values::is_range_type(&typed.value_type))
        || value.as_str().is_some_and(|value| value.starts_with("RANGE:"))
    {
        values::resolve_value(value, ctx.object_type, None)
    } else {
        ctx.ability_var(config_name)
    }
}

fn compile_targeted_probability_roll(
    rule_id: &str,
    group: &RandomGroupDef,
    ctx: &CompileContext,
    numerator_var: &str,
    denominator_var: &str,
    probability_index: usize,
    random_group_index: usize,
    statements: &mut Vec<Stmt>,
) -> Expr {
    let result_var = format!("jf_probability_result_{}", probability_index);
    let numerator = targeted_probability_value(&group.chance_numerator, numerator_var, ctx);
    let denominator = targeted_probability_value(&group.chance_denominator, denominator_var, ctx);
    let identifier = lua_str(ctx.smods_key());
    let group_id = lua_str(&group.id);
    let lineage_key = lua_str(format!("{}:{}:{}", ctx.smods_key(), rule_id, group.id));
    let seed = lua_str(format!("group{}", random_group_index));

    statements.push(lua_raw_stmt(format!(r#"local {result_var} = false
do
    local jf_owner = context.blueprint_card or card
    local jf_path = context.jf_probability_path or {{}}
    local jf_owner_path = jf_path[jf_owner] or {{}}
    local jf_depth = context.jf_probability_depth or 0
    local jf_chain = context.jf_probability_chain or {{remaining = 128}}
    if not jf_owner_path[{lineage_key}] and jf_depth < 16 and jf_chain.remaining > 0 then
        jf_chain.remaining = jf_chain.remaining - 1
        local jf_next_path = {{}}
        for owner, visited in pairs(jf_path) do jf_next_path[owner] = visited end
        local jf_next_owner_path = {{}}
        for key, visited in pairs(jf_owner_path) do jf_next_owner_path[key] = visited end
        jf_next_owner_path[{lineage_key}] = true
        jf_next_path[jf_owner] = jf_next_owner_path
        local jf_numerator, jf_denominator = SMODS.get_probability_vars(card,
            tonumber({numerator}) or 0, tonumber({denominator}) or 1, {identifier}, true, false)
        {result_var} = pseudorandom({seed}) < jf_numerator / jf_denominator
        SMODS.post_prob = SMODS.post_prob or {{}}
        SMODS.post_prob[#SMODS.post_prob + 1] = {{
            pseudorandom_result = true, result = {result_var}, trigger_obj = card,
            numerator = jf_numerator, denominator = jf_denominator, identifier = {identifier},
            jf_probability_group_id = {group_id}, jf_probability_owner = jf_owner,
            jf_probability_path = jf_next_path, jf_probability_chain = jf_chain,
            jf_probability_depth = jf_depth + 1
        }}
    end
end"#)));
    lua_ident(result_var)
}

fn compile_loop_group(
    rule_id: &str,
    group_index: usize,
    lg: &LoopGroupDef,
    ctx: &mut CompileContext,
    trigger: &str,
    repetition_phase: Option<bool>,
    has_regular_effects: &mut bool,
) -> Vec<effects::EffectOutput> {
    let mut inner_outputs = Vec::new();
    for (index, effect) in lg.effects.iter().enumerate() {
        if !effect_matches_phase(effect, repetition_phase) {
            continue;
        }
        ctx.set_preview_node(vec![serde_json::json!("loops"), serde_json::json!(group_index), serde_json::json!("effects"), serde_json::json!(index)], &effect.params);
        if let Some(mut eo) = effects::compile_effect(effect, ctx, trigger) {
            *has_regular_effects |= !payout::is_reward(effect, ctx, trigger);
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
    let dynamic_count = if values::is_explicit_game_var(&lg.count) {
        Some(values::resolve_value(&lg.count, ctx.object_type, None))
    } else if let Some(name) = param_value_user_var_name(&lg.count)
        .filter(|name| ctx.has_user_var(name))
    {
        Some(ctx.user_var_expr(&name))
    } else if matches!(&lg.count, ParamValue::Typed(value) if values::is_range_type(&value.value_type))
        || lg.count.as_str().is_some_and(|value| value.starts_with("RANGE:"))
    {
        Some(values::resolve_value(&lg.count, ctx.object_type, None))
    } else {
        None
    };
    let loop_stop = if let Some(count) = dynamic_count {
        // Lua evaluates the bound once, so effects may mutate the source safely.
        // A runtime count of zero must skip the group rather than repeat once.
        lua_raw_expr(format!("math.max(0, math.floor(tonumber({count}) or 0))"))
    } else {
        let loop_count = lg.count.as_i64()
            .or_else(|| lg.count.as_str()?.trim().parse::<i64>().ok())
            .unwrap_or(1).max(1);
        ctx.add_config_int(&loop_var_name, loop_count);
        ctx.bind_preview_group_value(&loop_var_name, vec![serde_json::json!("loops"), serde_json::json!(group_index), serde_json::json!("repetitions"), serde_json::json!("value")], &lg.count);
        lua_field(lua_raw_expr(ctx.ability_path()), &loop_var_name)
    };

    let loop_stmt = Stmt::ForRange {
        var: "i".to_string(),
        start: lua_int(1),
        stop: loop_stop,
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
    if let Some(f) = build_discount_update_function(rule_outputs) {
        entries.push(TableEntry::KeyValue("update".to_string(), f));
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
        .filter(|r| !r.is_passive && r.trigger != "joker_obtained" && !r.effect_stmts.is_empty())
        .collect();

    let has_passive_calculate = rule_outputs.iter().any(|r| {
        r.is_passive
            && r.passive_outputs
                .iter()
                .any(|po| !po.calculate_stmts.is_empty())
    });
    let has_grouped_payout = rule_outputs.iter().any(|r| r.has_grouped_payout);

    if non_passive.is_empty() && !has_passive_calculate && !has_grouped_payout {
        return None;
    }

    // Group rules by trigger
    let mut body: Vec<Stmt> = Vec::new();
    if has_grouped_payout {
        body.push(payout::begin_round());
        for ro in rule_outputs.iter().filter(|r| !r.grouped_payout_stmts.is_empty()) {
            let mut condition = lua_and(lua_ident("jf_payout_evaluate"),
                triggers::trigger_context(ctx.object_type, &ro.trigger, false));
            if let Some(rule_condition) = &ro.condition_expr {
                condition = lua_and(condition, rule_condition.clone());
            }
            let stmt = lua_if(condition,
                wrap_rule_segment(&ro.rule_id, ro.grouped_payout_stmts.clone()));
            body.extend(wrap_trigger_stmt_for_rules(&[ro], stmt));
        }
    }
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

    // Normal scoring and repetition discovery are separate engine callbacks.
    let mut triggers_seen: Vec<(String, bool)> = Vec::new();
    for ro in &non_passive {
        let phase = (ro.trigger.clone(), ro.has_retrigger);
        if !triggers_seen.contains(&phase) {
            triggers_seen.push(phase);
        }
    }

    for (trigger, use_retrigger_context) in &triggers_seen {
        let rules_for_trigger: Vec<&RuleOutput> = non_passive
            .iter()
            .copied()
            .filter(|r| r.trigger == *trigger && r.has_retrigger == *use_retrigger_context)
            .collect();

        let has_trigger_destroy = rules_for_trigger.iter().any(|r| r.has_destroy);

        // Get the trigger context expression
        let trigger_ctx = triggers::trigger_context_for_rule(
            ctx.object_type,
            trigger,
            ctx.blueprint_compat,
            *use_retrigger_context,
        );

        let mut trigger_body: Vec<Stmt> = Vec::new();

        if has_trigger_destroy && trigger.as_str() != "card_discarded" {
            trigger_body.push(lua_assign(
                lua_path(&["context", "other_card", "should_destroy"]),
                lua_bool(false),
            ));
        }

        let build_rule_stmts = |ro: &RuleOutput| {
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
        };
        if ctx.rule_execution_mode == RuleExecutionMode::AllMatching {
            append_independent_rules(&mut trigger_body, &rules_for_trigger, build_rule_stmts);
        } else {
            append_rule_chain_with_fallback(&mut trigger_body, &rules_for_trigger, build_rule_stmts);
        }

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
    ctx: &CompileContext,
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

    let obtained_rules: Vec<&RuleOutput> = rule_outputs.iter()
        .filter(|rule| rule.trigger == "joker_obtained" && !rule.effect_stmts.is_empty())
        .collect();
    if !obtained_rules.is_empty() {
        let mut rule_body = Vec::new();
        let build_rule = |rule: &RuleOutput| {
            wrap_rule_segment(&rule.rule_id, rule.effect_stmts.clone())
        };
        if ctx.rule_execution_mode == RuleExecutionMode::AllMatching {
            append_independent_rules(&mut rule_body, &obtained_rules, build_rule);
        } else {
            append_rule_chain_with_fallback(&mut rule_body, &obtained_rules, build_rule);
        }
        let obtained_body = vec![
            lua_local("context", lua_table(vec![
                ("joker_obtained", lua_bool(true)),
                ("card", lua_ident("card")),
                ("other_card", lua_ident("card")),
                ("other_joker", lua_ident("card")),
                ("main_eval", lua_bool(true)),
            ])),
            lua_local("jf_run_obtained_rules", Expr::Function { params: vec![], body: rule_body }),
            lua_local("jf_obtained_effect", lua_call("jf_run_obtained_rules", vec![])),
            lua_if(lua_eq(lua_call("type", vec![lua_ident("jf_obtained_effect")]), lua_str("table")),
                vec![lua_expr_stmt(lua_call("SMODS.calculate_effect",
                    vec![lua_ident("jf_obtained_effect"), lua_ident("card")]))]),
        ];
        add_stmts.extend(wrap_trigger_stmt_for_rules(&obtained_rules,
            lua_if(lua_not(lua_ident("from_debuff")), obtained_body)));
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

/// Dynamic discounts need to refresh displayed prices when the amount or a
/// condition changes, while avoiding a full price refresh on every frame.
fn build_discount_update_function(rule_outputs: &[RuleOutput]) -> Option<Expr> {
    let mut states = Vec::new();
    for rule in rule_outputs {
        for hook in &rule.passive_hooks {
            if let PassiveHookSpec::DiscountItems { discount_amount, condition, .. } = hook {
                states.push(format!(
                    "tostring(tonumber({discount_amount}) or 0) .. ':' .. tostring(not not ({condition}))",
                    condition = condition.as_deref().unwrap_or("true"),
                ));
            }
        }
    }
    if states.is_empty() {
        return None;
    }
    let code = format!(
        "if not (G and G.GAME and G.jokers and card and card.area == G.jokers) then return end\n\
        local context = {{}}\n\
        local discount_state = tostring(not not card.debuff) .. ':' .. {}\n\
        if card.jf_discount_state ~= discount_state then\n\
            card.jf_discount_state = discount_state\n{}\nend",
        states.join(" .. ':' .. "), effects::economy::refresh_prices(),
    );
    Some(Expr::Function {
        params: vec!["self".into(), "card".into(), "dt".into()],
        body: vec![lua_raw_stmt(code)],
    })
}

/// Build guarded access to a fixed Lua path used while rendering a tooltip.
fn guarded_description_path(path: &str) -> Expr {
    let parts: Vec<&str> = path.split('.').collect();
    lua_and_chain(
        (1..=parts.len())
            .map(|end| lua_raw_expr(parts[..end].join(".")))
            .collect(),
    )
}

fn description_scoped_value(ctx: &CompileContext, name: &str, fallback: Expr) -> Expr {
    let live = lua_and(
        guarded_description_path(ctx.ability_path()),
        lua_index(lua_raw_expr(ctx.ability_path()), lua_str(name)),
    );
    let default = lua_and(
        guarded_description_path("self.config.extra"),
        lua_index(lua_raw_expr("self.config.extra"), lua_str(name)),
    );
    lua_or(lua_or(live, default), fallback)
}

/// Tooltips share the numeric catalog, with fallbacks for scoring-only values.
fn description_game_value(id: &str) -> Expr {
    let code = match id {
        "hand_level" => "G.GAME and G.GAME.hands and G.GAME.hands[G.GAME.last_hand_played or 'High Card'] and G.GAME.hands[G.GAME.last_hand_played or 'High Card'].level",
        "current_hand_played_count" | "times_hand_played" => "G.GAME and G.GAME.hands and G.GAME.hands[G.GAME.last_hand_played or 'High Card'] and G.GAME.hands[G.GAME.last_hand_played or 'High Card'].played",
        "scored_card_count" | "played_card_count" => "G.play and G.play.cards and #G.play.cards",
        "cumulative_chips" => "(function() local total = 0; for _, card in ipairs(G.play and G.play.cards or {}) do total = total + (card.base and card.base.nominal or 0) end; return total end)()",
        _ => {
            return values::game_var_lua_code(id)
                .map(lua_raw_expr)
                .unwrap_or_else(|| lua_int(0))
        }
    };
    lua_raw_expr(format!("((G and ({code})) or 0)"))
}

fn description_game_reference(reference: &str) -> Expr {
    if let Some(game) = values::parse_game_var(reference) {
        if values::game_var_lua_code(&game.var_id).is_none() {
            return lua_int(0);
        }
        return lua_add(
            lua_num(game.starts_from),
            lua_mul(description_game_value(&game.var_id), lua_num(game.multiplier)),
        );
    }
    if reference.starts_with("GAMEVAR:") {
        return lua_int(0);
    }
    description_game_value(reference)
}

fn description_scaled_game_value(id: &str, multiplier: f64, starts_from: f64) -> Expr {
    if !multiplier.is_finite()
        || !starts_from.is_finite()
        || values::game_var_lua_code(id).is_none()
    {
        return lua_int(0);
    }
    let value = description_game_value(id);
    if multiplier == 1.0 && starts_from == 0.0 {
        return value;
    }
    lua_add(lua_num(starts_from), lua_mul(value, lua_num(multiplier)))
}

fn description_param_value(value: &ParamValue, ctx: &CompileContext) -> Expr {
    match value {
        ParamValue::Int(n) => lua_int(*n),
        ParamValue::Float(n) => lua_num(*n),
        ParamValue::Bool(value) => lua_bool(*value),
        ParamValue::Str(value) => {
            if ctx.has_user_var(value) {
                return description_user_value(ctx, value).0;
            }
            if value.starts_with("GAMEVAR:") {
                return description_game_reference(value);
            }
            lua_str(value)
        }
        ParamValue::Typed(value) => {
            if values::is_game_variable_type(&value.value_type) {
                return value
                    .value
                    .as_str()
                    .map(description_game_reference)
                    .unwrap_or_else(|| lua_int(0));
            }
            if values::is_user_variable_type(&value.value_type) {
                return description_user_value(ctx, value.value.as_str().unwrap_or("")).0;
            }
            description_param_value(
                &match &value.value {
                    serde_json::Value::Number(n) => ParamValue::Float(n.as_f64().unwrap_or(0.0)),
                    serde_json::Value::Bool(value) => ParamValue::Bool(*value),
                    serde_json::Value::String(value) => ParamValue::Str(value.clone()),
                    _ => ParamValue::Int(0),
                },
                ctx,
            )
        }
    }
}

fn description_literal_value(value: &serde_json::Value) -> Expr {
    match value {
        serde_json::Value::Number(n) => lua_num(n.as_f64().unwrap_or(0.0)),
        serde_json::Value::Bool(value) => lua_bool(*value),
        serde_json::Value::String(value) => lua_str(value),
        serde_json::Value::Null => lua_int(0),
        _ => lua_str(value.to_string()),
    }
}

fn description_user_value(ctx: &CompileContext, name: &str) -> (Expr, Option<Expr>) {
    let Some(variable) = ctx
        .user_vars()
        .iter()
        .find(|variable| variable.name == name)
    else {
        return (lua_int(0), None);
    };
    // Initial values are literals even when their text happens to resemble another variable.
    let initial = match &variable.initial_value {
        ParamValue::Str(value) => lua_str(value),
        ParamValue::Typed(value) => description_literal_value(&value.value),
        value => description_param_value(value, ctx),
    };
    let current = if variable.is_global {
        let path = if variable.is_persistent {
            "JF_GLOBALS"
        } else {
            "G.GAME.jf_global_vars"
        };
        lua_or(
            lua_and(
                guarded_description_path(path),
                lua_index(lua_raw_expr(path), lua_str(name)),
            ),
            initial,
        )
    } else {
        description_scoped_value(ctx, name, initial)
    };
    // Global typed variables use the same scalar store as other globals.
    // A local variable with the same name must not override their tooltip value.
    if variable.is_global {
        return match variable.var_type {
            UserVarType::Suit => (
                lua_call("localize", vec![current.clone(), lua_str("suits_singular")]),
                Some(lua_index(lua_raw_expr("G.C.SUITS"), current)),
            ),
            UserVarType::Rank => (
                lua_call("localize", vec![current, lua_str("ranks")]),
                None,
            ),
            UserVarType::PokerHand => (
                lua_call("localize", vec![current, lua_str("poker_hands")]),
                None,
            ),
            _ => (current, None),
        };
    }
    let round = guarded_description_path("G.GAME.current_round");
    let card_variable = lua_index(
        lua_raw_expr("G.GAME.current_round"),
        lua_str(format!("{name}_card")),
    );
    match variable.var_type {
        UserVarType::Suit | UserVarType::Rank => {
            let field = if variable.var_type == UserVarType::Suit {
                "suit"
            } else {
                "rank"
            };
            let value = lua_or(
                lua_and_chain(vec![
                    round,
                    card_variable.clone(),
                    lua_field(card_variable, field),
                ]),
                current,
            );
            let localize_set = if variable.var_type == UserVarType::Suit {
                "suits_singular"
            } else {
                "ranks"
            };
            let colour = if variable.var_type == UserVarType::Suit {
                Some(lua_index(lua_raw_expr("G.C.SUITS"), value.clone()))
            } else {
                None
            };
            (
                lua_call("localize", vec![value, lua_str(localize_set)]),
                colour,
            )
        }
        UserVarType::PokerHand => {
            let hand = lua_index(
                lua_raw_expr("G.GAME.current_round"),
                lua_str(format!("{name}_hand")),
            );
            let value = lua_or(lua_and(round, hand), current);
            (
                lua_call("localize", vec![value, lua_str("poker_hands")]),
                None,
            )
        }
        _ => (current, None),
    }
}

fn build_ordered_description_vars(ctx: &CompileContext) -> (Vec<Stmt>, Vec<TableEntry>, Vec<usize>) {
    let mut body = Vec::new();
    let mut vars = Vec::new();
    let mut text_slots = Vec::new();
    let mut colours = Vec::new();
    let mut probabilities = std::collections::HashMap::<String, (String, String)>::new();
    for (index, binding) in ctx
        .description_variables()
        .unwrap_or_default()
        .iter()
        .enumerate()
    {
        let value = match binding {
            DescriptionVariableBinding::Literal { value } => description_literal_value(value),
            DescriptionVariableBinding::User { name } => {
                if ctx.user_vars().iter().any(|uv| {
                    uv.name == *name && uv.var_type == UserVarType::Text
                }) {
                    text_slots.push(index + 1);
                }
                let (value, colour) = description_user_value(ctx, name);
                if let Some(colour) = colour {
                    colours.push(TableEntry::Value(colour));
                }
                value
            }
            DescriptionVariableBinding::Config {
                name,
                effect_id,
                fallback,
            } => {
                let fallback = fallback
                    .as_ref()
                    .map(|value| description_param_value(value, ctx))
                    .unwrap_or_else(|| lua_int(0));
                let config_name = match effect_id {
                    Some(id) => ctx.effect_config_names(id).and_then(|names| {
                        names
                            .iter()
                            .find(|actual| {
                                actual.trim_end_matches(|c: char| c.is_ascii_digit())
                                    == name.trim_end_matches(|c: char| c.is_ascii_digit())
                            })
                            .or_else(|| names.first())
                    }),
                    None => ctx
                        .config_vars()
                        .iter()
                        .find(|var| var.name == *name)
                        .map(|var| &var.name),
                };
                config_name
                    .map(|name| description_scoped_value(ctx, name, fallback.clone()))
                    .unwrap_or(fallback)
            }
            DescriptionVariableBinding::Game {
                id,
                multiplier,
                starts_from,
            } => {
                description_scaled_game_value(id, *multiplier, *starts_from)
            }
            DescriptionVariableBinding::Probability { group_id, part } => {
                let (numerator, denominator) =
                    probabilities.entry(group_id.clone()).or_insert_with(|| {
                        let numerator_name = format!("description_numerator{index}");
                        let denominator_name = format!("description_denominator{index}");
                        let probability = ctx.description_probability(group_id);
                        let mut numerator = lua_int(probability.map(|p| p.numerator).unwrap_or(1));
                        let mut denominator =
                            lua_int(probability.map(|p| p.denominator).unwrap_or(2));
                        if let Some((num, den)) = probability.and_then(|p| p.config_names.as_ref())
                        {
                            numerator = description_scoped_value(ctx, num, numerator);
                            denominator = description_scoped_value(ctx, den, denominator);
                        }
                        body.push(lua_raw_stmt(format!(
                            "local {numerator_name}, {denominator_name}"
                        )));
                        body.push(Stmt::MultiAssign(
                            vec![lua_ident(&numerator_name), lua_ident(&denominator_name)],
                            vec![lua_call(
                                "SMODS.get_probability_vars",
                                vec![
                                    lua_ident("card"),
                                    numerator,
                                    denominator,
                                    lua_str(ctx.smods_key()),
                                ],
                            )],
                        ));
                        (numerator_name, denominator_name)
                    });
                lua_ident(
                    match part {
                        ProbabilityPart::Numerator => numerator,
                        ProbabilityPart::Denominator => denominator,
                    }
                    .clone(),
                )
            }
        };
        vars.push(TableEntry::Value(value));
    }
    let mut entries = vec![TableEntry::KeyValue(
        "vars".to_string(),
        lua_table_raw(vars),
    )];
    if !colours.is_empty() {
        entries.push(TableEntry::KeyValue(
            "colours".to_string(),
            lua_table_raw(colours),
        ));
    }
    (body, entries, text_slots)
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

    if vars.is_empty() && !has_user_vars && !has_info_queue && ctx.description_variables().is_none() {
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

    if ctx.description_variables().is_some() {
        let (statements, entries, text_slots) = build_ordered_description_vars(ctx);
        body.extend(statements);
        body.extend(description::return_loc_vars(ctx, entries, &text_slots));
        return Some(Expr::Function { params: vec!["self".into(), "info_queue".into(), "card".into()], body });
    }

    let mut var_refs: Vec<TableEntry> = Vec::new();
    let mut colour_refs: Vec<TableEntry> = Vec::new();
    let mut text_slots = Vec::new();
    for uv in ctx.user_vars() {
        if uv.is_global && !referenced_user_vars.contains(&uv.name) {
            continue;
        }
        let (value, colour) = description_user_value(ctx, &uv.name);
        var_refs.push(TableEntry::Value(value));
        if uv.var_type == UserVarType::Text {
            text_slots.push(var_refs.len());
        }
        if let Some(colour) = colour {
            colour_refs.push(TableEntry::Value(colour));
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
    body.extend(description::return_loc_vars(ctx, return_entries, &text_slots));

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
        if uv.is_global {
            continue;
        }
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
    fn reward_stmts(rule: &RuleOutput, reward: &BlindRewardOutput) -> Vec<Stmt> {
        let add_stmt = lua_assign(lua_ident("blind_reward"), lua_add(
            lua_ident("blind_reward"),
            lua_call("math.max", vec![reward.amount_expr.clone(), lua_int(0)]),
        ));
        let mut statements = if let Some(id) = &reward.segment_id {
            vec![stmt_section_begin(id), add_stmt, stmt_section_end(id)]
        } else {
            vec![add_stmt]
        };
        if let Some(condition) = &reward.condition_expr {
            statements = vec![lua_if(condition.clone(), statements)];
        }
        wrap_trigger_stmt_for_rules(&[rule], Stmt::DoBlock(
            wrap_rule_segment(&rule.rule_id, statements)))
    }

    let mut regular = Vec::new();
    let mut boss = Vec::new();

    for ro in rule_outputs {
        for reward in &ro.blind_rewards {
            if reward.boss_only {
                boss.push((ro, reward));
            } else {
                regular.push((ro, reward));
            }
        }
    }

    let has_grouped_payout = rule_outputs.iter().any(|r| r.has_grouped_payout);
    if regular.is_empty() && boss.is_empty() && !has_grouped_payout {
        return None;
    }

    let mut body = vec![payout::cashout_context()];
    body.push(lua_local("blind_reward", if has_grouped_payout {
        payout::read_total()
    } else {
        lua_int(0)
    }));

    if !boss.is_empty() {
        let mut boss_body: Vec<Stmt> = Vec::new();
        for (rule, reward) in &boss {
            boss_body.extend(reward_stmts(rule, reward));
        }
        body.push(lua_if(
            lua_raw_expr("G.GAME.blind and G.GAME.blind.boss"),
            boss_body,
        ));
    }

    for (rule, reward) in &regular {
        body.extend(reward_stmts(rule, reward));
    }

    body.push(lua_if(
        lua_gt(lua_ident("blind_reward"), lua_int(0)),
        vec![lua_return(lua_ident("blind_reward"))],
    ));

    Some(Expr::Function {
        params: vec!["self".into(), "card".into()],
        body,
    })
}

fn passive_hook_from_effect(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    condition_expr: Option<&Expr>,
) -> Option<PassiveHookSpec> {
    let joker_key = ctx.smods_key();
    match effect.effect_type.as_str() {
        "discount_items" => {
            let (discount_type, discount_method, discount_amount) =
                effects::economy::discount_settings(effect, ctx);
            Some(PassiveHookSpec::DiscountItems {
                joker_key,
                discount_type,
                discount_method,
                discount_amount,
                condition: condition_expr.map(|expr| Emitter::new().emit_expr_to_string(expr)),
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
            "local card_set_cost_ref = Card.set_cost\nfunction Card:set_cost(...)\n    local result = card_set_cost_ref(self, ...)\n    if type(self.cost) == 'number' then\n    local original_cost = self.cost",
        );
        code.push_str(&format!("\n{}", effects::economy::discount_card_locals()));
        for hook in discount_hooks {
            if let PassiveHookSpec::DiscountItems {
                joker_key,
                discount_type,
                discount_method,
                discount_amount,
                condition,
            } = hook
            {
                let cond = effects::economy::discount_type_to_condition(discount_type);
                let logic = effects::economy::discount_method_to_logic(discount_method, "discount_amount");
                let key = Emitter::new().emit_expr_to_string(&lua_str(joker_key));
                code.push_str(&format!(
                    "\n    for _, discount_joker in ipairs(SMODS.find_card({key})) do\n\
                    if discount_joker and not discount_joker.debuff then\n\
                        local card = discount_joker\n\
                        local context = {{}}\n\
                        if ({condition}) and ({cond}) then\n\
                            local discount_amount = tonumber({discount_amount}) or 0\n\
                            {logic}\n\
                        end\n\
                    end\nend",
                    condition = condition.as_deref().unwrap_or("true"),
                ));
            }
        }
        code.push_str(&format!("\n    if self.cost ~= original_cost then\n{}\nend\nend\nreturn result\nend", effects::economy::update_discount_sell_cost()));
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

        let source_check =
            |source_rank_type: &str, source_ranks: &[String], subject: &str| match source_rank_type
            {
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

/// Build the `in_pool` function for appearance restrictions.
fn build_in_pool(appearance: &AppearanceDef, ctx: &CompileContext) -> Option<Expr> {
    if appearance.appears_in.is_empty()
        && appearance.not_appears_in.is_empty()
        && appearance.appear_flags.is_empty()
    {
        return None;
    }

    let mut conditions: Vec<Expr> = Vec::new();

    // Not appears in checks
    for pool in &appearance.not_appears_in {
        conditions.push(lua_not(lua_or_chain(vec![
            lua_eq(lua_field(lua_ident("args"), "type"), lua_str(pool)),
            lua_eq(lua_field(lua_ident("args"), "source"), lua_str(pool)),
        ])));
    }

    // Appears in checks
    if !appearance.appears_in.is_empty() {
        let appear_checks: Vec<Expr> = appearance
            .appears_in
            .iter()
            .map(|pool| {
                lua_or_chain(vec![
                    lua_eq(lua_field(lua_ident("args"), "type"), lua_str(pool)),
                    lua_eq(lua_field(lua_ident("args"), "source"), lua_str(pool)),
                ])
            })
            .collect();
        conditions.push(lua_or_chain(appear_checks));
    }

    for flag in &appearance.appear_flags {
        let flag = flag.trim();
        let (name, negate) = flag
            .strip_prefix("not ")
            .map_or((flag, false), |name| (name.trim(), true));
        let value = ctx.flag_value(name);
        conditions.push(if negate { lua_not(value) } else { value });
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
            let rule_stmts = build_rule_stmts(ro);
            out.push(Stmt::DoBlock(rule_stmts));
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
        fallback_tail = Some(vec![next]);
    }

    if let Some(stmts) = fallback_tail {
        out.extend(stmts);
    }
}

fn append_independent_rules<F>(
    out: &mut Vec<Stmt>,
    rules_for_trigger: &[&RuleOutput],
    mut build_rule_stmts: F,
) where
    F: FnMut(&RuleOutput) -> Vec<Stmt>,
{
    out.push(lua_local("jf_rule_effects", lua_table_raw(vec![])));
    for ro in rules_for_trigger {
        let rule_stmts = vec![
            lua_local("jf_run_rule", Expr::Function {
                params: vec![],
                body: build_rule_stmts(ro),
            }),
            lua_local("jf_rule_effect", lua_call("jf_run_rule", vec![])),
            lua_if(
                lua_raw_expr("jf_rule_effect == true or (type(jf_rule_effect) == 'table' and next(jf_rule_effect))"),
                vec![lua_raw_stmt("jf_rule_effects[#jf_rule_effects + 1] = jf_rule_effect")],
            ),
        ];
        if let Some(condition) = &ro.condition_expr {
            out.push(lua_if(condition.clone(), rule_stmts));
        } else {
            out.push(Stmt::DoBlock(rule_stmts));
        }
    }

    out.push(lua_raw_stmt(
        "local jf_remove = false\n\
        for _, jf_rule_effect in ipairs(jf_rule_effects) do\n\
            local jf_effect = jf_rule_effect\n\
            while jf_effect == true or type(jf_effect) == 'table' do\n\
                if jf_effect == true then\n\
                    jf_remove = true\n\
                    break\n\
                end\n\
                jf_remove = jf_remove or not not jf_effect.remove\n\
                jf_effect = jf_effect.extra\n\
            end\n\
        end",
    ));
    out.push(lua_local("jf_merged_effect", lua_call("SMODS.merge_effects", vec![lua_ident("jf_rule_effects")])));
    out.push(lua_if(lua_ident("jf_merged_effect"), vec![
        lua_if(lua_ident("jf_remove"), vec![lua_assign(
            lua_field(lua_ident("jf_merged_effect"), "remove"), lua_bool(true),
        )]),
        lua_return(lua_ident("jf_merged_effect")),
    ]));
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
    if ctx.description_variables().is_some() {
        let (mut body, entries, text_slots) = build_ordered_description_vars(ctx);
        body.extend(description::return_loc_vars(ctx, entries, &text_slots));
        return Some(Expr::Function { params: vec!["self".into(), "info_queue".into(), "card".into()], body });
    }
    let vars = ctx.config_vars();
    let has_user_vars = ctx
        .user_vars()
        .iter()
        .any(|uv| !uv.is_global || ctx.user_var_is_referenced(&uv.name));

    if vars.is_empty() && !has_user_vars {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();

    let mut var_refs: Vec<TableEntry> = Vec::new();
    let mut text_slots = Vec::new();
    // Use the card's current value, with definition defaults for collection previews.
    for uv in ctx
        .user_vars()
        .iter()
        .filter(|uv| !uv.is_global || ctx.user_var_is_referenced(&uv.name))
    {
        var_refs.push(TableEntry::Value(description_user_value(ctx, &uv.name).0));
        if uv.var_type == UserVarType::Text {
            text_slots.push(var_refs.len());
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
    body.extend(description::return_loc_vars(ctx, return_entries, &text_slots));

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
