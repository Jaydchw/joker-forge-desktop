use crate::mod_engine::commands;
use crate::mod_engine::export::{AtlasPosInput, UserVariableInput};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::fs;

#[derive(Debug, Clone)]
struct ParamSchema {
    param_type: String,
    select_values: Option<HashSet<String>>,
}

#[derive(Debug, Clone)]
struct NodeSchema {
    params: HashMap<String, ParamSchema>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliCodegenItemRequest {
    item_type: String,
    item_data: Value,
    #[serde(default)]
    pos: Option<AtlasPosInput>,
    #[serde(default)]
    soul_pos: Option<AtlasPosInput>,
    #[serde(default = "default_mod_prefix")]
    mod_prefix: String,
    #[serde(default = "default_include_loc_txt")]
    include_loc_txt: bool,
    #[serde(default)]
    global_user_variables: Option<Vec<UserVariableInput>>,
}

struct QuickBuildResult {
    request: CliCodegenItemRequest,
    dry_run: bool,
    print_request_json: bool,
    print_rules_json: bool,
}

fn default_mod_prefix() -> String {
    "mod".to_string()
}

fn default_include_loc_txt() -> bool {
    true
}

fn request_preview_json(request: &CliCodegenItemRequest) -> Value {
    let pos = request
        .pos
        .as_ref()
        .map(|p| json!({ "x": p.x, "y": p.y }))
        .unwrap_or(Value::Null);
    let soul_pos = request
        .soul_pos
        .as_ref()
        .map(|p| json!({ "x": p.x, "y": p.y }))
        .unwrap_or(Value::Null);
    let global_user_variables_count = request
        .global_user_variables
        .as_ref()
        .map(|v| v.len())
        .unwrap_or(0);

    json!({
        "itemType": request.item_type,
        "itemData": request.item_data,
        "pos": pos,
        "soulPos": soul_pos,
        "modPrefix": request.mod_prefix,
        "includeLocTxt": request.include_loc_txt,
        "globalUserVariablesCount": global_user_variables_count
    })
}

pub fn print_codegen_item_usage() {
    eprintln!(
        "{}",
        r#"Usage:
  joker-forge-desktop codegen-item quick <item-type> [name] [rarity] [cost] [options]
  joker-forge-desktop codegen-item <item-type> [name] [rarity] [cost] [options]
  joker-forge-desktop codegen-item json --json '<payload>' [--dry-run] [--print-request-json]
  joker-forge-desktop codegen-item json --json-file <path> [--dry-run] [--print-request-json]
  joker-forge-desktop codegen-item --help-json

Item Types:
  joker | consumable | voucher | deck | enhancement | seal | edition

Quick Command Options:
  --help | -h                     Show this help
  --help-json | -hj               Show machine-readable help JSON
  --object-key | -ok <key>        Object key (default: new_<type>)
  --description | -d <text>       Item description
  --atlas | -a <atlas>            Atlas key (default: CustomJokers for joker)
  --unlocked | -u <bool>          Set unlocked
  --discovered | -di <bool>       Set discovered
  --appears-in-shop | -ais <bool> Set appears_in_shop
  --blueprint-compat | -bc <bool> Set blueprint_compat
  --eternal-compat | -ec <bool>   Set eternal_compat
  --perishable-compat | -pc <bool> Set perishable_compat
  --localization | -locl <lang:name:description> Add localization
  --localization-json | -locj <json> Add localization object
  --user-var | -uv <name:type:initial[:global[:persistent]]> Add user variable
  --user-var-json | -uvj <json>   Add user variable object
  --rule | -r [trigger]           Add/select a new rule (repeatable)
  --rule-index | -ri <n>          Select existing rule index (0-based)
  --trigger | -t <id>             Set trigger for current rule
  --effect | -e <type>            Add one direct effect to current rule (repeatable)
  --effect-index | -ei <n>        Select direct effect index on current rule
  --effect-param | -ep <k=v[,k2=v2]> Add param(s) to the most recent effect
  --effect-param-json | -epj <json> Merge JSON params into selected effect
  --value | -v <val>              Set `value` on the most recent target (effect/condition)
  --condition-group | -cg [and|or] Add/select condition group on current rule
  --condition-group-index | -cgi <n> Select condition group index on current rule
  --condition | -c <type>         Add condition to current condition group
  --condition-index | -ci <n>     Select condition index in current condition group
  --condition-negate | -cn <bool> Set negate for most recent condition
  --condition-operator | -co <and|or> Set condition operator for most recent condition
  --condition-param | -cp <k=v[,k2=v2]> Add param(s) to the most recent condition
  --condition-param-json | -cpj <json> Merge JSON params into selected condition
  --condition-value | -cv <val>   Set `value` on the most recent condition
  --random | -rg <num/den>        Add random group to rule (repeatable)
  --random-index | -rgi <n>       Select random group index on current rule
  --random-key | -rgk <text>      Set custom_key on current random group
  --random-respect | -rgr <bool>  Set respect_probability_effects on current random group
  --random-effect | -re <type>    Add effect to most recent random group (repeatable)
  --random-effect-index | -rei <n> Select effect index in current random group
  --random-effect-param | -rep <k=v[,k2=v2]> Add param(s) to most recent random-group effect
  --random-effect-param-json | -repj <json> Merge JSON params into selected random effect
  --loop | -l <count>             Add loop group with repetitions (repeatable)
  --loop-index | -li <n>          Select loop group index on current rule
  --loop-effect | -le <type>      Add effect to most recent loop group (repeatable)
  --loop-effect-index | -lei <n>  Select effect index in current loop group
  --loop-effect-param | -lep <k=v[,k2=v2]> Add param(s) to most recent loop-group effect
  --loop-effect-param-json | -lepj <json> Merge JSON params into selected loop effect
  --rules-json | -j '<json>'      Full rules array JSON (overrides quick rule flags)
  --rules-file | -jf <path>       Full rules array JSON file (overrides quick rule flags)
  --mod-prefix | -m <prefix>      Mod prefix (default: mod)
  --include-loc-txt | -loc <bool> Include loc_txt (default: true)
  --print-rules-json | -pr        Print normalized rules JSON
  --print-request-json | -prj     Print normalized request JSON
  --dry-run | -n                  Build/validate only, do not compile Lua

Examples:
  joker-forge-desktop codegen-item quick joker
  joker-forge-desktop codegen-item quick joker \"Lucky Chips\" 1 4 -e add_chips -v 20
  joker-forge-desktop codegen-item quick joker \"Two Rules\" 1 4 -r hand_played -e add_chips -ep value=10 -r discarded_hand -e add_mult -ep value=2
  joker-forge-desktop codegen-item quick joker \"Indexed\" 1 4 -e add_chips -ep value=5 -e add_mult -ep value=2 -ei 0 -v 9
  joker-forge-desktop codegen-item quick joker \"Random Proc\" 1 4 -rg 1/4 -re add_mult -rep value=8
  joker-forge-desktop codegen-item quick joker \"Nested\" 1 4 -l 3 -le add_chips -lep value=5
  joker-forge-desktop codegen-item quick joker \"Option Param\" 1 4 -e show_message -ep message_type=text -ep colour=G.C.GREEN
  joker-forge-desktop codegen-item quick joker \"JSON Param\" 1 4 -e show_message -epj '{\"message_type\":{\"value\":\"text\",\"valueType\":\"string\"},\"colour\":{\"value\":\"G.C.BLUE\",\"valueType\":\"string\"}}'
  joker-forge-desktop codegen-item json --json-file ./item.json -prj -n"#
    );
}

fn print_codegen_item_help_json() {
    let payload = r#"{
  "command": "codegen-item",
  "modes": ["quick", "json"],
  "itemTypes": ["joker", "consumable", "voucher", "deck", "enhancement", "seal", "edition"],
  "defaults": {
    "modPrefix": "mod",
    "includeLocTxt": true,
    "joker": {
      "name": "New Joker",
      "rarity": 1,
      "cost": 4,
      "description": "Generated joker",
      "atlas": "CustomJokers",
      "objectKeyPattern": "new_<item-type>"
    }
  },
  "valuePatterns": {
    "bool": "true|false|1|0|yes|no|on|off",
    "index": "0..n",
    "fraction": "num/den",
    "typedParam": "key=value or key@type=value",
    "typedList": "key=value[,key2=value2...]",
    "localization": "lang:name:description",
    "userVar": "name:type:initial[:global[:persistent]]"
  },
  "quick": {
    "positional": ["itemType", "name?", "rarity?(joker)", "cost?"],
    "flags": [
      {"name":"--help","aliases":["-h"]},
      {"name":"--help-json","aliases":["-hj"]},
      {"name":"--object-key","aliases":["-ok"],"value":"string"},
      {"name":"--description","aliases":["-d"],"value":"string"},
      {"name":"--atlas","aliases":["-a"],"value":"string"},
      {"name":"--unlocked","aliases":["-u"],"value":"bool"},
      {"name":"--discovered","aliases":["-di"],"value":"bool"},
      {"name":"--appears-in-shop","aliases":["-ais"],"value":"bool"},
      {"name":"--blueprint-compat","aliases":["-bc"],"value":"bool"},
      {"name":"--eternal-compat","aliases":["-ec"],"value":"bool"},
      {"name":"--perishable-compat","aliases":["-pc"],"value":"bool"},
      {"name":"--localization","aliases":["-locl"],"value":"lang:name:description"},
      {"name":"--localization-json","aliases":["-locj"],"value":"json-object"},
      {"name":"--user-var","aliases":["-uv"],"value":"name:type:initial[:global[:persistent]]"},
      {"name":"--user-var-json","aliases":["-uvj"],"value":"json-object"},
      {"name":"--rule","aliases":["-r"],"value":"trigger?"},
      {"name":"--rule-index","aliases":["-ri"],"value":"number"},
      {"name":"--trigger","aliases":["-t"],"value":"string"},
      {"name":"--effect","aliases":["-e"],"value":"type"},
      {"name":"--effect-index","aliases":["-ei"],"value":"number"},
      {"name":"--effect-param","aliases":["-ep"],"value":"k=v[,k2=v2]"},
      {"name":"--effect-param-json","aliases":["-epj"],"value":"json-object"},
      {"name":"--value","aliases":["-v"],"value":"scalar"},
      {"name":"--condition-group","aliases":["-cg"],"value":"and|or"},
      {"name":"--condition-group-index","aliases":["-cgi"],"value":"number"},
      {"name":"--condition","aliases":["-c"],"value":"type"},
      {"name":"--condition-index","aliases":["-ci"],"value":"number"},
      {"name":"--condition-negate","aliases":["-cn"],"value":"bool"},
      {"name":"--condition-operator","aliases":["-co"],"value":"and|or"},
      {"name":"--condition-param","aliases":["-cp"],"value":"k=v[,k2=v2]"},
      {"name":"--condition-param-json","aliases":["-cpj"],"value":"json-object"},
      {"name":"--condition-value","aliases":["-cv"],"value":"scalar"},
      {"name":"--random","aliases":["-rg"],"value":"num/den"},
      {"name":"--random-index","aliases":["-rgi"],"value":"number"},
      {"name":"--random-key","aliases":["-rgk"],"value":"string"},
      {"name":"--random-respect","aliases":["-rgr"],"value":"bool"},
      {"name":"--random-effect","aliases":["-re"],"value":"type"},
      {"name":"--random-effect-index","aliases":["-rei"],"value":"number"},
      {"name":"--random-effect-param","aliases":["-rep"],"value":"k=v[,k2=v2]"},
      {"name":"--random-effect-param-json","aliases":["-repj"],"value":"json-object"},
      {"name":"--loop","aliases":["-l"],"value":"count"},
      {"name":"--loop-index","aliases":["-li"],"value":"number"},
      {"name":"--loop-effect","aliases":["-le"],"value":"type"},
      {"name":"--loop-effect-index","aliases":["-lei"],"value":"number"},
      {"name":"--loop-effect-param","aliases":["-lep"],"value":"k=v[,k2=v2]"},
      {"name":"--loop-effect-param-json","aliases":["-lepj"],"value":"json-object"},
      {"name":"--rules-json","aliases":["-j"],"value":"json-array"},
      {"name":"--rules-file","aliases":["-jf"],"value":"path"},
      {"name":"--mod-prefix","aliases":["-m"],"value":"string"},
      {"name":"--include-loc-txt","aliases":["-loc"],"value":"bool"},
      {"name":"--print-request-json","aliases":["-prj"]},
      {"name":"--print-rules-json","aliases":["-pr"]},
      {"name":"--dry-run","aliases":["-n"]}
    ]
  },
  "json": {
    "flags": [
      {"name":"--json","aliases":["-j"],"value":"json-object"},
      {"name":"--json-file","aliases":["-jf"],"value":"path"},
      {"name":"--print-request-json","aliases":["-prj"]},
      {"name":"--dry-run","aliases":["-n"]}
    ]
  }
}"#;
    println!("{}", payload);
}

