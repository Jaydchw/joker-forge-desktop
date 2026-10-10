use crate::compiler::context::CompileContext;
use crate::compiler::values::{comparison_op, resolve_condition_value};
use crate::lua_ast::*;
use crate::types::{ConditionDef, UserVarType};

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

pub(crate) fn obtained_joker_card_guard() -> Expr {
    lua_raw_expr(
        "(type(context) == 'table' and type(context.card) == 'table' and type(context.card.config) == 'table' and type(context.card.config.center) == 'table' and context.card.config.center.set == 'Joker')",
    )
}

pub fn obtained_joker(condition: &ConditionDef, ctx: &CompileContext) -> Option<Expr> {
    let expected = if let Some(name) = super::utils::typed_user_var_name(condition, "joker_key", "joker_key") {
        if !ctx.user_vars().iter().any(|variable| variable.name == name && variable.var_type == UserVarType::Key) {
            return Some(super::utils::invalid_condition("obtained_joker", "unknown key variable"));
        }
        lua_raw_expr(joker_key_variable_expr(ctx, name)?)
    } else if let Some(key) = super::utils::str_param(condition, &["joker_key"]) {
        lua_str(key)
    } else {
        return Some(super::utils::invalid_condition("obtained_joker", "no joker key selected"));
    };

    let matches = lua_and(obtained_joker_card_guard(), lua_eq(
        lua_path(&["context", "card", "config", "center", "key"]),
        lua_ident("obtained_key"),
    ));
    let matcher = lua_raw_expr(format!(
        "(function(obtained_key) if type(obtained_key) ~= 'string' or obtained_key == '' then return false end; if obtained_key:sub(1, 2) ~= 'j_' then obtained_key = 'j_' .. obtained_key end; return not not ({matches}) end)"
    ));
    Some(Expr::Call(Box::new(matcher), vec![expected]))
}

pub fn specific_joker_owned(condition: &ConditionDef, ctx: &CompileContext) -> Option<Expr> {
    let selection_method = get_param(condition, &["type", "selection_method"])
        .and_then(|v| v.as_str())
        .unwrap_or("key");

    if selection_method == "pool" {
        let Some(pool) = super::utils::str_param(condition, &["pool", "joker_pool"]) else {
            return Some(super::utils::invalid_condition(
                "specific_joker", "no pool selected",
            ));
        };
        let local_pool = local_registry_key(pool, &ctx.mod_prefix);
        return Some(lua_raw_expr(format!(
            "(function() local pools = G and G.P_CENTER_POOLS; local pool = pools and (pools[{pool}] or pools[{local_pool}]); if not pool then return false end; local members = {{}}; for _, center in pairs(pool) do if type(center) == 'table' and center.key then members[center.key] = true end end; for _, v in ipairs((G and G.jokers and G.jokers.cards) or {{}}) do if v.config and v.config.center and members[v.config.center.key] then return true end end; return false end)()",
            pool = lua_str(pool), local_pool = lua_str(local_pool),
        )));
    }

    if selection_method == "rarity" {
        let rarity = get_param(condition, &["rarity"])
            .map(|v| v.to_string_lossy())
            .unwrap_or_else(|| "common".into());
        let rarity = rarity.trim();
        if rarity.is_empty() {
            return Some(super::utils::invalid_condition(
                "specific_joker", "no rarity selected",
            ));
        }
        let vanilla = match rarity.to_ascii_lowercase().as_str() {
            "common" | "1" => Some((1, "Common")),
            "uncommon" | "2" => Some((2, "Uncommon")),
            "rare" | "3" => Some((3, "Rare")),
            "legendary" | "4" => Some((4, "Legendary")),
            _ => None,
        };
        let matcher = if let Some((number, name)) = vanilla {
            format!(
                "(tonumber(v.config.center.rarity) == {number} or v.config.center.rarity == {})",
                lua_str(name),
            )
        } else {
            let local_rarity = local_registry_key(rarity, &ctx.mod_prefix);
            format!(
                "v.config.center.rarity == (function() if SMODS and SMODS.Rarities and SMODS.Rarities[{rarity}] then return {rarity} end; return {local_rarity} end)()",
                rarity = lua_str(rarity), local_rarity = lua_str(local_rarity),
            )
        };
        return Some(owned_joker_match(&matcher));
    }

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
        let Some(expected) = joker_key_variable_expr(ctx, key_var) else {
            return Some(super::utils::invalid_condition(
                "specific_joker", "unknown key variable",
            ));
        };
        return Some(lua_raw_expr(format!(
            "(function() local expected = {expected}; if type(expected) ~= 'string' or expected == '' then return false end; if expected:sub(1, 2) ~= 'j_' then expected = 'j_' .. expected end; for _, v in ipairs((G and G.jokers and G.jokers.cards) or {{}}) do if v.config and v.config.center and v.config.center.key == expected then return true end end; return false end)()"
        )));
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
        let normalized = normalized_joker_key(joker_key.trim());
        format!("v.config.center.key == {}", lua_str(normalized))
    };

    Some(owned_joker_match(&matcher))
}

