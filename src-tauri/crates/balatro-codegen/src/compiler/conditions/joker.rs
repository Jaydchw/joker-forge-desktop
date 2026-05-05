use crate::compiler::context::CompileContext;
use crate::compiler::values::{comparison_op, resolve_condition_value};
use crate::lua_ast::*;
use crate::types::ConditionDef;

fn get_param<'a>(
    condition: &'a ConditionDef,
    keys: &[&str],
) -> Option<&'a crate::types::ParamValue> {
    for key in keys {
        if let Some(value) = condition.params.get(*key) {
            return Some(value);
        }
    }
    None
}

pub fn specific_joker_owned(condition: &ConditionDef) -> Option<Expr> {
    let joker_key = get_param(condition, &["joker_key", "jokerKey", "value"])
        .map(|v| v.to_string_lossy())
        .unwrap_or_default();
    if joker_key.is_empty() {
        return None;
    }

    let normalized = if joker_key.starts_with("j_") {
        joker_key
    } else {
        format!("j_{}", joker_key)
    };

    Some(lua_raw_expr(format!(
        "(function() for _, v in ipairs(G.jokers.cards or {{}}) do if v.config and v.config.center and v.config.center.key == '{}' then return true end end return false end)()",
        normalized
    )))
}

pub fn joker_rarity_count(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let operator = get_param(condition, &["operator", "op"])
        .and_then(|v| v.as_str())
        .unwrap_or("greater_equals");
    let value_expr = resolve_condition_value(&condition.params, "value", ctx, "joker_rarity_count")
        .or_else(|| resolve_condition_value(&condition.params, "count", ctx, "joker_rarity_count"))
        .unwrap_or_else(|| lua_int(1));
    let rarity = get_param(condition, &["rarity"])
        .map(|v| v.to_string_lossy())
        .unwrap_or_else(|| "any".to_string());

    let check = if rarity == "any" {
        "true".to_string()
    } else {
        format!(
            "v.config and v.config.center and tostring(v.config.center.rarity) == '{}'",
            rarity
        )
    };

    let count_expr = lua_raw_expr(format!(
        "(function() local c = 0; for _, v in ipairs(G.jokers.cards or {{}}) do if {} then c = c + 1 end end return c end)()",
        check
    ));

    Some(comparison_op(operator, count_expr, value_expr))
}

pub fn joker_position(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    let position = get_param(condition, &["position", "index_type"])
        .and_then(|v| v.as_str())
        .unwrap_or("first");

    match position {
        "first" => Some(lua_eq(lua_ident("card"), lua_raw_expr("G.jokers.cards[1]"))),
        "last" => Some(lua_eq(
            lua_ident("card"),
            lua_raw_expr("G.jokers.cards[#G.jokers.cards]"),
        )),
        _ => {
            let idx_expr =
                resolve_condition_value(&condition.params, "specific_index", ctx, "joker_position")
                    .or_else(|| {
                        resolve_condition_value(
                            &condition.params,
                            "index_number",
                            ctx,
                            "joker_position",
                        )
                    })
                    .unwrap_or_else(|| lua_int(1));
            Some(lua_eq(
                lua_ident("card"),
                lua_index(lua_path(&["G", "jokers", "cards"]), idx_expr),
            ))
        }
    }
}

pub fn joker_flipped(_condition: &ConditionDef) -> Option<Expr> {
    Some(lua_eq(lua_path(&["card", "facing"]), lua_str("back")))
}

pub fn joker_selected(condition: &ConditionDef) -> Option<Expr> {
    let check_key = get_param(condition, &["check_key", "mode"])
        .and_then(|v| v.as_str())
        .unwrap_or("any");

    if check_key == "key" {
        let joker_key = get_param(condition, &["joker_key", "jokerKey"])
            .map(|v| v.to_string_lossy())
            .unwrap_or_default();
        let normalized = if joker_key.starts_with("j_") {
            joker_key
        } else {
            format!("j_{}", joker_key)
        };
        return Some(lua_raw_expr(format!(
            "#G.jokers.highlighted > 0 and G.jokers.highlighted[1].config and G.jokers.highlighted[1].config.center and G.jokers.highlighted[1].config.center.key == '{}'",
            normalized
        )));
    }

    Some(lua_raw_expr("#G.jokers.highlighted > 0"))
}

pub fn joker_sticker(condition: &ConditionDef) -> Option<Expr> {
    let sticker = get_param(condition, &["sticker"])
        .and_then(|v| v.as_str())
        .unwrap_or("eternal");
    Some(lua_raw_expr(format!(
        "(card.ability and card.ability.{})",
        sticker
    )))
}

pub fn joker_edition(condition: &ConditionDef) -> Option<Expr> {
    let edition = get_param(condition, &["edition"])
        .and_then(|v| v.as_str())
        .unwrap_or("foil");
    Some(lua_raw_expr(format!(
        "(card.edition and card.edition.{})",
        edition
    )))
}
