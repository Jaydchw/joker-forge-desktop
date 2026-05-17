use crate::compiler::context::CompileContext;
use crate::compiler::values::is_user_variable_type;
use crate::types::{EffectDef, ParamValue};

pub fn get_str(effect: &EffectDef, key: &str) -> Option<String> {
    effect.params.get(key).map(|v| v.to_string_lossy())
}

pub fn get_str_opt(effect: &EffectDef, key: &str) -> Option<String> {
    get_str(effect, key)
}

pub fn get_str_default(effect: &EffectDef, key: &str, default: &str) -> String {
    match effect.params.get(key) {
        Some(v) => {
            let s = v.to_string_lossy();
            if s.is_empty() { default.to_string() } else { s }
        }
        None => default.to_string(),
    }
}

pub fn get_typed_str(effect: &EffectDef, key: &str) -> String {
    match effect.params.get(key) {
        Some(ParamValue::Typed(t)) => t.value.as_str().unwrap_or("none").to_string(),
        Some(v) => v.to_string_lossy(),
        None => "none".to_string(),
    }
}

pub fn get_typed_value_type(effect: &EffectDef, key: &str) -> String {
    match effect.params.get(key) {
        Some(ParamValue::Typed(t)) => t.value_type.clone(),
        _ => "specific".to_string(),
    }
}

pub fn is_literal_one_param(effect: &EffectDef, key: &str) -> bool {
    match effect.params.get(key) {
        Some(ParamValue::Int(n)) => *n == 1,
        Some(ParamValue::Float(n)) => (*n - 1.0).abs() < f64::EPSILON,
        Some(ParamValue::Str(s)) => s.trim() == "1",
        Some(ParamValue::Typed(t)) => {
            if let Some(n) = t.value.as_i64() {
                n == 1
            } else if let Some(n) = t.value.as_f64() {
                (n - 1.0).abs() < f64::EPSILON
            } else if let Some(s) = t.value.as_str() {
                s.trim() == "1"
            } else {
                false
            }
        }
        _ => false,
    }
}

/// Resolve a value parameter as Lua string while registering config vars for literals.
/// Keeps support for user vars, typed user vars, and known game vars.
pub fn value_to_lua_str(
    effect: &EffectDef,
    param_key: &str,
    ctx: &mut CompileContext,
    var_base: &str,
) -> String {
    let count = ctx.next_effect_count(var_base);
    let var_name = ctx.unique_var_name(var_base, count);

    match effect.params.get(param_key) {
        Some(ParamValue::Int(n)) => {
            ctx.add_config_int(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        Some(ParamValue::Float(n)) => {
            ctx.add_config_num(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        Some(ParamValue::Typed(t)) => {
            if is_user_variable_type(&t.value_type) {
                if let Some(name) = t.value.as_str() {
                    ctx.user_var_path(name)
                } else {
                    "1".to_string()
                }
            } else if let Some(n) = t.value.as_f64() {
                if n.fract() == 0.0 {
                    ctx.add_config_int(&var_name, n as i64);
                } else {
                    ctx.add_config_num(&var_name, n);
                }
                format!("{}.{}", ctx.ability_path(), var_name)
            } else if let Some(s) = t.value.as_str() {
                if let Ok(n) = s.parse::<f64>() {
                    if n.fract() == 0.0 {
                        ctx.add_config_int(&var_name, n as i64);
                    } else {
                        ctx.add_config_num(&var_name, n);
                    }
                    format!("{}.{}", ctx.ability_path(), var_name)
                } else {
                    use crate::compiler::values::game_var_lua_code;
                    if let Some(code) = game_var_lua_code(s) {
                        code.to_string()
                    } else if ctx.has_user_var(s) {
                        ctx.user_var_path(s)
                    } else {
                        s.to_string()
                    }
                }
            } else {
                "1".to_string()
            }
        }
        Some(ParamValue::Str(s)) if ctx.has_user_var(s) => ctx.user_var_path(s),
        Some(ParamValue::Str(s)) => {
            if let Ok(n) = s.parse::<f64>() {
                if n.fract() == 0.0 {
                    ctx.add_config_int(&var_name, n as i64);
                } else {
                    ctx.add_config_num(&var_name, n);
                }
                format!("{}.{}", ctx.ability_path(), var_name)
            } else {
                use crate::compiler::values::game_var_lua_code;
                if let Some(code) = game_var_lua_code(s) {
                    code.to_string()
                } else {
                    s.clone()
                }
            }
        }
        _ => "1".to_string(),
    }
}
