use crate::compiler::context::CompileContext;
use crate::compiler::values::{comparison_op, resolve_condition_value};
use crate::lua_ast::*;
use crate::types::ConditionDef;

enum JokerTarget {
    SelfJoker,
    OtherJoker,
}

impl JokerTarget {
    fn as_lua(self) -> &'static str {
        match self {
            JokerTarget::SelfJoker => "card",
            JokerTarget::OtherJoker => "context.other_joker",
        }
    }
}

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

fn normalized_joker_key(joker_key: &str) -> String {
    if joker_key.starts_with("j_") {
        joker_key.to_string()
    } else {
        format!("j_{}", joker_key)
    }
}

pub fn specific_joker_owned(condition: &ConditionDef) -> Option<Expr> {
    let selection_method = get_param(condition, &["type", "selection_method"])
        .and_then(|v| v.as_str())
        .unwrap_or("key");

    let matcher = if selection_method == "variable" {
        let key_var = match super::utils::str_param(condition, &["key_variable", "keyVar"]) {
            Some(name) => name,
            None => {
                return Some(super::utils::invalid_condition(
                    "specific_joker",
                    "no key variable selected",
                ))
            }
        };
        format!("v.config.center.key == card.ability.extra.{}", key_var)
    } else {
        let joker_key = get_param(condition, &["joker_key", "jokerKey", "value"])
            .map(|v| v.to_string_lossy())
            .unwrap_or_default();
        if joker_key.trim().is_empty() {
            return Some(super::utils::invalid_condition(
                "specific_joker",
                "no joker key given",
            ));
        }
        let normalized = normalized_joker_key(&joker_key);
        format!("v.config.center.key == '{}'", normalized)
    };

    Some(lua_raw_expr(format!(
        "(function() for _, v in ipairs(G.jokers.cards or {{}}) do if v.config and v.config.center and {} then return true end end return false end)()",
        matcher
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

fn joker_position_for_target(
    condition: &ConditionDef,
    ctx: &mut CompileContext,
    target: JokerTarget,
) -> Option<Expr> {
    let position = get_param(condition, &["position", "index_type"])
        .and_then(|v| v.as_str())
        .unwrap_or("first");
    let target_expr = lua_raw_expr(target.as_lua());

    match position {
        "first" => Some(lua_eq(target_expr, lua_raw_expr("G.jokers.cards[1]"))),
        "last" => Some(lua_eq(
            target_expr,
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
                target_expr,
                lua_index(lua_path(&["G", "jokers", "cards"]), idx_expr),
            ))
        }
    }
}

pub fn joker_position(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    joker_position_for_target(condition, ctx, JokerTarget::SelfJoker)
}

pub fn joker_index(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    joker_position_for_target(condition, ctx, JokerTarget::OtherJoker)
}

pub fn this_joker_index(condition: &ConditionDef, ctx: &mut CompileContext) -> Option<Expr> {
    joker_position_for_target(condition, ctx, JokerTarget::SelfJoker)
}

fn joker_flipped_for_target(target: JokerTarget) -> Expr {
    lua_raw_expr(format!(
        "({target} and {target}.facing == 'back')",
        target = target.as_lua()
    ))
}

pub fn joker_flipped(_condition: &ConditionDef) -> Option<Expr> {
    Some(joker_flipped_for_target(JokerTarget::OtherJoker))
}

pub fn this_joker_flipped(_condition: &ConditionDef) -> Option<Expr> {
    Some(joker_flipped_for_target(JokerTarget::SelfJoker))
}

pub fn joker_selected(condition: &ConditionDef) -> Option<Expr> {
    let check_key = get_param(condition, &["check_key", "mode"])
        .and_then(|v| v.as_str())
        .unwrap_or("any");

    if check_key == "key" {
        let joker_key = get_param(condition, &["joker_key", "jokerKey"])
            .map(|v| v.to_string_lossy())
            .unwrap_or_default();
        if joker_key.trim().is_empty() {
            return Some(super::utils::invalid_condition(
                "joker_selected",
                "no joker key given",
            ));
        }
        let normalized = normalized_joker_key(&joker_key);
        return Some(lua_raw_expr(format!(
            "#G.jokers.highlighted > 0 and G.jokers.highlighted[1].config and G.jokers.highlighted[1].config.center and G.jokers.highlighted[1].config.center.key == '{}'",
            normalized
        )));
    }

    Some(lua_raw_expr("#G.jokers.highlighted > 0"))
}

fn joker_sticker_for_target(condition: &ConditionDef, target: JokerTarget) -> Expr {
    let sticker = get_param(condition, &["sticker"])
        .and_then(|v| v.as_str())
        .unwrap_or("eternal");
    lua_raw_expr(format!(
        "({target} and {target}.ability and {target}.ability.{sticker})",
        target = target.as_lua(),
        sticker = sticker
    ))
}

pub fn joker_sticker(condition: &ConditionDef) -> Option<Expr> {
    Some(joker_sticker_for_target(condition, JokerTarget::OtherJoker))
}

pub fn this_joker_sticker(condition: &ConditionDef) -> Option<Expr> {
    Some(joker_sticker_for_target(condition, JokerTarget::SelfJoker))
}

fn joker_edition_for_target(condition: &ConditionDef, target: JokerTarget) -> Expr {
    let edition = get_param(condition, &["edition"])
        .and_then(|v| v.as_str())
        .unwrap_or("foil");
    lua_raw_expr(format!(
        "({target} and {target}.edition and ({target}.edition.{edition} or {target}.edition.key == '{edition}'))",
        target = target.as_lua(),
        edition = edition
    ))
}

pub fn joker_edition(condition: &ConditionDef) -> Option<Expr> {
    Some(joker_edition_for_target(condition, JokerTarget::OtherJoker))
}

pub fn this_joker_edition(condition: &ConditionDef) -> Option<Expr> {
    Some(joker_edition_for_target(condition, JokerTarget::SelfJoker))
}

pub fn joker_key(condition: &ConditionDef) -> Option<Expr> {
    let mode = get_param(condition, &["type", "selection_method"])
        .and_then(|v| v.as_str())
        .unwrap_or("key");

    if mode == "variable" {
        let key_var = match super::utils::str_param(condition, &["key_variable", "keyVar"]) {
            Some(name) => name,
            None => {
                return Some(super::utils::invalid_condition(
                    "joker_key",
                    "no key variable selected",
                ))
            }
        };
        return Some(lua_raw_expr(format!(
            "(context.other_joker and context.other_joker.config and context.other_joker.config.center and context.other_joker.config.center.key == card.ability.extra.{})",
            key_var
        )));
    }

    let joker_key = get_param(condition, &["joker_key", "jokerKey", "value"])
        .map(|v| v.to_string_lossy())
        .unwrap_or_default();
    if joker_key.is_empty() {
        return Some(super::utils::invalid_condition(
            "joker_key",
            "no joker key given",
        ));
    }
    let normalized = normalized_joker_key(&joker_key);

    Some(lua_raw_expr(format!(
        "(context.other_joker and context.other_joker.config and context.other_joker.config.center and context.other_joker.config.center.key == '{}')",
        normalized
    )))
}

fn rarity_literal(rarity: &str) -> String {
    match rarity {
        "common" | "Common" | "1" => "1".to_string(),
        "uncommon" | "Uncommon" | "2" => "2".to_string(),
        "rare" | "Rare" | "3" => "3".to_string(),
        "legendary" | "Legendary" | "4" => "4".to_string(),
        other => format!("'{}'", other),
    }
}

pub fn joker_rarity(condition: &ConditionDef) -> Option<Expr> {
    let rarity = get_param(condition, &["rarity"])
        .map(|v| v.to_string_lossy())
        .unwrap_or_else(|| "common".to_string());
    let rarity_lua = rarity_literal(&rarity);

    Some(lua_raw_expr(format!(
        "(context.other_joker and context.other_joker.config and context.other_joker.config.center and context.other_joker.config.center.rarity == {})",
        rarity_lua
    )))
}
