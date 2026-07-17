use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::compiler::values::{
    ability_path_expr, is_game_variable_type, is_range_type, is_user_variable_type, resolve_value,
};
use crate::lua_ast::*;
use crate::types::{ConfigValue, ConfigVar, EffectDef, ParamValue};

/// Add Chips effect → `chips = N`
pub fn add_chips(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    scoring_effect(effect, ctx, "chips", "G.C.CHIPS")
}

/// Add Mult effect → `mult = N`
pub fn add_mult(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    scoring_effect(effect, ctx, "mult", "")
}

/// Apply XMult effect → `Xmult = N`
pub fn apply_x_mult(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    scoring_effect(effect, ctx, "Xmult", "")
}

/// Apply XChips effect → `Xchips = N`
pub fn apply_x_chips(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    scoring_effect(effect, ctx, "Xchips", "")
}

/// Apply Exp Chips → `e_chips = N` (Talisman)
pub fn apply_exp_chips(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    scoring_effect(effect, ctx, "e_chips", "G.C.DARK_EDITION")
}

/// Apply Exp Mult → `e_mult = N` (Talisman)
pub fn apply_exp_mult(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    scoring_effect(effect, ctx, "e_mult", "G.C.DARK_EDITION")
}

/// Apply Hyper Chips → `hyperchips = {arrows, n}` (Talisman)
pub fn apply_hyper_chips(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    hyper_effect(effect, ctx, "hyperchips")
}

/// Apply Hyper Mult → `hypermult = {arrows, n}` (Talisman)
pub fn apply_hyper_mult(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    hyper_effect(effect, ctx, "hypermult")
}

fn hyper_effect(effect: &EffectDef, ctx: &mut CompileContext, key: &str) -> EffectOutput {
    let n = crate::compiler::values::resolve_config_value(
        &effect.params,
        "value",
        ctx,
        &format!("{}_n", key),
    );
    let arrows = crate::compiler::values::resolve_config_value(
        &effect.params,
        "arrows",
        ctx,
        &format!("{}_arrows", key),
    );

    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(lua_str);

    EffectOutput {
        return_fields: vec![(
            key.to_string(),
            lua_table_raw(vec![
                TableEntry::Value(arrows.expr),
                TableEntry::Value(n.expr),
            ]),
        )],
        pre_return: vec![],
        config_vars: vec![],
        message,
        colour: None,
        segment_id: None,
    }
}

/// Shared implementation for all scoring effects.
/// These all follow the same pattern: resolve the value parameter,
/// register a config variable: and return a single table field.
fn scoring_effect(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    lua_field_name: &str,
    _colour: &str,
) -> EffectOutput {
    let count = ctx.next_effect_count(lua_field_name);
    let var_name = ctx.unique_var_name(lua_field_name, count);

    let value = effect.params.get("value");
    let (value_expr, config_var) = resolve_scoring_value(value, &var_name, ctx);

    if let Some(cv) = config_var {
        ctx.add_config_var(cv);
    }

    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(lua_str);

    EffectOutput {
        return_fields: vec![(lua_field_name.to_string(), value_expr)],
        pre_return: vec![],
        config_vars: vec![],
        message,
        colour: None,

        segment_id: None,
    }
}

/// Resolve a scoring value and optionally produce a config variable.
fn resolve_scoring_value(
    value: Option<&ParamValue>,
    var_name: &str,
    ctx: &CompileContext,
) -> (Expr, Option<ConfigVar>) {
    let Some(val) = value else {
        return (lua_int(0), None);
    };

    if let Some(config_value) = scoring_literal_config_value(val) {
        return (
            ability_path_expr(ctx.object_type, var_name),
            Some(ConfigVar {
                name: var_name.to_string(),
                value: config_value,
            }),
        );
    }

    if let ParamValue::Str(s) = val {
        if ctx.has_user_var(s) {
            return (ctx.user_var_expr(s), None);
        }
    }

    if let ParamValue::Typed(t) = val {
        if is_user_variable_type(&t.value_type) {
            if let Some(name) = t.value.as_str() {
                return (ctx.user_var_expr(name), None);
            }
            return (lua_int(0), None);
        }
        if let Some(name) = t.value.as_str() {
            if ctx.has_user_var(name) {
                return (ctx.user_var_expr(name), None);
            }
        }
    }

    // Game variable, range, or user variable, resolve directly
    let expr = resolve_value(val, ctx.object_type, None);
    (expr, None)
}

/// Convert "basic" literal scoring values into config vars.
///
/// This keeps generated code consistent by using `card.ability.extra.*`
/// for plain numerics: even when numeric values arrive as strings or typed
/// wrappers from the node editor pipeline.
fn scoring_literal_config_value(value: &ParamValue) -> Option<ConfigValue> {
    match value {
        ParamValue::Int(n) => Some(ConfigValue::Int(*n)),
        ParamValue::Float(n) => Some(ConfigValue::Number(*n)),
        ParamValue::Str(s) => parse_numeric_config_value(s),
        ParamValue::Typed(t) => {
            if is_game_variable_type(&t.value_type)
                || is_range_type(&t.value_type)
                || is_user_variable_type(&t.value_type)
            {
                return None;
            }

            if let Some(i) = t.value.as_i64() {
                return Some(ConfigValue::Int(i));
            }
            if let Some(n) = t.value.as_f64() {
                return Some(ConfigValue::Number(n));
            }
            if let Some(s) = t.value.as_str() {
                return parse_numeric_config_value(s);
            }
            None
        }
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Balance & Swap
// ---------------------------------------------------------------------------

/// Balance Chips and Mult: sets `balance = true` in the return table.
pub fn balance_chips_and_mult(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(lua_str);

    EffectOutput {
        return_fields: vec![("balance".to_string(), lua_bool(true))],
        pre_return: vec![],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.PURPLE")),

        segment_id: None,
    }
}

/// Swap Chips and Mult: sets `swap = true` in the return table.
pub fn swap_chips_and_mult(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(lua_str);

    EffectOutput {
        return_fields: vec![("swap".to_string(), lua_bool(true))],
        pre_return: vec![],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.CHIPS")),

        segment_id: None,
    }
}

fn parse_numeric_config_value(s: &str) -> Option<ConfigValue> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(i) = trimmed.parse::<i64>() {
        return Some(ConfigValue::Int(i));
    }
    if let Ok(n) = trimmed.parse::<f64>() {
        return Some(ConfigValue::Number(n));
    }
    None
}
