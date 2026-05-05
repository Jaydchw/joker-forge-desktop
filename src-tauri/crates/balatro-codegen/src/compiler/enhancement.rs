use super::context::CompileContext;
use super::{build_shared_loc_vars, compile_rules, RuleOutput};
use crate::lua_ast::*;
use crate::types::*;

/// Compile an enhancement definition into a Lua chunk.
pub fn compile_enhancement(enhancement: &EnhancementDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Enhancement,
        mod_prefix.to_string(),
        enhancement.key.clone(),
        false,
    );
    ctx.set_user_vars(enhancement.user_variables.clone());

    let rule_outputs = compile_rules(&enhancement.rules, &mut ctx);
    let table = build_enhancement_table(enhancement, &ctx, &rule_outputs);

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Enhancement"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    Chunk {
        stmts: vec![lua_comment(format!(" {}", enhancement.name)), smods_call],
    }
}

/// Extract base config values from unconditional simple effects.
/// For enhancements: simple effects like add_chips/add_mult on card_scored become
/// config fields (bonus, mult, h_chips, h_mult, p_dollars: h_dollars).
fn extract_base_config(rules: &[RuleDef]) -> Vec<(String, f64)> {
    let mut config: Vec<(String, f64)> = Vec::new();

    for rule in rules {
        // Only unconditional rules
        if !rule.condition_groups.is_empty() {
            continue;
        }
        let trigger = rule.trigger.as_str();
        if trigger != "card_scored" && trigger != "card_held_in_hand" {
            continue;
        }

        for effect in &rule.effects {
            let value = effect
                .params
                .get("value")
                .and_then(|v| v.as_f64())
                .unwrap_or_else(|| match effect.effect_type.as_str() {
                    "add_mult" => 4.0,
                    "add_chips" => 30.0,
                    "edit_dollars" => 1.0,
                    _ => 0.0,
                });

            // check whether this is a simple numeric value (not a game variable or range)
            let is_simple = effect
                .params
                .get("value")
                .map(|v| match v {
                    ParamValue::Int(_) | ParamValue::Float(_) => true,
                    ParamValue::Str(s) => {
                        !s.contains("GAMEVAR:") && !s.contains("RANGE:") && s.parse::<f64>().is_ok()
                    }
                    _ => false,
                })
                .unwrap_or(true);

            if !is_simple {
                continue;
            }

            match (effect.effect_type.as_str(), trigger) {
                ("add_chips", "card_scored") => config.push(("bonus".to_string(), value)),
                ("add_chips", "card_held_in_hand") => config.push(("h_chips".to_string(), value)),
                ("add_mult", "card_scored") => config.push(("mult".to_string(), value)),
                ("add_mult", "card_held_in_hand") => config.push(("h_mult".to_string(), value)),
                ("edit_dollars", "card_scored") => config.push(("p_dollars".to_string(), value)),
                ("edit_dollars", "card_held_in_hand") => {
                    config.push(("h_dollars".to_string(), value))
                }
                _ => {}
            }
        }
    }

    config
}

/// check whether any rule has destroy effects (non-discard triggers)
fn has_non_discard_destroy(rules: &[RuleDef]) -> bool {
    rules.iter().any(|r| {
        r.trigger != "card_discarded"
            && r.effects
                .iter()
                .any(|e| e.effect_type == "destroy_playing_card")
    })
}

/// check whether any rule has retrigger effects
fn has_retrigger_effects(rules: &[RuleDef]) -> bool {
    rules
        .iter()
        .any(|r| r.effects.iter().any(|e| e.effect_type == "retrigger_card"))
}

