use balatro_codegen::{compile_node_snippet, format_lua_source, Emitter, ObjectType};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};

use super::types::{EntityState, EntityUserVariable, Node, NodeCategory, SnippetResponse};

pub trait Compiler {
    fn compile_entity(&self, state: &EntityState) -> String;
    fn compile_node(
        &self,
        state: &EntityState,
        node: &Node,
        dependencies: &[Node],
    ) -> SnippetResponse;
}

/// Real compiler backed by the balatro-codegen crate.
pub struct BalatroCompiler;

impl BalatroCompiler {
    fn resolve_object_type(entity_type: &str) -> ObjectType {
        match entity_type {
            "joker" => ObjectType::Joker,
            "consumable" => ObjectType::Consumable,
            "consumable_type" => ObjectType::ConsumableType,
            "enhancement" | "card" => ObjectType::Enhancement,
            "seal" => ObjectType::Seal,
            "edition" => ObjectType::Edition,
            "rarity" => ObjectType::Rarity,
            "voucher" => ObjectType::Voucher,
            "deck" => ObjectType::Deck,
            "booster" => ObjectType::Booster,
            _ => ObjectType::Joker,
        }
    }

    /// Convert the entity state graph into a JokerDef and compile it.
    fn compile_joker_entity(state: &EntityState) -> String {
        use balatro_codegen::types::*;

        // Extract rules from the graph.
        // Walk the node graph: triggers → conditions → effects.
        // Uses ParsedNodeType for safe, enum-based category dispatch.
        let trigger_nodes: Vec<&Node> = state
            .nodes
            .values()
            .filter(|n| {
                matches!(
                    n.parsed_type().map(|p| p.category),
                    Some(NodeCategory::Trigger)
                )
            })
            .collect();

        let mut rules: Vec<RuleDef> = Vec::new();

        for trigger_node in &trigger_nodes {
            let trigger_type = trigger_node
                .parsed_type()
                .map(|p| p.kind)
                .unwrap_or_else(|| trigger_node.node_type.clone());

            // Find all nodes downstream of this trigger
            let (conditions, effects) = collect_downstream(state, &trigger_node.id);
            let condition_groups = build_condition_groups(conditions);
            let (effect_defs, random_groups, loop_groups) = build_effect_groups(effects);
            let (retrigger, destroy) =
                compute_rule_flags(&effect_defs, &random_groups, &loop_groups);

            rules.push(RuleDef {
                id: trigger_node.id.clone(),
                trigger: trigger_type,
                retrigger,
                destroy,
                condition_groups,
                effects: effect_defs,
                random_groups,
                loop_groups,
            });
        }

        let description = split_description(
            state
                .metadata
                .description
                .as_deref()
                .unwrap_or("No description"),
        );

        let joker = JokerDef {
            key: state.metadata.internal_id.clone(),
            name: state
                .metadata
                .name
                .clone()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| state.metadata.internal_id.replace('_', " ")),
            description,
            cost: state.metadata.base_cost,
            rarity: state.metadata.rarity_tier.clone(),
            blueprint_compat: state.metadata.blueprint_compatible,
            eternal_compat: state.metadata.eternal_compatible.unwrap_or(true),
            perishable_compat: state.metadata.perishable_compatible.unwrap_or(true),
            unlocked: state.metadata.unlocked.unwrap_or(true),
            discovered: state.metadata.discovered.unwrap_or(true),
            atlas: "CustomJokers".to_string(),
            pos: AtlasPos { x: 0, y: 0 },
            soul_pos: None,
            display_size: None,
            rules,
            appearance: None,
            unlock: None,
            user_variables: map_user_variables(&state.metadata.user_variables),
            force_eternal: state.metadata.force_eternal,
            force_perishable: state.metadata.force_perishable,
            force_rental: state.metadata.force_rental,
            force_foil: state.metadata.force_foil,
            force_holographic: state.metadata.force_holographic,
            force_polychrome: state.metadata.force_polychrome,
            force_negative: state.metadata.force_negative,
            ignore_slot_limit: state.metadata.ignore_slot_limit,
            info_queues: state.metadata.info_queues.clone(),
        };

        let chunk = balatro_codegen::compile_joker(&joker, "mod");
        format_lua_source(&Emitter::new().emit_chunk(&chunk))
    }
}

impl Compiler for BalatroCompiler {
    fn compile_entity(&self, state: &EntityState) -> String {
        match state.entity_type.as_str() {
            "joker" => Self::compile_joker_entity(state),
            _ => format!(
                "-- code generation for '{}' entities is not yet implemented\nreturn {{}}",
                state.entity_type
            ),
        }
    }

