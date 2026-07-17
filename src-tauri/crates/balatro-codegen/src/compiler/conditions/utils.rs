use crate::lua_ast::{lua_raw_expr, Expr};
use crate::types::{ConditionDef, ParamValue};

/// Convert rank name to a Lua expression string yielding the card ID.
/// Standard ranks map to their numeric ID; custom SMODS ranks resolve
/// through `SMODS.Ranks` at runtime.
pub fn rank_to_id(rank: &str) -> String {
    match rank {
        "Ace" | "A" => "14".to_string(),
        "King" | "K" => "13".to_string(),
        "Queen" | "Q" => "12".to_string(),
        "Jack" | "J" => "11".to_string(),
        "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2" => rank.to_string(),
        "" => "14".to_string(),
        other => format!("((SMODS.Ranks['{}'] or {{}}).id or 0)", other.replace('\'', "\\'")),
    }
}

/// Read a string param, treating empty/whitespace values as missing.
/// Tries each key in order.
pub fn str_param<'a>(condition: &'a ConditionDef, keys: &[&str]) -> Option<&'a str> {
    for key in keys {
        if let Some(value) = condition.params.get(*key) {
            if let Some(s) = value.as_str() {
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
        }
    }
    None
}

/// Expression for a condition that cannot be compiled because a required
/// parameter is missing or invalid. Evaluates to `false` so the rule never
/// fires, with a visible marker in the generated code.
pub fn invalid_condition(condition_type: &str, reason: &str) -> Expr {
    lua_raw_expr(format!(
        "--[[ invalid condition {} ({}) ]] false",
        condition_type, reason
    ))
}

/// Returns a user-variable name for either of two condition params when encoded
/// as TypedValue of type `user_var`/`userVariable`.
pub fn typed_user_var_name<'a>(
    condition: &'a ConditionDef,
    primary_key: &str,
    secondary_key: &str,
) -> Option<&'a str> {
    typed_user_var_name_for_key(condition, primary_key)
        .or_else(|| typed_user_var_name_for_key(condition, secondary_key))
}

fn typed_user_var_name_for_key<'a>(condition: &'a ConditionDef, key: &str) -> Option<&'a str> {
    let value = condition.params.get(key)?;
    if let ParamValue::Typed(typed) = value {
        if typed.value_type == "user_var" || typed.value_type == "userVariable" {
            return typed.value.as_str();
        }
    }
    None
}