fn parse_bool(value: &str, default: bool) -> bool {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "y" | "on" => true,
        "0" | "false" | "no" | "n" | "off" => false,
        _ => default,
    }
}

fn parse_json_map(raw: &str, context: &str) -> Result<serde_json::Map<String, Value>, String> {
    let parsed: Value =
        serde_json::from_str(raw).map_err(|e| format!("Invalid JSON for {}: {}", context, e))?;
    parsed
        .as_object()
        .cloned()
        .ok_or_else(|| format!("{} must be a JSON object", context))
}

fn load_catalog_schema(json_str: &str) -> HashMap<String, NodeSchema> {
    let mut out: HashMap<String, NodeSchema> = HashMap::new();
    let parsed: Value = serde_json::from_str(json_str).unwrap_or_else(|_| Value::Array(vec![]));
    let Some(nodes) = parsed.as_array() else {
        return out;
    };

    for node in nodes {
        let Some(id) = node.get("id").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        let mut params_map: HashMap<String, ParamSchema> = HashMap::new();
        if let Some(params) = node.get("params").and_then(Value::as_array) {
            for p in params {
                let Some(pid) = p.get("id").and_then(Value::as_str).map(str::to_string) else {
                    continue;
                };
                let ptype = p
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("text")
                    .to_string();
                let select_values = if ptype == "select" {
                    p.get("options")
                        .and_then(Value::as_array)
                        .map(|opts| {
                            opts.iter()
                                .filter_map(|o| o.get("value").and_then(Value::as_str))
                                .map(str::to_string)
                                .collect::<HashSet<_>>()
                        })
                } else {
                    None
                };
                params_map.insert(
                    pid.clone(),
                    ParamSchema {
                        param_type: ptype,
                        select_values,
                    },
                );
            }
        }
        out.insert(id, NodeSchema { params: params_map });
    }
    out
}

fn value_type_of_param_value(v: &Value) -> Option<String> {
    if let Some(obj) = v.as_object() {
        if let Some(vt) = obj.get("valueType").and_then(Value::as_str) {
            return Some(vt.to_string());
        }
        if let Some(inner) = obj.get("value") {
            return match inner {
                Value::Number(_) => Some("number".to_string()),
                Value::Bool(_) => Some("boolean".to_string()),
                Value::String(_) => Some("text".to_string()),
                _ => None,
            };
        }
    }
    match v {
        Value::Number(_) => Some("number".to_string()),
        Value::Bool(_) => Some("boolean".to_string()),
        Value::String(_) => Some("text".to_string()),
        _ => None,
    }
}