    fn compile_node(
        &self,
        state: &EntityState,
        node: &Node,
        _dependencies: &[Node],
    ) -> SnippetResponse {
        let object_type = Self::resolve_object_type(&state.entity_type);

        let params: std::collections::HashMap<String, serde_json::Value> = node.values.clone();

        let code = compile_node_snippet(&node.node_type, &params, object_type, "mod");

        let description = if let Some(p) = node.parsed_type() {
            let cat = match p.category {
                NodeCategory::Trigger => "Trigger",
                NodeCategory::Condition => "Condition",
                NodeCategory::Effect => "Effect",
            };
            format!("{} block: {}", cat, p.kind.replace('_', " "))
        } else {
            format!("Unknown block: {}", node.node_type.replace('_', " "))
        };

        SnippetResponse { code, description }
    }
}

/// Walk the graph downstream from a trigger: collecting condition and effect nodes.
///
/// Uses `Node::parsed_type()` for enum-based category dispatch rather than
/// `starts_with` string checks.
fn collect_downstream<'a>(
    state: &'a EntityState,
    start_id: &str,
) -> (Vec<&'a Node>, Vec<&'a Node>) {
    let mut conditions = Vec::new();
    let mut effects = Vec::new();
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue = vec![start_id.to_string()];

    while let Some(current_id) = queue.pop() {
        for edge in &state.edges {
            if edge.source_id == current_id && !visited.contains(&edge.target_id) {
                visited.insert(edge.target_id.clone());
                if let Some(target_node) = state.nodes.get(&edge.target_id) {
                    match target_node.parsed_type().map(|p| p.category) {
                        Some(NodeCategory::Condition) => conditions.push(target_node),
                        Some(NodeCategory::Effect) => effects.push(target_node),
                        _ => {}
                    }
                    queue.push(edge.target_id.clone());
                }
            }
        }
    }

    (conditions, effects)
}

fn build_condition_groups(
    conditions: Vec<&Node>,
) -> Vec<balatro_codegen::types::ConditionGroupDef> {
    use balatro_codegen::types::{ConditionDef, ConditionGroupDef, LogicOp};

    if conditions.is_empty() {
        return vec![];
    }

    let mut group_order: Vec<String> = Vec::new();
    let mut grouped: BTreeMap<String, Vec<&Node>> = BTreeMap::new();

    for node in conditions {
        let group_id = get_string_value(
            &node.values,
            &[
                "condition_group_id",
                "conditionGroupId",
                "group_id",
                "groupId",
            ],
        )
        .unwrap_or_else(|| "default".to_string());

        if !group_order.contains(&group_id) {
            group_order.push(group_id.clone());
        }

        grouped.entry(group_id).or_default().push(node);
    }

    group_order
        .into_iter()
        .filter_map(|group_id| {
            let nodes = grouped.get(&group_id)?;

            let logic_operator = nodes
                .iter()
                .find_map(|n| {
                    get_string_value(
                        &n.values,
                        &["group_logic", "group_operator", "groupOperator", "logic"],
                    )
                    .and_then(|s| parse_logic_op(&s))
                })
                .unwrap_or(LogicOp::And);

            let conditions: Vec<ConditionDef> = nodes
                .iter()
                .map(|n| {
                    let kind = n
                        .parsed_type()
                        .map(|p| p.kind)
                        .unwrap_or_else(|| n.node_type.clone());

                    let operator = get_string_value(
                        &n.values,
                        &["condition_operator", "logical_operator", "operator"],
                    )
                    .and_then(|s| parse_logic_op(&s));

                    ConditionDef {
                        condition_type: kind,
                        negate: n
                            .values
                            .get("negate")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                        operator,
                        params: convert_values(&n.values),
                    }
                })
                .collect();

            Some(ConditionGroupDef {
                logic_operator,
                conditions,
            })
        })
        .collect()
}

