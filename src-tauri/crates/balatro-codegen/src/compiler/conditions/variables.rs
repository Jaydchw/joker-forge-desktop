use crate::compiler::conditions::utils::{invalid_condition, str_param};
use crate::compiler::context::CompileContext;
use crate::compiler::values::comparison_op;
use crate::compiler::values::resolve_condition_value;
use crate::lua_ast::*;
use crate::types::ConditionDef;

const VARIABLE_NAME_KEYS: &[&str] = &["variable_name", "variableName", "variable"];

fn variable_name<'a>(condition: &'a ConditionDef, condition_type: &str) -> Result<&'a str, Expr> {
    str_param(condition, VARIABLE_NAME_KEYS)
        .ok_or_else(|| invalid_condition(condition_type, "no variable selected"))
}

pub fn internal_variable(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let name = match variable_name(condition, "internal_variable") {
        Ok(name) => name,
        Err(marker) => return Some(marker),
    };
    let operator = str_param(condition, &["operator", "op"]).unwrap_or("equals");
    let rhs = resolve_condition_value(&condition.params, "value", ctx, "internal_variable_value")
        .unwrap_or_else(|| lua_int(0));

    Some(comparison_op(operator, ctx.user_var_expr(name), rhs))
}

pub fn key_variable(condition: &ConditionDef, ctx: &CompileContext) -> Option<Expr> {
    let name = match variable_name(condition, "key_variable") {
        Ok(name) => name,
        Err(marker) => return Some(marker),
    };
    let check_type = str_param(condition, &["check_type"]).unwrap_or("custom_text");
    if check_type == "key_var" {
        return match str_param(condition, &["key_variable"]) {
            Some(other) => Some(lua_eq(
                ctx.user_var_expr(name),
                ctx.user_var_expr(other),
            )),
            None => Some(invalid_condition("key_variable", "no key variable selected")),
        };
    }
    let specific_key = str_param(condition, &["specific_key", "key", "value"]).unwrap_or("none");

    Some(lua_eq(ctx.user_var_expr(name), lua_str(specific_key)))
}

pub fn text_variable(condition: &ConditionDef, ctx: &CompileContext) -> Option<Expr> {
    let name = match variable_name(condition, "text_variable") {
        Ok(name) => name,
        Err(marker) => return Some(marker),
    };
    let text = str_param(condition, &["text", "value"]).unwrap_or("");

    Some(lua_eq(ctx.user_var_expr(name), lua_str(text)))
}

pub fn poker_hand_variable(condition: &ConditionDef, _ctx: &CompileContext) -> Option<Expr> {
    let name = match variable_name(condition, "poker_hand_variable") {
        Ok(name) => name,
        Err(marker) => return Some(marker),
    };
    let hand_name = str_param(condition, &["poker_hand", "hand", "value"]).unwrap_or("High Card");

    Some(lua_eq(
        lua_raw_expr(format!("G.GAME.current_round.{}_hand", name)),
        lua_str(hand_name),
    ))
}

pub fn rank_variable(condition: &ConditionDef, _ctx: &CompileContext) -> Option<Expr> {
    let name = match variable_name(condition, "rank_variable") {
        Ok(name) => name,
        Err(marker) => return Some(marker),
    };
    let rank = str_param(condition, &["rank", "value"]).unwrap_or("Ace");

    Some(lua_eq(
        lua_raw_expr(format!(
            "(G.GAME.current_round.{}_card or {{}}).rank",
            name
        )),
        lua_str(rank),
    ))
}

pub fn suit_variable(condition: &ConditionDef, _ctx: &CompileContext) -> Option<Expr> {
    let name = match variable_name(condition, "suit_variable") {
        Ok(name) => name,
        Err(marker) => return Some(marker),
    };
    let suit = str_param(condition, &["suit", "value"]).unwrap_or("Spades");

    Some(lua_eq(
        lua_raw_expr(format!(
            "(G.GAME.current_round.{}_card or {{}}).suit",
            name
        )),
        lua_str(suit),
    ))
}