fn inner_param_scalar(v: &Value) -> Option<&Value> {
    if let Some(obj) = v.as_object() {
        if let Some(inner) = obj.get("value") {
            return Some(inner);
        }
    }
    Some(v)
}

fn validate_rulebuilder_item_data(item_type: &str, item_data: &Value) -> Result<(), String> {
    let effects_schema = load_catalog_schema(include_str!("mod_engine/catalog/effects.json"));
    let conditions_schema = load_catalog_schema(include_str!("mod_engine/catalog/conditions.json"));

    let rules = item_data
        .get("rules")
        .and_then(Value::as_array)
        .ok_or_else(|| "itemData.rules must be an array".to_string())?;

    for (ri, rule) in rules.iter().enumerate() {
        let trigger = rule
            .get("trigger")
            .and_then(Value::as_str)
            .unwrap_or("<missing-trigger>");

        let validate_effect = |effect: &Value, coordinate: &str| -> Result<(), String> {
            let effect_type = effect
                .get("type")
                .and_then(Value::as_str)
                .ok_or_else(|| format!("{} missing effect type", coordinate))?;
            let schema = effects_schema.get(effect_type).ok_or_else(|| {
                format!(
                    "{} unknown effect type '{}' for item '{}'",
                    coordinate, effect_type, item_type
                )
            })?;
            let params = effect.get("params").and_then(Value::as_object).ok_or_else(|| {
                format!("{} effect '{}' params must be an object", coordinate, effect_type)
            })?;
            for (pk, pv) in params {
                let p_schema = schema.params.get(pk).ok_or_else(|| {
                    format!(
                        "{} effect '{}' unknown param '{}'",
                        coordinate, effect_type, pk
                    )
                })?;
                let vt = value_type_of_param_value(pv).unwrap_or_else(|| "unknown".to_string());
                if p_schema.param_type == "number"
                    && vt != "number"
                    && vt != "user_var"
                    && vt != "range_var"
                {
                    return Err(format!(
                        "{} effect '{}' param '{}' expects number-like value, got '{}'",
                        coordinate, effect_type, pk, vt
                    ));
                }
                if p_schema.param_type == "select" {
                    if let (Some(values), Some(inner)) =
                        (&p_schema.select_values, inner_param_scalar(pv))
                    {
                        if let Some(s) = inner.as_str() {
                            if !values.is_empty() && !values.contains(s) {
                                return Err(format!(
                                    "{} effect '{}' param '{}' invalid option '{}'",
                                    coordinate, effect_type, pk, s
                                ));
                            }
                        }
                    }
                }
            }
            Ok(())
        };

        let validate_condition = |condition: &Value, coordinate: &str| -> Result<(), String> {
            let condition_type = condition
                .get("type")
                .and_then(Value::as_str)
                .ok_or_else(|| format!("{} missing condition type", coordinate))?;
            let schema = conditions_schema.get(condition_type).ok_or_else(|| {
                format!(
                    "{} unknown condition type '{}' for trigger '{}'",
                    coordinate, condition_type, trigger
                )
            })?;
            let params = condition
                .get("params")
                .and_then(Value::as_object)
                .ok_or_else(|| {
                    format!(
                        "{} condition '{}' params must be an object",
                        coordinate, condition_type
                    )
                })?;
            for (pk, pv) in params {
                let p_schema = schema.params.get(pk).ok_or_else(|| {
                    format!(
                        "{} condition '{}' unknown param '{}'",
                        coordinate, condition_type, pk
                    )
                })?;
                let vt = value_type_of_param_value(pv).unwrap_or_else(|| "unknown".to_string());
                if p_schema.param_type == "number"
                    && vt != "number"
                    && vt != "user_var"
                    && vt != "range_var"
                {
                    return Err(format!(
                        "{} condition '{}' param '{}' expects number-like value, got '{}'",
                        coordinate, condition_type, pk, vt
                    ));
                }
                if p_schema.param_type == "select" {
                    if let (Some(values), Some(inner)) =
                        (&p_schema.select_values, inner_param_scalar(pv))
                    {
                        if let Some(s) = inner.as_str() {
                            if !values.is_empty() && !values.contains(s) {
                                return Err(format!(
                                    "{} condition '{}' param '{}' invalid option '{}'",
                                    coordinate, condition_type, pk, s
                                ));
                            }
                        }
                    }
                }
            }
            Ok(())
        };

        if let Some(effects) = rule.get("effects").and_then(Value::as_array) {
            for (ei, effect) in effects.iter().enumerate() {
                validate_effect(effect, &format!("rule[{}].effects[{}]", ri, ei))?;
            }
        }
        if let Some(groups) = rule.get("conditionGroups").and_then(Value::as_array) {
            for (gi, group) in groups.iter().enumerate() {
                if let Some(conds) = group.get("conditions").and_then(Value::as_array) {
                    for (ci, cond) in conds.iter().enumerate() {
                        validate_condition(
                            cond,
                            &format!("rule[{}].conditionGroups[{}].conditions[{}]", ri, gi, ci),
                        )?;
                    }
                }
            }
        }
        if let Some(random_groups) = rule.get("randomGroups").and_then(Value::as_array) {
            for (rgi, group) in random_groups.iter().enumerate() {
                if let Some(effects) = group.get("effects").and_then(Value::as_array) {
                    for (ei, effect) in effects.iter().enumerate() {
                        validate_effect(
                            effect,
                            &format!("rule[{}].randomGroups[{}].effects[{}]", ri, rgi, ei),
                        )?;
                    }
                }
            }
        }
        if let Some(loop_groups) = rule.get("loops").and_then(Value::as_array) {
            for (lgi, group) in loop_groups.iter().enumerate() {
                if let Some(effects) = group.get("effects").and_then(Value::as_array) {
                    for (ei, effect) in effects.iter().enumerate() {
                        validate_effect(
                            effect,
                            &format!("rule[{}].loops[{}].effects[{}]", ri, lgi, ei),
                        )?;
                    }
                }
            }
        }
    }

    Ok(())
}

fn parse_scalar_value(raw: &str) -> Value {
    let trimmed = raw.trim();
    if trimmed.eq_ignore_ascii_case("true") {
        return Value::Bool(true);
    }
    if trimmed.eq_ignore_ascii_case("false") {
        return Value::Bool(false);
    }
    if let Ok(i) = trimmed.parse::<i64>() {
        return Value::Number(i.into());
    }
    if let Ok(f) = trimmed.parse::<f64>() {
        if let Some(n) = serde_json::Number::from_f64(f) {
            return Value::Number(n);
        }
    }
    Value::String(trimmed.to_string())
}

fn wrapped_param_value(raw: &str) -> Value {
    let scalar = parse_scalar_value(raw);
    let value_type = match &scalar {
        Value::Number(_) => Some("number"),
        Value::Bool(_) => Some("boolean"),
        _ => Some("text"),
    };
    json!({
        "value": scalar,
        "valueType": value_type
    })
}

fn wrapped_param_value_with_type(raw: &str, explicit_value_type: Option<&str>) -> Value {
    let scalar = parse_scalar_value(raw);
    let inferred = match &scalar {
        Value::Number(_) => "number",
        Value::Bool(_) => "boolean",
        _ => "text",
    };
    let value_type = explicit_value_type.unwrap_or(inferred);
    json!({
        "value": scalar,
        "valueType": value_type
    })
}

fn parse_key_value_flag(value: &str) -> Result<(String, Option<String>, String), String> {
    let (k, v) = value
        .split_once('=')
        .ok_or_else(|| format!("Expected key=value format, got '{}'", value))?;
    let key_raw = k.trim();
    let val = v.trim();
    if key_raw.is_empty() {
        return Err(format!("Empty key in '{}'", value));
    }

    let (key, value_type) = if let Some((base_key, vt)) = key_raw.split_once('@') {
        let parsed_key = base_key.trim();
        let parsed_type = vt.trim();
        if parsed_key.is_empty() {
            return Err(format!("Empty key in '{}'", value));
        }
        if parsed_type.is_empty() {
            return Err(format!("Empty valueType in '{}'", value));
        }
        (parsed_key.to_string(), Some(parsed_type.to_string()))
    } else {
        (key_raw.to_string(), None)
    };

    Ok((key, value_type, val.to_string()))
}