fn build_enhancement_table(
    enhancement: &EnhancementDef,
    ctx: &CompileContext,
    rule_outputs: &[RuleOutput],
) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&enhancement.key)));

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(enhancement.pos.x as i64)),
            ("y", lua_int(enhancement.pos.y as i64)),
        ]),
    ));

    // Config: base config + extra
    let base_config = extract_base_config(&enhancement.rules);
    let config_extra = ctx.build_config_extra_table();
    let has_base = !base_config.is_empty();
    let has_extra = !config_extra.is_empty();

    if has_base || has_extra {
        let mut config_entries: Vec<TableEntry> = Vec::new();
        for (key, value) in &base_config {
            let expr = if value.fract() == 0.0 {
                lua_int(*value as i64)
            } else {
                lua_num(*value)
            };
            config_entries.push(TableEntry::KeyValue(key.clone(), expr));
        }
        if has_extra {
            config_entries.push(TableEntry::KeyValue(
                "extra".to_string(),
                lua_table_raw(config_extra),
            ));
        }
        entries.push(TableEntry::KeyValue(
            "config".to_string(),
            lua_table_raw(config_entries),
        ));
    }

    // loc_txt
    let text_entries: Vec<TableEntry> = enhancement
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();
    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&enhancement.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ]),
    ));

    entries.push(kv("atlas", lua_str(&enhancement.atlas)));

    // Boolean flags
    if let Some(v) = enhancement.any_suit {
        entries.push(kv("any_suit", lua_bool(v)));
    }
    if has_non_discard_destroy(&enhancement.rules) {
        entries.push(kv("shatters", lua_bool(true)));
    }
    if let Some(v) = enhancement.replace_base_card {
        entries.push(kv("replace_base_card", lua_bool(v)));
    }
    if let Some(v) = enhancement.no_rank {
        entries.push(kv("no_rank", lua_bool(v)));
    }
    if let Some(v) = enhancement.no_suit {
        entries.push(kv("no_suit", lua_bool(v)));
    }
    if let Some(v) = enhancement.always_scores {
        entries.push(kv("always_scores", lua_bool(v)));
    }
    if let Some(v) = enhancement.unlocked {
        entries.push(kv("unlocked", lua_bool(v)));
    }
    if let Some(v) = enhancement.discovered {
        entries.push(kv("discovered", lua_bool(v)));
    }
    if let Some(v) = enhancement.no_collection {
        entries.push(kv("no_collection", lua_bool(v)));
    }
    if let Some(v) = enhancement.weight {
        entries.push(kv("weight", lua_num(v)));
    }

    // loc_vars
    if let Some(f) = build_shared_loc_vars(ctx, rule_outputs) {
        entries.push(TableEntry::KeyValue("loc_vars".to_string(), f));
    }

    // calculate function with destroy/retrigger handling
    if let Some(f) = build_card_calculate_function(
        rule_outputs,
        ctx,
        has_non_discard_destroy(&enhancement.rules),
        has_retrigger_effects(&enhancement.rules),
        "enhancement",
    ) {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    lua_table_raw(entries)
}

/// Build a calculate function specific to card types (enhancements, seals: editions).
/// Handles destroy_card and retrigger contexts.
pub(crate) fn build_card_calculate_function(
    rule_outputs: &[RuleOutput],
    ctx: &CompileContext,
    has_destroy: bool,
    has_retrigger: bool,
    item_type: &str,
) -> Option<Expr> {
    let non_passive: Vec<&RuleOutput> = rule_outputs
        .iter()
        .filter(|r| !r.is_passive && !r.effect_stmts.is_empty())
        .collect();

    if non_passive.is_empty() && !has_destroy && !has_retrigger {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();

    // Destroy card handling
    if has_destroy {
        let destroy_check = lua_and(
            lua_path(&["context", "destroy_card"]),
            lua_and(
                lua_eq(lua_path(&["context", "cardarea"]), lua_path(&["G", "play"])),
                lua_and(
                    lua_eq(lua_path(&["context", "destroy_card"]), lua_ident("card")),
                    lua_path(&["card", "should_destroy"]),
                ),
            ),
        );

        let destroy_body = if item_type == "enhancement" {
            vec![lua_return(lua_table(vec![("remove", lua_bool(true))]))]
        } else {
            vec![
                lua_raw_stmt(
                    "G.E_MANAGER:add_event(Event({\n                func = function()\n                    card:start_dissolve()\n                    return true\n                end\n            }))",
                ),
                lua_raw_stmt(
                    "card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {message = \"Card Destroyed!\", colour = G.C.RED})",
                ),
                lua_return(Expr::Nil),
            ]
        };

        body.push(lua_if(destroy_check, destroy_body));
    }

    // Retrigger handling
    if has_retrigger {
        let ability_path = ctx.ability_path();
        body.push(lua_if(
            lua_and(
                lua_path(&["context", "repetition"]),
                lua_path(&["card", "should_retrigger"]),
            ),
            vec![lua_return(lua_table(vec![(
                "repetitions",
                lua_field(lua_raw_expr(ability_path), "retrigger_times"),
            )]))],
        ));
    }

    // Group rules by trigger
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

        let use_retrigger = rules_for_trigger.iter().any(|r| r.has_retrigger);
        let has_trigger_destroy = rules_for_trigger.iter().any(|r| r.has_destroy);

        let trigger_ctx = super::triggers::trigger_context_for_rule(
            ctx.object_type,
            trigger,
            false,
            use_retrigger,
        );

        let mut trigger_body: Vec<Stmt> = Vec::new();

        if has_trigger_destroy && trigger.as_str() != "card_discarded" {
            trigger_body.push(lua_assign(
                lua_path(&["card", "should_destroy"]),
                lua_bool(false),
            ));
        }
        if use_retrigger {
            trigger_body.push(lua_assign(
                lua_path(&["card", "should_retrigger"]),
                lua_bool(false),
            ));
        }

        super::append_rule_chain_with_fallback(&mut trigger_body, &rules_for_trigger, |ro| {
            let mut stmts = ro.effect_stmts.clone();
            if ro.has_destroy && trigger.as_str() != "card_discarded" {
                stmts.insert(
                    0,
                    lua_assign(lua_path(&["card", "should_destroy"]), lua_bool(true)),
                );
            }
            stmts
        });

        if !trigger_body.is_empty() {
            body.push(lua_if(trigger_ctx, trigger_body));
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

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}