fn build_effect_groups(
    effects: Vec<&Node>,
) -> (
    Vec<balatro_codegen::types::EffectDef>,
    Vec<balatro_codegen::types::RandomGroupDef>,
    Vec<balatro_codegen::types::LoopGroupDef>,
) {
    use balatro_codegen::types::{EffectDef, LoopGroupDef, ParamValue, RandomGroupDef};

    #[derive(Default)]
    struct RandomAcc {
        chance_numerator: Option<ParamValue>,
        chance_denominator: Option<ParamValue>,
        effects: Vec<EffectDef>,
    }

    #[derive(Default)]
    struct LoopAcc {
        count: Option<ParamValue>,
        effects: Vec<EffectDef>,
    }

    let mut direct_effects = Vec::new();
    let mut random_groups: BTreeMap<String, RandomAcc> = BTreeMap::new();
    let mut loop_groups: BTreeMap<String, LoopAcc> = BTreeMap::new();

    for node in effects {
        let kind = node
            .parsed_type()
            .map(|p| p.kind)
            .unwrap_or_else(|| node.node_type.clone());
        let params = convert_values(&node.values);
        let effect = EffectDef {
            effect_type: kind,
            params,
        };

        if let Some((group_id, numerator, denominator)) = parse_random_group_meta(&node.values) {
            let entry = random_groups.entry(group_id).or_default();
            if entry.chance_numerator.is_none() {
                entry.chance_numerator = numerator;
            }
            if entry.chance_denominator.is_none() {
                entry.chance_denominator = denominator;
            }
            entry.effects.push(effect);
            continue;
        }

        if let Some((group_id, count)) = parse_loop_group_meta(&node.values) {
            let entry = loop_groups.entry(group_id).or_default();
            if entry.count.is_none() {
                entry.count = count;
            }
            entry.effects.push(effect);
            continue;
        }

        direct_effects.push(effect);
    }

    let random_defs = random_groups
        .into_iter()
        .map(|(id, acc)| RandomGroupDef {
            id,
            chance_numerator: acc.chance_numerator.unwrap_or(ParamValue::Int(1)),
            chance_denominator: acc.chance_denominator.unwrap_or(ParamValue::Int(2)),
            effects: acc.effects,
        })
        .collect();

    let loop_defs = loop_groups
        .into_iter()
        .map(|(id, acc)| LoopGroupDef {
            id,
            count: acc.count.unwrap_or(ParamValue::Int(1)),
            effects: acc.effects,
        })
        .collect();

    (direct_effects, random_defs, loop_defs)
}

fn parse_random_group_meta(
    values: &HashMap<String, Value>,
) -> Option<(
    String,
    Option<balatro_codegen::types::ParamValue>,
    Option<balatro_codegen::types::ParamValue>,
)> {
    let group_id = get_string_value(
        values,
        &[
            "random_group_id",
            "randomGroupId",
            "random_group",
            "randomGroup",
        ],
    )
    .or_else(|| {
        let kind = get_string_value(
            values,
            &["group_kind", "groupKind", "group_type", "groupType"],
        )?;
        if kind.eq_ignore_ascii_case("random") {
            get_string_value(values, &["group_id", "groupId"])
        } else {
            None
        }
    })?;

    let numerator = get_param_value(
        values,
        &["chance_numerator", "chanceNumerator", "numerator"],
    );
    let denominator = get_param_value(
        values,
        &["chance_denominator", "chanceDenominator", "denominator"],
    );

    Some((group_id, numerator, denominator))
}

fn parse_loop_group_meta(
    values: &HashMap<String, Value>,
) -> Option<(String, Option<balatro_codegen::types::ParamValue>)> {
    let group_id = get_string_value(
        values,
        &["loop_group_id", "loopGroupId", "loop_group", "loopGroup"],
    )
    .or_else(|| {
        let kind = get_string_value(
            values,
            &["group_kind", "groupKind", "group_type", "groupType"],
        )?;
        if kind.eq_ignore_ascii_case("loop") {
            get_string_value(values, &["group_id", "groupId"])
        } else {
            None
        }
    })?;

    let count = get_param_value(values, &["repetitions", "count", "loop_count", "loopCount"]);
    Some((group_id, count))
}

fn get_string_value(values: &HashMap<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| values.get(*key))
        .find_map(|v| v.as_str().map(|s| s.to_string()))
}

fn get_param_value(
    values: &HashMap<String, Value>,
    keys: &[&str],
) -> Option<balatro_codegen::types::ParamValue> {
    keys.iter()
        .filter_map(|key| values.get(*key))
        .next()
        .map(json_to_param_value)
}

fn parse_logic_op(value: &str) -> Option<balatro_codegen::types::LogicOp> {
    use balatro_codegen::types::LogicOp;

    match value.trim().to_ascii_lowercase().as_str() {
        "and" => Some(LogicOp::And),
        "or" => Some(LogicOp::Or),
        _ => None,
    }
}