fn parse_param_assignments(raw: &str) -> Result<Vec<(String, Option<String>, String)>, String> {
    raw.split(',')
        .map(|part| parse_key_value_flag(part.trim()))
        .collect()
}

fn insert_param_assignments(
    params: &mut serde_json::Map<String, Value>,
    raw: &str,
) -> Result<(), String> {
    for (key, value_type, value) in parse_param_assignments(raw)? {
        params.insert(
            key,
            wrapped_param_value_with_type(&value, value_type.as_deref()),
        );
    }
    Ok(())
}

fn default_trigger_for_item(item_type: &str) -> &'static str {
    match item_type {
        "consumable" | "voucher" | "deck" => "card_used",
        _ => "hand_played",
    }
}

fn default_item_data(
    item_type: &str,
    object_key: &str,
    name: &str,
    description: &str,
    rarity: Option<Value>,
    cost: Option<i32>,
    rules: Value,
) -> Value {
    let common = json!({
        "objectType": item_type,
        "objectKey": object_key,
        "name": name,
        "description": description,
        "localizations": [{
            "language": "en-us",
            "name": name,
            "description": description
        }],
        "rules": rules,
        "userVariables": [],
        "info_queues": []
    });

    let merge_common = |extra: Value| -> Value {
        let mut out = common.as_object().cloned().unwrap_or_default();
        if let Some(extra_obj) = extra.as_object() {
            for (k, v) in extra_obj {
                out.insert(k.clone(), v.clone());
            }
        }
        Value::Object(out)
    };

    match item_type {
        "joker" => {
            let r = rarity.unwrap_or_else(|| json!(1));
            let c = cost.unwrap_or(4);
            merge_common(json!({
                "rarity": r,
                "cost": c,
                "blueprint_compat": true,
                "eternal_compat": true,
                "perishable_compat": true,
                "unlocked": true,
                "discovered": true,
                "appears_in_shop": true,
                "pools": [],
                "atlas": "CustomJokers"
            }))
        }
        "consumable" => merge_common(json!({
            "set": "Tarot",
            "cost": cost.unwrap_or(3),
            "unlocked": true,
            "discovered": true,
            "hidden": false,
            "can_repeat_soul": false,
            "atlas": "CustomConsumables"
        })),
        "voucher" => merge_common(json!({
            "cost": cost.unwrap_or(10),
            "unlocked": true,
            "discovered": true,
            "no_collection": false,
            "can_repeat_soul": false,
            "atlas": "Vouchers"
        })),
        "deck" => merge_common(json!({
            "unlocked": true,
            "discovered": true,
            "no_collection": false,
            "Config_vouchers": [],
            "Config_consumables": [],
            "no_interest": false,
            "no_faces": false,
            "erratic_deck": false,
            "atlas": "centers"
        })),
        "enhancement" => merge_common(json!({
            "unlocked": true,
            "discovered": true,
            "no_collection": false,
            "weight": 5,
            "any_suit": false,
            "replace_base_card": false,
            "no_rank": false,
            "no_suit": false,
            "always_scores": false,
            "atlas": "centers"
        })),
        "seal" => merge_common(json!({
            "unlocked": true,
            "discovered": true,
            "no_collection": false,
            "badge_colour": "#FFFFFF",
            "sound": "gold_seal",
            "pitch": 1.0,
            "volume": 0.8,
            "atlas": "centers"
        })),
        _ => merge_common(json!({
            "unlocked": true,
            "discovered": true,
            "no_collection": false,
            "weight": 5,
            "shader": false,
            "extra_cost": 0,
            "badge_colour": "#FFFFFF",
            "sound": "foil1",
            "pitch": 1.0,
            "volume": 1.0,
            "disable_shadow": false,
            "disable_base_shader": false,
            "atlas": "centers"
        })),
    }
}

