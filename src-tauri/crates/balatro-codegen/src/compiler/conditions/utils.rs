use crate::types::{ConditionDef, ParamValue};

/// Convert rank name to Balatro numeric card ID string.
pub fn rank_to_id(rank: &str) -> &str {
    match rank {
        "Ace" => "14",
        "King" => "13",
        "Queen" => "12",
        "Jack" => "11",
        "10" => "10",
        "9" => "9",
        "8" => "8",
        "7" => "7",
        "6" => "6",
        "5" => "5",
        "4" => "4",
        "3" => "3",
        "2" => "2",
        _ => rank,
    }
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