fn compute_rule_flags(
    effects: &[balatro_codegen::types::EffectDef],
    random_groups: &[balatro_codegen::types::RandomGroupDef],
    loop_groups: &[balatro_codegen::types::LoopGroupDef],
) -> (bool, bool) {
    let mut retrigger = false;
    let mut destroy = false;

    let mut inspect_effect = |effect_type: &str| match effect_type {
        "retrigger" | "retrigger_playing_card" | "retrigger_cards" => retrigger = true,
        "destroy_playing_card" | "destroy_card" => destroy = true,
        _ => {}
    };

    for effect in effects {
        inspect_effect(&effect.effect_type);
    }
    for group in random_groups {
        for effect in &group.effects {
            inspect_effect(&effect.effect_type);
        }
    }
    for group in loop_groups {
        for effect in &group.effects {
            inspect_effect(&effect.effect_type);
        }
    }

    (retrigger, destroy)
}

fn map_user_variables(
    values: &[EntityUserVariable],
) -> Vec<balatro_codegen::types::UserVariableDef> {
    use balatro_codegen::types::{ParamValue, UserVarType, UserVariableDef};

    values
        .iter()
        .map(|v| {
            let var_type = match v.var_type.as_str() {
                "suit" => UserVarType::Suit,
                "rank" => UserVarType::Rank,
                "pokerhand" => UserVarType::PokerHand,
                "key" => UserVarType::Key,
                "text" => UserVarType::Text,
                _ => UserVarType::Number,
            };

            let initial_value = match var_type {
                UserVarType::Suit => ParamValue::Str(
                    v.initial_suit
                        .clone()
                        .unwrap_or_else(|| "Spades".to_string()),
                ),
                UserVarType::Rank => {
                    ParamValue::Str(v.initial_rank.clone().unwrap_or_else(|| "Ace".to_string()))
                }
                UserVarType::PokerHand => ParamValue::Str(
                    v.initial_poker_hand
                        .clone()
                        .unwrap_or_else(|| "High Card".to_string()),
                ),
                UserVarType::Key => {
                    ParamValue::Str(v.initial_key.clone().unwrap_or_else(|| "none".to_string()))
                }
                UserVarType::Text => ParamValue::Str(v.initial_text.clone().unwrap_or_default()),
                UserVarType::Number => ParamValue::Float(v.initial_value.unwrap_or(0.0)),
            };

            UserVariableDef {
                name: v.name.clone(),
                var_type,
                initial_value,
                is_global: v.is_global,
                is_persistent: v.is_persistent,
            }
        })
        .collect()
}

fn split_description(desc: &str) -> Vec<String> {
    let normalized = desc
        .replace("<br />", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n")
        .replace("[s]", "\n");

    let lines: Vec<String> = normalized
        .split('\n')
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    if lines.is_empty() {
        vec!["No description".to_string()]
    } else {
        lines
    }
}

fn json_to_param_value(value: &Value) -> balatro_codegen::types::ParamValue {
    use balatro_codegen::types::{ParamValue, TypedValue};

    match value {
        Value::Number(n) => n
            .as_i64()
            .map(ParamValue::Int)
            .unwrap_or_else(|| ParamValue::Float(n.as_f64().unwrap_or(0.0))),
        Value::Bool(b) => ParamValue::Bool(*b),
        Value::String(s) => ParamValue::Str(s.clone()),
        Value::Object(map) => {
            if let Some(raw_value) = map.get("value") {
                let value_type = map
                    .get("valueType")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| infer_value_type(raw_value));
                ParamValue::Typed(TypedValue {
                    value: raw_value.clone(),
                    value_type,
                })
            } else {
                ParamValue::Str(value.to_string())
            }
        }
        _ => ParamValue::Str(value.to_string()),
    }
}

fn infer_value_type(value: &Value) -> String {
    match value {
        Value::Null => "unknown".to_string(),
        Value::Bool(_) => "boolean".to_string(),
        Value::Number(_) => "number".to_string(),
        Value::String(_) => "string".to_string(),
        Value::Array(_) => "array".to_string(),
        Value::Object(_) => "object".to_string(),
    }
}

/// Convert node values to ParamValue format.
fn convert_values(
    values: &HashMap<String, Value>,
) -> std::collections::HashMap<String, balatro_codegen::types::ParamValue> {
    values
        .iter()
        .map(|(k, v)| (k.clone(), json_to_param_value(v)))
        .collect()
}

// `capitalize` removed, category labels now come from the NodeCategory match arm strings.