fn build_quick_codegen_request(args: &[String]) -> Result<QuickBuildResult, String> {
    if args.is_empty() {
        return Err("Missing item type".to_string());
    }

    let item_type = args[0].trim().to_ascii_lowercase();
    let supported = [
        "joker",
        "consumable",
        "voucher",
        "deck",
        "enhancement",
        "seal",
        "edition",
    ];
    if !supported.contains(&item_type.as_str()) {
        return Err(format!(
            "Unsupported item type '{}'. Supported: {}",
            item_type,
            supported.join(", ")
        ));
    }

    let mut cursor = 1usize;
    let mut name: Option<String> = None;
    let mut rarity: Option<Value> = None;
    let mut cost: Option<i32> = None;

    if cursor < args.len() && !args[cursor].starts_with("--") {
        name = Some(args[cursor].clone());
        cursor += 1;
    }
    if item_type == "joker" && cursor < args.len() && !args[cursor].starts_with("--") {
        rarity = Some(parse_scalar_value(&args[cursor]));
        cursor += 1;
    }
    if cursor < args.len() && !args[cursor].starts_with("--") {
        cost = args[cursor].parse::<i32>().ok();
        cursor += 1;
    }

    let mut object_key: Option<String> = None;
    let mut description: Option<String> = None;
    let mut atlas: Option<String> = None;
    let mut unlocked: Option<bool> = None;
    let mut discovered: Option<bool> = None;
    let mut appears_in_shop: Option<bool> = None;
    let mut blueprint_compat: Option<bool> = None;
    let mut eternal_compat: Option<bool> = None;
    let mut perishable_compat: Option<bool> = None;
    let mut localizations: Vec<Value> = Vec::new();
    let mut user_variables: Vec<Value> = Vec::new();
    let mut mod_prefix = "mod".to_string();
    let mut include_loc_txt = true;
    let mut print_request_json = false;
    let mut print_rules_json = false;
    let mut dry_run = false;

    let mut rules_json: Option<Value> = None;

    let mut rules: Vec<Value> = Vec::new();
    let mut current_rule_index: Option<usize> = None;
    let mut current_condition_group_index: Option<usize> = None;
    let mut current_condition_index: Option<usize> = None;
    let mut current_effect_index: Option<usize> = None;
    let mut current_random_group_index: Option<usize> = None;
    let mut current_random_effect_index: Option<usize> = None;
    let mut current_loop_group_index: Option<usize> = None;
    let mut current_loop_effect_index: Option<usize> = None;

    let make_rule = |index: usize, trigger: Option<String>| -> Value {
        json!({
            "id": format!("rule_{}", index),
            "trigger": trigger.unwrap_or_else(|| default_trigger_for_item(&item_type).to_string()),
            "conditionGroups": [],
            "effects": [],
            "randomGroups": [],
            "loops": []
        })
    };

    let ensure_rule = |rules: &mut Vec<Value>, current_rule_index: &mut Option<usize>| -> usize {
        if let Some(idx) = *current_rule_index {
            idx
        } else {
            let idx = rules.len();
            rules.push(make_rule(idx, None));
            *current_rule_index = Some(idx);
            idx
        }
    };

    let mut i = cursor;
    while i < args.len() {
        let flag = args[i].as_str();
        let next = |idx: usize, all: &[String]| -> Result<String, String> {
            all.get(idx + 1)
                .cloned()
                .ok_or_else(|| format!("Missing value for {}", all[idx]))
        };

        match flag {
            "--object-key" | "-ok" => {
                object_key = Some(next(i, args)?);
                i += 2;
            }
            "--description" | "-d" => {
                description = Some(next(i, args)?);
                i += 2;
            }
            "--atlas" | "-a" => {
                atlas = Some(next(i, args)?);
                i += 2;
            }
            "--unlocked" | "-u" => {
                unlocked = Some(parse_bool(&next(i, args)?, true));
                i += 2;
            }
            "--discovered" | "-di" => {
                discovered = Some(parse_bool(&next(i, args)?, true));
                i += 2;
            }
            "--appears-in-shop" | "-ais" => {
                appears_in_shop = Some(parse_bool(&next(i, args)?, true));
                i += 2;
            }
            "--blueprint-compat" | "-bc" => {
                blueprint_compat = Some(parse_bool(&next(i, args)?, true));
                i += 2;
            }
            "--eternal-compat" | "-ec" => {
                eternal_compat = Some(parse_bool(&next(i, args)?, true));
                i += 2;
            }
            "--perishable-compat" | "-pc" => {
                perishable_compat = Some(parse_bool(&next(i, args)?, true));
                i += 2;
            }
            "--localization" | "-locl" => {
                let raw = next(i, args)?;
                let parts: Vec<&str> = raw.splitn(3, ':').collect();
                if parts.len() != 3 {
                    return Err("--localization expects lang:name:description".to_string());
                }
                localizations.push(json!({
                    "language": parts[0],
                    "name": parts[1],
                    "description": parts[2]
                }));
                i += 2;
            }
            "--localization-json" | "-locj" => {
                let raw = next(i, args)?;
                let obj = parse_json_map(&raw, "--localization-json")?;
                localizations.push(Value::Object(obj));
                i += 2;
            }
            "--user-var" | "-uv" => {
                let raw = next(i, args)?;
                let parts: Vec<&str> = raw.split(':').collect();
                if parts.len() < 3 {
                    return Err("--user-var expects name:type:initial[:global[:persistent]]".to_string());
                }
                let is_global = parts.get(3).map(|v| parse_bool(v, false)).unwrap_or(false);
                let is_persistent = parts.get(4).map(|v| parse_bool(v, false)).unwrap_or(false);
                let mut uv = json!({
                    "name": parts[0],
                    "type": parts[1],
                    "isGlobal": is_global,
                    "isPersistent": is_persistent
                });
                let init = parse_scalar_value(parts[2]);
                match parts[1] {
                    "number" => uv["initialValue"] = init,
                    "suit" => uv["initialSuit"] = init,
                    "rank" => uv["initialRank"] = init,
                    "pokerhand" => uv["initialPokerHand"] = init,
                    "key" => uv["initialKey"] = init,
                    _ => uv["initialText"] = init,
                }
                user_variables.push(uv);
                i += 2;
            }
            "--user-var-json" | "-uvj" => {
                let raw = next(i, args)?;
                let obj = parse_json_map(&raw, "--user-var-json")?;
                user_variables.push(Value::Object(obj));
                i += 2;
            }
            "--rule" | "-r" => {
                let maybe_trigger = args.get(i + 1).cloned().filter(|v| !v.starts_with("--"));
                let idx = rules.len();
                rules.push(make_rule(idx, maybe_trigger.clone()));
                current_rule_index = Some(idx);
                current_condition_group_index = None;
                current_condition_index = None;
                current_effect_index = None;
                current_random_group_index = None;
                current_random_effect_index = None;
                current_loop_group_index = None;
                current_loop_effect_index = None;
                i += if maybe_trigger.is_some() { 2 } else { 1 };
            }
            "--rule-index" | "-ri" => {
                let idx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--rule-index expects a non-negative integer".to_string())?;
                if idx >= rules.len() {
                    return Err(format!(
                        "--rule-index {} out of range (have {})",
                        idx,
                        rules.len()
                    ));
                }
                current_rule_index = Some(idx);
                current_condition_group_index = None;
                current_condition_index = None;
                current_effect_index = None;
                current_random_group_index = None;
                current_random_effect_index = None;
                current_loop_group_index = None;
                current_loop_effect_index = None;
                i += 2;
            }
            "--trigger" | "-t" => {
                let idx = ensure_rule(&mut rules, &mut current_rule_index);
                let value = next(i, args)?;
                rules[idx]["trigger"] = Value::String(value);
                i += 2;
            }
            "--mod-prefix" | "-m" => {
                mod_prefix = next(i, args)?;
                i += 2;
            }
            "--include-loc-txt" | "-loc" => {
                include_loc_txt = parse_bool(&next(i, args)?, true);
                i += 2;
            }
            "--rules-json" | "-j" => {
                let raw = next(i, args)?;
                let parsed: Value = serde_json::from_str(&raw)
                    .map_err(|e| format!("Invalid --rules-json value: {}", e))?;
                rules_json = Some(parsed);
                i += 2;
            }
            "--rules-file" | "-jf" => {
                let path = next(i, args)?;
                let raw = fs::read_to_string(&path)
                    .map_err(|e| format!("Failed to read rules file '{}': {}", path, e))?;
                let parsed: Value = serde_json::from_str(&raw)
                    .map_err(|e| format!("Invalid JSON in rules file '{}': {}", path, e))?;
                rules_json = Some(parsed);
                i += 2;
            }
            "--condition-group" | "-cg" => {
                let idx = ensure_rule(&mut rules, &mut current_rule_index);
                let operator = args
                    .get(i + 1)
                    .cloned()
                    .filter(|v| !v.starts_with("--"))
                    .unwrap_or_else(|| "and".to_string());
                let op = match operator.to_ascii_lowercase().as_str() {
                    "and" | "or" => operator.to_ascii_lowercase(),
                    _ => return Err("--condition-group expects 'and' or 'or'".to_string()),
                };
                let groups = rules[idx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                groups.push(json!({
                    "operator": op,
                    "conditions": []
                }));
                current_condition_group_index = Some(groups.len() - 1);
                current_condition_index = None;
                i += if args.get(i + 1).is_some() && !args[i + 1].starts_with("--") {
                    2
                } else {
                    1
                };
            }
            "--condition-group-index" | "-cgi" => {
                let idx = ensure_rule(&mut rules, &mut current_rule_index);
                let gidx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--condition-group-index expects a non-negative integer".to_string())?;
                let groups = rules[idx]
                    .get("conditionGroups")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                if gidx >= groups.len() {
                    return Err(format!(
                        "--condition-group-index {} out of range (have {})",
                        gidx,
                        groups.len()
                    ));
                }
                current_condition_group_index = Some(gidx);
                current_condition_index = None;
                i += 2;
            }
            "--effect" | "-e" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let effect_type = next(i, args)?;
                let effects = rules[ridx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: effects is not an array".to_string())?;
                effects.push(json!({
                    "id": format!("effect_{}", effects.len()),
                    "type": effect_type,
                    "params": {}
                }));
                current_effect_index = Some(effects.len() - 1);
                i += 2;
            }
            "--effect-index" | "-ei" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let eidx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--effect-index expects a non-negative integer".to_string())?;
                let effects = rules[ridx]
                    .get("effects")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: effects is not an array".to_string())?;
                if eidx >= effects.len() {
                    return Err(format!("--effect-index {} out of range (have {})", eidx, effects.len()));
                }
                current_effect_index = Some(eidx);
                i += 2;
            }
            "--effect-param" | "-ep" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let raw = next(i, args)?;
                let idx = current_effect_index
                    .ok_or_else(|| "--effect-param requires a preceding --effect".to_string())?;
                let effects = rules[ridx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: effects is not an array".to_string())?;
                let params = effects[idx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: effect params is not an object".to_string())?;
                insert_param_assignments(params, &raw)?;
                i += 2;
            }
            "--effect-param-json" | "-epj" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let idx = current_effect_index
                    .ok_or_else(|| "--effect-param-json requires a preceding --effect".to_string())?;
                let raw = next(i, args)?;
                let map = parse_json_map(&raw, "--effect-param-json")?;
                let effects = rules[ridx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: effects is not an array".to_string())?;
                let params = effects[idx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: effect params is not an object".to_string())?;
                for (k, v) in map {
                    params.insert(k, if v.is_object() { v } else { wrapped_param_value(&v.to_string().trim_matches('"')) });
                }
                i += 2;
            }
            "--value" | "-v" => {
                let raw_value = next(i, args)?;
                let wrapped = wrapped_param_value(&raw_value);

                if let (Some(ridx), Some(re_idx), Some(rg_idx)) = (
                    current_rule_index,
                    current_random_effect_index,
                    current_random_group_index,
                ) {
                    let random_groups = rules[ridx]
                        .get_mut("randomGroups")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                    let effects = random_groups[rg_idx]
                        .get_mut("effects")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: random group effects is not an array".to_string())?;
                    let params = effects[re_idx]
                        .get_mut("params")
                        .and_then(Value::as_object_mut)
                        .ok_or_else(|| "Internal error: random effect params is not an object".to_string())?;
                    params.insert("value".to_string(), wrapped);
                    i += 2;
                    continue;
                }

                if let (Some(ridx), Some(le_idx), Some(lg_idx)) = (
                    current_rule_index,
                    current_loop_effect_index,
                    current_loop_group_index,
                ) {
                    let loops = rules[ridx]
                        .get_mut("loops")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                    let effects = loops[lg_idx]
                        .get_mut("effects")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: loop effects is not an array".to_string())?;
                    let params = effects[le_idx]
                        .get_mut("params")
                        .and_then(Value::as_object_mut)
                        .ok_or_else(|| "Internal error: loop effect params is not an object".to_string())?;
                    params.insert("value".to_string(), wrapped);
                    i += 2;
                    continue;
                }

                if let (Some(ridx), Some(eidx)) = (current_rule_index, current_effect_index) {
                    let effects = rules[ridx]
                        .get_mut("effects")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: effects is not an array".to_string())?;
                    let params = effects[eidx]
                        .get_mut("params")
                        .and_then(Value::as_object_mut)
                        .ok_or_else(|| "Internal error: effect params is not an object".to_string())?;
                    params.insert("value".to_string(), wrapped);
                    i += 2;
                    continue;
                }

                if let (Some(ridx), Some(cidx), Some(gidx)) = (
                    current_rule_index,
                    current_condition_index,
                    current_condition_group_index,
                ) {
                    let groups = rules[ridx]
                        .get_mut("conditionGroups")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                    let conditions = groups[gidx]
                        .get_mut("conditions")
                        .and_then(Value::as_array_mut)
                        .ok_or_else(|| "Internal error: conditions is not an array".to_string())?;
                    let params = conditions[cidx]
                        .get_mut("params")
                        .and_then(Value::as_object_mut)
                        .ok_or_else(|| "Internal error: condition params is not an object".to_string())?;
                    params.insert("value".to_string(), wrapped);
                    i += 2;
                    continue;
                }

                return Err("--value requires a preceding effect/condition target".to_string());
            }
            "--condition" | "-c" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let condition_type = next(i, args)?;
                let condition_groups = rules[ridx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                if condition_groups.is_empty() || current_condition_group_index.is_none() {
                    condition_groups.push(json!({
                        "operator": "and",
                        "conditions": []
                    }));
                    current_condition_group_index = Some(condition_groups.len() - 1);
                }
                let gidx = current_condition_group_index.unwrap_or(0);
                let group = condition_groups
                    .get_mut(gidx)
                    .ok_or_else(|| "Internal error: missing selected condition group".to_string())?;
                let conditions = group
                    .get_mut("conditions")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditions is not an array".to_string())?;
                conditions.push(json!({
                    "id": format!("condition_{}", conditions.len()),
                    "type": condition_type,
                    "negate": false,
                    "params": {}
                }));
                current_condition_index = Some(conditions.len() - 1);
                i += 2;
            }
            "--condition-index" | "-ci" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let gidx = current_condition_group_index
                    .ok_or_else(|| "--condition-index requires a selected condition group".to_string())?;
                let cidx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--condition-index expects a non-negative integer".to_string())?;
                let groups = rules[ridx]
                    .get("conditionGroups")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                let conditions = groups[gidx]
                    .get("conditions")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: conditions is not an array".to_string())?;
                if cidx >= conditions.len() {
                    return Err(format!("--condition-index {} out of range (have {})", cidx, conditions.len()));
                }
                current_condition_index = Some(cidx);
                i += 2;
            }
            "--condition-negate" | "-cn" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let gidx = current_condition_group_index
                    .ok_or_else(|| "--condition-negate requires a selected condition group".to_string())?;
                let cidx = current_condition_index
                    .ok_or_else(|| "--condition-negate requires a preceding --condition".to_string())?;
                let negate = parse_bool(&next(i, args)?, false);
                let groups = rules[ridx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                groups[gidx]["conditions"][cidx]["negate"] = Value::Bool(negate);
                i += 2;
            }
            "--condition-operator" | "-co" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let gidx = current_condition_group_index
                    .ok_or_else(|| "--condition-operator requires a selected condition group".to_string())?;
                let cidx = current_condition_index
                    .ok_or_else(|| "--condition-operator requires a preceding --condition".to_string())?;
                let op = next(i, args)?.to_ascii_lowercase();
                if op != "and" && op != "or" {
                    return Err("--condition-operator expects 'and' or 'or'".to_string());
                }
                let groups = rules[ridx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                groups[gidx]["conditions"][cidx]["operator"] = Value::String(op);
                i += 2;
            }
            "--condition-param" | "-cp" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let raw = next(i, args)?;
                let cidx = current_condition_index
                    .ok_or_else(|| "--condition-param requires a preceding --condition".to_string())?;
                let gidx = current_condition_group_index
                    .ok_or_else(|| "--condition-param requires a selected condition group".to_string())?;
                let condition_groups = rules[ridx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                let group = condition_groups
                    .get_mut(gidx)
                    .ok_or_else(|| "Internal error: missing selected condition group".to_string())?;
                let conditions = group
                    .get_mut("conditions")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditions is not an array".to_string())?;
                let params = conditions[cidx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: condition params is not an object".to_string())?;
                insert_param_assignments(params, &raw)?;
                i += 2;
            }
            "--condition-param-json" | "-cpj" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let cidx = current_condition_index
                    .ok_or_else(|| "--condition-param-json requires a preceding --condition".to_string())?;
                let gidx = current_condition_group_index
                    .ok_or_else(|| "--condition-param-json requires a selected condition group".to_string())?;
                let raw = next(i, args)?;
                let map = parse_json_map(&raw, "--condition-param-json")?;
                let condition_groups = rules[ridx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                let conditions = condition_groups[gidx]
                    .get_mut("conditions")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditions is not an array".to_string())?;
                let params = conditions[cidx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: condition params is not an object".to_string())?;
                for (k, v) in map {
                    params.insert(k, if v.is_object() { v } else { wrapped_param_value(&v.to_string().trim_matches('"')) });
                }
                i += 2;
            }
            "--condition-value" | "-cv" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let raw_value = next(i, args)?;
                let wrapped = wrapped_param_value(&raw_value);
                let cidx = current_condition_index
                    .ok_or_else(|| "--condition-value requires a preceding --condition".to_string())?;
                let gidx = current_condition_group_index
                    .ok_or_else(|| "--condition-value requires a selected condition group".to_string())?;
                let condition_groups = rules[ridx]
                    .get_mut("conditionGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditionGroups is not an array".to_string())?;
                let group = condition_groups
                    .get_mut(gidx)
                    .ok_or_else(|| "Internal error: missing selected condition group".to_string())?;
                let conditions = group
                    .get_mut("conditions")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: conditions is not an array".to_string())?;
                let params = conditions[cidx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: condition params is not an object".to_string())?;
                params.insert("value".to_string(), wrapped);
                i += 2;
            }
            "--random" | "-rg" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let raw = next(i, args)?;
                let (num_raw, den_raw) = raw
                    .split_once('/')
                    .ok_or_else(|| "--random expects num/den format, e.g. 1/4".to_string())?;
                let numerator = num_raw.trim().parse::<i64>().unwrap_or(1);
                let denominator = den_raw.trim().parse::<i64>().unwrap_or(4);
                let random_groups = rules[ridx]
                    .get_mut("randomGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                random_groups.push(json!({
                    "id": format!("random_group_{}", random_groups.len()),
                    "chance_numerator": { "value": numerator, "valueType": "number" },
                    "chance_denominator": { "value": denominator, "valueType": "number" },
                    "respect_probability_effects": true,
                    "custom_key": "",
                    "effects": []
                }));
                current_random_group_index = Some(random_groups.len() - 1);
                current_random_effect_index = None;
                i += 2;
            }
            "--random-index" | "-rgi" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let rgidx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--random-index expects a non-negative integer".to_string())?;
                let groups = rules[ridx]
                    .get("randomGroups")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                if rgidx >= groups.len() {
                    return Err(format!("--random-index {} out of range (have {})", rgidx, groups.len()));
                }
                current_random_group_index = Some(rgidx);
                current_random_effect_index = None;
                i += 2;
            }
            "--random-key" | "-rgk" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let rgidx = current_random_group_index
                    .ok_or_else(|| "--random-key requires a preceding --random".to_string())?;
                let key = next(i, args)?;
                let groups = rules[ridx]
                    .get_mut("randomGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                groups[rgidx]["custom_key"] = Value::String(key);
                i += 2;
            }
            "--random-respect" | "-rgr" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let rgidx = current_random_group_index
                    .ok_or_else(|| "--random-respect requires a preceding --random".to_string())?;
                let val = parse_bool(&next(i, args)?, true);
                let groups = rules[ridx]
                    .get_mut("randomGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                groups[rgidx]["respect_probability_effects"] = Value::Bool(val);
                i += 2;
            }
            "--random-effect" | "-re" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let effect_type = next(i, args)?;
                let rg_idx = current_random_group_index
                    .ok_or_else(|| "--random-effect requires a preceding --random".to_string())?;
                let random_groups = rules[ridx]
                    .get_mut("randomGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                let effects = random_groups[rg_idx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: random group effects is not an array".to_string())?;
                effects.push(json!({
                    "id": format!("random_effect_{}_{}", rg_idx, effects.len()),
                    "type": effect_type,
                    "params": {}
                }));
                current_random_effect_index = Some(effects.len() - 1);
                i += 2;
            }
            "--random-effect-index" | "-rei" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let rg_idx = current_random_group_index
                    .ok_or_else(|| "--random-effect-index requires a selected random group".to_string())?;
                let re_idx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--random-effect-index expects a non-negative integer".to_string())?;
                let random_groups = rules[ridx]
                    .get("randomGroups")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                let effects = random_groups[rg_idx]
                    .get("effects")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: random group effects is not an array".to_string())?;
                if re_idx >= effects.len() {
                    return Err(format!("--random-effect-index {} out of range (have {})", re_idx, effects.len()));
                }
                current_random_effect_index = Some(re_idx);
                i += 2;
            }
            "--random-effect-param" | "-rep" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let raw = next(i, args)?;
                let rg_idx = current_random_group_index
                    .ok_or_else(|| "--random-effect-param requires a preceding --random".to_string())?;
                let re_idx = current_random_effect_index
                    .ok_or_else(|| "--random-effect-param requires a preceding --random-effect".to_string())?;
                let random_groups = rules[ridx]
                    .get_mut("randomGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                let effects = random_groups[rg_idx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: random group effects is not an array".to_string())?;
                let params = effects[re_idx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: random effect params is not an object".to_string())?;
                insert_param_assignments(params, &raw)?;
                i += 2;
            }
            "--random-effect-param-json" | "-repj" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let rg_idx = current_random_group_index
                    .ok_or_else(|| "--random-effect-param-json requires a selected random group".to_string())?;
                let re_idx = current_random_effect_index
                    .ok_or_else(|| "--random-effect-param-json requires a selected random effect".to_string())?;
                let raw = next(i, args)?;
                let map = parse_json_map(&raw, "--random-effect-param-json")?;
                let random_groups = rules[ridx]
                    .get_mut("randomGroups")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: randomGroups is not an array".to_string())?;
                let effects = random_groups[rg_idx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: random group effects is not an array".to_string())?;
                let params = effects[re_idx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: random effect params is not an object".to_string())?;
                for (k, v) in map {
                    params.insert(k, if v.is_object() { v } else { wrapped_param_value(&v.to_string().trim_matches('"')) });
                }
                i += 2;
            }
            "--loop" | "-l" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let count_raw = next(i, args)?;
                let repetitions = count_raw.trim().parse::<i64>().unwrap_or(1).max(1);
                let loops = rules[ridx]
                    .get_mut("loops")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                loops.push(json!({
                    "id": format!("loop_group_{}", loops.len()),
                    "repetitions": { "value": repetitions, "valueType": "number" },
                    "effects": []
                }));
                current_loop_group_index = Some(loops.len() - 1);
                current_loop_effect_index = None;
                i += 2;
            }
            "--loop-index" | "-li" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let lidx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--loop-index expects a non-negative integer".to_string())?;
                let loops = rules[ridx]
                    .get("loops")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                if lidx >= loops.len() {
                    return Err(format!("--loop-index {} out of range (have {})", lidx, loops.len()));
                }
                current_loop_group_index = Some(lidx);
                current_loop_effect_index = None;
                i += 2;
            }
            "--loop-effect" | "-le" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let effect_type = next(i, args)?;
                let lg_idx = current_loop_group_index
                    .ok_or_else(|| "--loop-effect requires a preceding --loop".to_string())?;
                let loops = rules[ridx]
                    .get_mut("loops")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                let effects = loops[lg_idx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loop effects is not an array".to_string())?;
                effects.push(json!({
                    "id": format!("loop_effect_{}_{}", lg_idx, effects.len()),
                    "type": effect_type,
                    "params": {}
                }));
                current_loop_effect_index = Some(effects.len() - 1);
                i += 2;
            }
            "--loop-effect-index" | "-lei" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let lg_idx = current_loop_group_index
                    .ok_or_else(|| "--loop-effect-index requires a selected loop group".to_string())?;
                let le_idx = next(i, args)?
                    .parse::<usize>()
                    .map_err(|_| "--loop-effect-index expects a non-negative integer".to_string())?;
                let loops = rules[ridx]
                    .get("loops")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                let effects = loops[lg_idx]
                    .get("effects")
                    .and_then(Value::as_array)
                    .ok_or_else(|| "Internal error: loop effects is not an array".to_string())?;
                if le_idx >= effects.len() {
                    return Err(format!("--loop-effect-index {} out of range (have {})", le_idx, effects.len()));
                }
                current_loop_effect_index = Some(le_idx);
                i += 2;
            }
            "--loop-effect-param" | "-lep" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let raw = next(i, args)?;
                let lg_idx = current_loop_group_index
                    .ok_or_else(|| "--loop-effect-param requires a preceding --loop".to_string())?;
                let le_idx = current_loop_effect_index
                    .ok_or_else(|| "--loop-effect-param requires a preceding --loop-effect".to_string())?;
                let loops = rules[ridx]
                    .get_mut("loops")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                let effects = loops[lg_idx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loop effects is not an array".to_string())?;
                let params = effects[le_idx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: loop effect params is not an object".to_string())?;
                insert_param_assignments(params, &raw)?;
                i += 2;
            }
            "--loop-effect-param-json" | "-lepj" => {
                let ridx = ensure_rule(&mut rules, &mut current_rule_index);
                let lg_idx = current_loop_group_index
                    .ok_or_else(|| "--loop-effect-param-json requires a selected loop group".to_string())?;
                let le_idx = current_loop_effect_index
                    .ok_or_else(|| "--loop-effect-param-json requires a selected loop effect".to_string())?;
                let raw = next(i, args)?;
                let map = parse_json_map(&raw, "--loop-effect-param-json")?;
                let loops = rules[ridx]
                    .get_mut("loops")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loops is not an array".to_string())?;
                let effects = loops[lg_idx]
                    .get_mut("effects")
                    .and_then(Value::as_array_mut)
                    .ok_or_else(|| "Internal error: loop effects is not an array".to_string())?;
                let params = effects[le_idx]
                    .get_mut("params")
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "Internal error: loop effect params is not an object".to_string())?;
                for (k, v) in map {
                    params.insert(k, if v.is_object() { v } else { wrapped_param_value(&v.to_string().trim_matches('"')) });
                }
                i += 2;
            }
            "--print-request-json" | "-prj" => {
                print_request_json = true;
                i += 1;
            }
            "--print-rules-json" | "-pr" => {
                print_rules_json = true;
                i += 1;
            }
            "--dry-run" | "-n" => {
                dry_run = true;
                i += 1;
            }
            _ => {
                return Err(format!("Unknown argument: {}", flag));
            }
        }
    }

    let final_rules = if let Some(custom_rules) = rules_json {
        custom_rules
    } else {
        if rules.is_empty() {
            Value::Array(vec![make_rule(0, None)])
        } else {
            Value::Array(rules)
        }
    };

    let final_name = name.unwrap_or_else(|| {
        let mut chars = item_type.chars();
        match chars.next() {
            Some(first) => format!("New {}{}", first.to_ascii_uppercase(), chars.as_str()),
            None => "New Item".to_string(),
        }
    });
    let final_object_key = object_key.unwrap_or_else(|| format!("new_{}", item_type));
    let final_description = description.unwrap_or_else(|| format!("Generated {}", item_type));
    let mut item_data = default_item_data(
        &item_type,
        &final_object_key,
        &final_name,
        &final_description,
        rarity,
        cost,
        final_rules,
    );
    if let Some(obj) = item_data.as_object_mut() {
        if let Some(v) = atlas {
            obj.insert("atlas".to_string(), Value::String(v));
        }
        if let Some(v) = unlocked {
            obj.insert("unlocked".to_string(), Value::Bool(v));
        }
        if let Some(v) = discovered {
            obj.insert("discovered".to_string(), Value::Bool(v));
        }
        if let Some(v) = appears_in_shop {
            obj.insert("appears_in_shop".to_string(), Value::Bool(v));
        }
        if let Some(v) = blueprint_compat {
            obj.insert("blueprint_compat".to_string(), Value::Bool(v));
        }
        if let Some(v) = eternal_compat {
            obj.insert("eternal_compat".to_string(), Value::Bool(v));
        }
        if let Some(v) = perishable_compat {
            obj.insert("perishable_compat".to_string(), Value::Bool(v));
        }
        if !localizations.is_empty() {
            obj.insert("localizations".to_string(), Value::Array(localizations));
        }
        if !user_variables.is_empty() {
            obj.insert("userVariables".to_string(), Value::Array(user_variables));
        }
    }

    validate_rulebuilder_item_data(&item_type, &item_data)?;

    Ok(QuickBuildResult {
        request: CliCodegenItemRequest {
            item_type,
            item_data,
            pos: None,
            soul_pos: None,
            mod_prefix,
            include_loc_txt,
            global_user_variables: None,
        },
        dry_run,
        print_request_json,
        print_rules_json,
    })
}