fn owned_joker_match(matcher: &str) -> Expr {
    lua_raw_expr(format!(
        "(function() for _, v in ipairs((G and G.jokers and G.jokers.cards) or {{}}) do if v.config and v.config.center and {matcher} then return true end end; return false end)()"
    ))
}

fn local_registry_key(key: &str, mod_prefix: &str) -> String {
    if mod_prefix.is_empty() || key.starts_with(&format!("{mod_prefix}_")) {
        key.to_string()
    } else {
        format!("{mod_prefix}_{key}")
    }
}

fn joker_key_variable_expr(ctx: &CompileContext, name: &str) -> Option<String> {
    if !ctx.has_user_var(name) {
        return None;
    }
    let base = if ctx.user_var_is_global(name) {
        if ctx.user_var_is_persistent(name) {
            "JF_GLOBALS".into()
        } else {
            "G.GAME.jf_global_vars".into()
        }
    } else {
        ctx.ability_path()
    };
    let parts: Vec<&str> = base.split('.').collect();
    let guarded_base = (1..=parts.len())
        .map(|end| parts[..end].join("."))
        .collect::<Vec<_>>()
        .join(" and ");
    Some(format!("({guarded_base} and {base}[{}])", lua_str(name)))
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
        let normalized = lua_str(normalized_joker_key(joker_key.trim()));
        return Some(lua_raw_expr(format!(
            "(function() for _, selected in ipairs((G and G.jokers and G.jokers.highlighted) or {{}}) do if selected.config and selected.config.center and selected.config.center.key == {} then return true end end return false end)()",
            normalized
        )));
    }

    let rarity = get_param(condition, &["rarity"])
        .map(|value| value.to_string_lossy())
        .unwrap_or_else(|| "any".into());
    if rarity != "any" {
        let rarity = rarity_literal(&rarity);
        return Some(lua_raw_expr(format!(
            "(function() for _, selected in ipairs((G and G.jokers and G.jokers.highlighted) or {{}}) do if selected.config and selected.config.center and selected.config.center.rarity == {} then return true end end return false end)()",
            rarity
        )));
    }

    Some(lua_raw_expr("#((G and G.jokers and G.jokers.highlighted) or {}) > 0"))
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

pub fn joker_key(condition: &ConditionDef, ctx: &CompileContext) -> Option<Expr> {
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
        let Some(expected) = joker_key_variable_expr(ctx, key_var) else {
            return Some(super::utils::invalid_condition("joker_key", "unknown key variable"));
        };
        return Some(joker_key_match(&expected));
    }

    let joker_key = get_param(condition, &["joker_key", "jokerKey", "value"])
        .map(|v| v.to_string_lossy())
        .unwrap_or_default();
    if joker_key.trim().is_empty() {
        return Some(super::utils::invalid_condition(
            "joker_key",
            "no joker key given",
        ));
    }
    Some(joker_key_match(&lua_str(normalized_joker_key(joker_key.trim())).to_string()))
}

fn joker_key_match(expected: &str) -> Expr {
    lua_raw_expr(format!(
        "(function() local target = context and ((context.post_trigger and context.other_card) or (not context.post_trigger and context.other_joker)); local expected = {}; if type(expected) ~= 'string' or expected == '' then return false end; if expected:sub(1, 2) ~= 'j_' then expected = 'j_' .. expected end; return not not (target and target.config and target.config.center and target.config.center.key == expected) end)()",
        expected
    ))
}

fn rarity_literal(rarity: &str) -> String {
    match rarity {
        "common" | "Common" | "1" => "1".to_string(),
        "uncommon" | "Uncommon" | "2" => "2".to_string(),
        "rare" | "Rare" | "3" => "3".to_string(),
        "legendary" | "Legendary" | "4" => "4".to_string(),
        other => lua_str(other).to_string(),
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