pub fn run_codegen_item_command(args: &[String]) -> Result<(), String> {
    if args.is_empty()
        || args[0] == "--help"
        || args[0] == "-h"
        || args[0].eq_ignore_ascii_case("help")
    {
        print_codegen_item_usage();
        return Ok(());
    }
    if args[0] == "--help-json" || args[0] == "-hj" {
        print_codegen_item_help_json();
        return Ok(());
    }

    // Explicit mode separation:
    //   codegen-item quick ...
    //   codegen-item json --json ...
    if args[0].eq_ignore_ascii_case("quick") {
        let quick = build_quick_codegen_request(&args[1..])?;
        if quick.print_rules_json {
            if let Some(rules) = quick.request.item_data.get("rules") {
                println!(
                    "{}",
                    serde_json::to_string_pretty(rules).unwrap_or_else(|_| rules.to_string())
                );
            }
        }
        if quick.print_request_json || quick.dry_run {
            let request_view = request_preview_json(&quick.request);
            println!(
                "{}",
                serde_json::to_string_pretty(&request_view)
                    .unwrap_or_else(|_| request_view.to_string())
            );
        }
        if quick.dry_run {
            return Ok(());
        }
        let lua = commands::compile_item_from_data(
            quick.request.item_type,
            quick.request.item_data,
            quick.request.pos,
            quick.request.soul_pos,
            quick.request.mod_prefix,
            quick.request.include_loc_txt,
            quick.request.global_user_variables,
        )?;
        println!("{}", lua);
        return Ok(());
    }
    if args[0].eq_ignore_ascii_case("json") {
        return run_codegen_item_command(&args[1..]);
    }

    // Positional quick mode: `codegen-item <item-type> ...`
    if !args[0].starts_with("--") {
        let quick = build_quick_codegen_request(args)?;
        if quick.print_rules_json {
            if let Some(rules) = quick.request.item_data.get("rules") {
                println!(
                    "{}",
                    serde_json::to_string_pretty(rules).unwrap_or_else(|_| rules.to_string())
                );
            }
        }
        if quick.print_request_json || quick.dry_run {
            let request_view = request_preview_json(&quick.request);
            println!(
                "{}",
                serde_json::to_string_pretty(&request_view)
                    .unwrap_or_else(|_| request_view.to_string())
            );
        }
        if quick.dry_run {
            return Ok(());
        }
        let lua = commands::compile_item_from_data(
            quick.request.item_type,
            quick.request.item_data,
            quick.request.pos,
            quick.request.soul_pos,
            quick.request.mod_prefix,
            quick.request.include_loc_txt,
            quick.request.global_user_variables,
        )?;
        println!("{}", lua);
        return Ok(());
    }

    let mut json_payload: Option<String> = None;
    let mut json_file: Option<String> = None;
    let mut print_request_json = false;
    let mut dry_run = false;

    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--json" | "-j" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value for --json".to_string())?;
                json_payload = Some(value.clone());
            }
            "--json-file" | "-jf" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value for --json-file".to_string())?;
                json_file = Some(value.clone());
            }
            "--print-request-json" | "-prj" => {
                print_request_json = true;
            }
            "--dry-run" | "-n" => {
                dry_run = true;
            }
            unknown => {
                return Err(format!("Unknown argument: {}", unknown));
            }
        }
        index += 1;
    }

    if json_payload.is_some() == json_file.is_some() {
        return Err("Provide exactly one of --json or --json-file".to_string());
    }
    let raw_json = if let Some(path) = json_file {
        fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read JSON file '{}': {}", path, e))?
    } else {
        json_payload.expect("checked above")
    };
    let request: CliCodegenItemRequest =
        serde_json::from_str(&raw_json).map_err(|e| format!("Invalid JSON payload: {}", e))?;

    if print_request_json || dry_run {
        let request_view = request_preview_json(&request);
        println!(
            "{}",
            serde_json::to_string_pretty(&request_view).unwrap_or_else(|_| request_view.to_string())
        );
    }
    if !dry_run {
        let lua = commands::compile_item_from_data(
            request.item_type,
            request.item_data,
            request.pos,
            request.soul_pos,
            request.mod_prefix,
            request.include_loc_txt,
            request.global_user_variables,
        )?;
        println!("{}", lua);
    }
    Ok(())
}

