use crate::lua_ast::*;
use crate::types::{ObjectType, ParamValue};

pub fn is_user_variable_type(value_type: &str) -> bool {
    matches!(value_type, "userVariable" | "user_var")
}

pub fn is_game_variable_type(value_type: &str) -> bool {
    matches!(value_type, "gameVariable" | "game_var")
}

pub fn is_range_type(value_type: &str) -> bool {
    matches!(value_type, "range" | "range_var")
}

/// Parsed game variable reference.
/// Format in params: `"GAMEVAR:varId|multiplier|startsFrom"`
pub struct GameVarRef {
    pub var_id: String,
    pub multiplier: f64,
    pub starts_from: f64,
}

/// Parsed range variable reference.
/// Format in params: `"RANGE:min|max"`
pub struct RangeRef {
    pub min: f64,
    pub max: f64,
}

/// Parse a `GAMEVAR:id|mult|start` string.
pub fn parse_game_var(s: &str) -> Option<GameVarRef> {
    let rest = s.strip_prefix("GAMEVAR:")?;
    let parts: Vec<&str> = rest.split('|').collect();
    if parts.len() < 3 {
        return None;
    }
    Some(GameVarRef {
        var_id: parts[0].to_string(),
        multiplier: parts[1].parse().unwrap_or(1.0),
        starts_from: parts[2].parse().unwrap_or(0.0),
    })
}

/// Parse a `RANGE:min|max` string.
pub fn parse_range_var(s: &str) -> Option<RangeRef> {
    let rest = s.strip_prefix("RANGE:")?;
    let parts: Vec<&str> = rest.split('|').collect();
    if parts.len() < 2 {
        return None;
    }
    Some(RangeRef {
        min: parts[0].parse().unwrap_or(0.0),
        max: parts[1].parse().unwrap_or(0.0),
    })
}

/// Known game variable IDs → their Lua code expressions.
pub fn game_var_lua_code(var_id: &str) -> Option<&'static str> {
    Some(match var_id {
        "hand_size" => "#G.hand.cards",
        "joker_count" => "#G.jokers.cards",
        "remaining_hands" => "G.GAME.current_round.hands_left",
        "remaining_discards" => "G.GAME.current_round.discards_left",
        "deck_size" => "#G.deck.cards",
        "full_deck_size" => "#G.playing_cards",
        "player_money" => "G.GAME.dollars",
        "ante_level" => "G.GAME.round_resets.ante",
        "blind_chips" => "G.GAME.blind.chips",
        "blind_mult" => "G.GAME.blind.mult",
        "consumable_count" => "#G.consumeables.cards",
        "interest" => "G.GAME.interest_amount",
        "hand_level" => "G.GAME.hands[context.scoring_name].level",
        "times_hand_played" => "G.GAME.hands[context.scoring_name].played",
        "scored_card_count" => "#context.scoring_hand",
        "played_card_count" => "#context.full_hand",
        "poker_hand_count" => "(function() local c = 0; for _, v in pairs(G.GAME.hands) do if v.visible then c = c + 1 end end return c end)()",
        _ => return None,
    })
}

/// Resolve a parameter value to a Lua expression.
///
/// Handles plain numbers, strings, game variable references: range references,
/// and user variable references. When a value is a config variable (stored in
/// ability.extra): `config_var_name` provides the key to reference.
pub fn resolve_value(
    value: &ParamValue,
    object_type: ObjectType,
    config_var_name: Option<&str>,
) -> Expr {
    match value {
        ParamValue::Int(n) => {
            if let Some(name) = config_var_name {
                return ability_path_expr(object_type, name);
            }
            lua_int(*n)
        }
        ParamValue::Float(n) => {
            if let Some(name) = config_var_name {
                return ability_path_expr(object_type, name);
            }
            lua_num(*n)
        }
        ParamValue::Bool(b) => lua_bool(*b),
        ParamValue::Str(s) => resolve_string_value(s, object_type, config_var_name),
        ParamValue::Typed(typed) => {
            if is_game_variable_type(&typed.value_type) {
                if let Some(s) = typed.value.as_str() {
                    if let Some(gv) = parse_game_var(s) {
                        return build_game_var_expr(&gv);
                    }
                }
                lua_nil()
            } else if is_range_type(&typed.value_type) {
                if let Some(s) = typed.value.as_str() {
                    if let Some(rv) = parse_range_var(s) {
                        return lua_call(
                            "pseudorandom",
                            vec![lua_str(s), lua_num(rv.min), lua_num(rv.max)],
                        );
                    }
                }
                lua_nil()
            } else if is_user_variable_type(&typed.value_type) {
                if let Some(name) = typed.value.as_str() {
                    return ability_path_expr(object_type, name);
                }
                lua_nil()
            } else {
                // Fall through to string/number resolution
                if let Some(n) = typed.value.as_f64() {
                    if let Some(name) = config_var_name {
                        return ability_path_expr(object_type, name);
                    }
                    if n.fract() == 0.0 {
                        lua_int(n as i64)
                    } else {
                        lua_num(n)
                    }
                } else if let Some(s) = typed.value.as_str() {
                    resolve_string_value(s, object_type, config_var_name)
                } else {
                    lua_nil()
                }
            }
        }
    }
}

fn resolve_string_value(s: &str, object_type: ObjectType, config_var_name: Option<&str>) -> Expr {
    // Game variable reference
    if let Some(gv) = parse_game_var(s) {
        return build_game_var_expr(&gv);
    }
    // Range variable reference
    if let Some(rv) = parse_range_var(s) {
        return lua_call(
            "pseudorandom",
            vec![lua_str(s), lua_num(rv.min), lua_num(rv.max)],
        );
    }
    // Try parsing as number
    if let Ok(n) = s.parse::<f64>() {
        if let Some(name) = config_var_name {
            return ability_path_expr(object_type, name);
        }
        if n.fract() == 0.0 {
            return lua_int(n as i64);
        }
        return lua_num(n);
    }
    // Plain string value
    lua_str(s)
}

/// Build the Lua expression for a game variable reference.
fn build_game_var_expr(gv: &GameVarRef) -> Expr {
    let base_code = game_var_lua_code(&gv.var_id)
        .map(lua_raw_expr)
        .unwrap_or_else(|| lua_raw_expr(&gv.var_id));

    let with_start = if gv.starts_from != 0.0 {
        let start = if gv.starts_from.fract() == 0.0 {
            lua_int(gv.starts_from as i64)
        } else {
            lua_num(gv.starts_from)
        };
        lua_add(start, base_code)
    } else {
        base_code
    };

    if gv.multiplier != 1.0 {
        let mult = if gv.multiplier.fract() == 0.0 {
            lua_int(gv.multiplier as i64)
        } else {
            lua_num(gv.multiplier)
        };
        lua_mul(with_start, mult)
    } else {
        with_start
    }
}

/// Build a `card.ability.extra.varName` expression.
pub fn ability_path_expr(object_type: ObjectType, var_name: &str) -> Expr {
    let base = object_type.ability_path();
    lua_field(lua_raw_expr(base), var_name)
}

// ---------------------------------------------------------------------------
// Dynamic config-variable resolution
// ---------------------------------------------------------------------------

/// Result of resolving a parameter value with automatic config-var registration.
pub struct ResolvedValue {
    /// Lua expression to use in the generated code.
    pub expr: Expr,
    /// Lua expression as a raw string (for format! based code generation).
    pub lua_str: String,
}

/// Resolve a value parameter: automatically registering a config variable
/// for literal numeric values. This is the centralized helper that ensures
/// every integer/float in an effect gets stored in `config.extra` and
/// referenced via `card.ability.extra.<var>`: making `loc_vars` work
/// automatically.
///
/// - `effect_params`: the effect's param map
/// - `param_key`: which param to read (e.g. "value", "amount")
/// - `ctx`: compile context for config-var registration
/// - `var_base`: base name for the config variable (e.g. "dollars", "level")
///
/// Returns the resolved expression and its string form.
pub fn resolve_config_value(
    effect_params: &std::collections::HashMap<String, crate::types::ParamValue>,
    param_key: &str,
    ctx: &mut crate::compiler::context::CompileContext,
    var_base: &str,
) -> ResolvedValue {
    use crate::types::ParamValue;

    let count = ctx.next_effect_count(var_base);
    let var_name = ctx.unique_var_name(var_base, count);

    match effect_params.get(param_key) {
        Some(ParamValue::Int(n)) => {
            ctx.add_config_int(&var_name, *n);
            let path = format!("{}.{}", ctx.ability_path(), var_name);
            ResolvedValue {
                expr: ability_path_expr(ctx.object_type, &var_name),
                lua_str: path,
            }
        }
        Some(ParamValue::Float(n)) => {
            ctx.add_config_num(&var_name, *n);
            let path = format!("{}.{}", ctx.ability_path(), var_name);
            ResolvedValue {
                expr: ability_path_expr(ctx.object_type, &var_name),
                lua_str: path,
            }
        }
        Some(ParamValue::Str(s)) => {
            // Try numeric parse first
            if let Ok(n) = s.parse::<f64>() {
                if n.fract() == 0.0 {
                    ctx.add_config_int(&var_name, n as i64);
                } else {
                    ctx.add_config_num(&var_name, n);
                }
                let path = format!("{}.{}", ctx.ability_path(), var_name);
                return ResolvedValue {
                    expr: ability_path_expr(ctx.object_type, &var_name),
                    lua_str: path,
                };
            }
            // User variable reference by name (legacy raw-string encoding)
            if ctx.has_user_var(s) {
                let path = ctx.user_var_path(s);
                return ResolvedValue {
                    expr: ctx.user_var_expr(s),
                    lua_str: path,
                };
            }
            // Game variable reference
            if let Some(gv) = parse_game_var(s) {
                let expr = build_game_var_expr(&gv);
                let code = game_var_lua_code(&gv.var_id)
                    .unwrap_or(&gv.var_id)
                    .to_string();
                return ResolvedValue {
                    expr,
                    lua_str: code,
                };
            }
            // Plain string
            ResolvedValue {
                expr: lua_str(s),
                lua_str: format!("\"{}\"", s),
            }
        }
        Some(ParamValue::Typed(t)) => {
            if is_game_variable_type(&t.value_type) {
                if let Some(s) = t.value.as_str() {
                    if let Some(gv) = parse_game_var(s) {
                        let expr = build_game_var_expr(&gv);
                        let code = game_var_lua_code(&gv.var_id)
                            .unwrap_or(&gv.var_id)
                            .to_string();
                        return ResolvedValue {
                            expr,
                            lua_str: code,
                        };
                    }
                }
                ResolvedValue {
                    expr: lua_int(0),
                    lua_str: "0".to_string(),
                }
            } else if is_range_type(&t.value_type) {
                if let Some(s) = t.value.as_str() {
                    if let Some(rv) = parse_range_var(s) {
                        let expr = lua_call(
                            "pseudorandom",
                            vec![lua_str(s), lua_num(rv.min), lua_num(rv.max)],
                        );
                        let code = format!("pseudorandom(\"{}\", {}, {})", s, rv.min, rv.max);
                        return ResolvedValue {
                            expr,
                            lua_str: code,
                        };
                    }
                }
                ResolvedValue {
                    expr: lua_int(0),
                    lua_str: "0".to_string(),
                }
            } else if is_user_variable_type(&t.value_type) {
                if let Some(name) = t.value.as_str() {
                    let path = ctx.user_var_path(name);
                    return ResolvedValue {
                        expr: ctx.user_var_expr(name),
                        lua_str: path,
                    };
                }
                ResolvedValue {
                    expr: lua_int(0),
                    lua_str: "0".to_string(),
                }
            } else {
                // Try numeric
                if let Some(n) = t.value.as_f64() {
                    if n.fract() == 0.0 {
                        ctx.add_config_int(&var_name, n as i64);
                    } else {
                        ctx.add_config_num(&var_name, n);
                    }
                    let path = format!("{}.{}", ctx.ability_path(), var_name);
                    return ResolvedValue {
                        expr: ability_path_expr(ctx.object_type, &var_name),
                        lua_str: path,
                    };
                }
                if let Some(s) = t.value.as_str() {
                    if let Ok(n) = s.parse::<f64>() {
                        if n.fract() == 0.0 {
                            ctx.add_config_int(&var_name, n as i64);
                        } else {
                            ctx.add_config_num(&var_name, n);
                        }
                        let path = format!("{}.{}", ctx.ability_path(), var_name);
                        return ResolvedValue {
                            expr: ability_path_expr(ctx.object_type, &var_name),
                            lua_str: path,
                        };
                    }
                    if ctx.has_user_var(s) {
                        let path = ctx.user_var_path(s);
                        return ResolvedValue {
                            expr: ctx.user_var_expr(s),
                            lua_str: path,
                        };
                    }
                    // Try game var
                    if let Some(code) = game_var_lua_code(s) {
                        return ResolvedValue {
                            expr: lua_raw_expr(code),
                            lua_str: code.to_string(),
                        };
                    }
                    return ResolvedValue {
                        expr: lua_str(s),
                        lua_str: format!("\"{}\"", s),
                    };
                }
                ResolvedValue {
                    expr: lua_int(1),
                    lua_str: "1".to_string(),
                }
            }
        }
        Some(ParamValue::Bool(b)) => ResolvedValue {
            expr: lua_bool(*b),
            lua_str: if *b { "true" } else { "false" }.to_string(),
        },
        None => ResolvedValue {
            expr: lua_int(1),
            lua_str: "1".to_string(),
        },
    }
}

/// Resolve a numeric condition parameter, automatically registering it in
/// `config.extra` and returning the ability-path expression. Uses the
/// condition type and parameter name to build a unique slug, e.g.
/// `hand_count_value0`. Non-numeric values fall through to a literal.
pub fn resolve_condition_value(
    condition_params: &std::collections::HashMap<String, crate::types::ParamValue>,
    param_key: &str,
    ctx: &mut crate::compiler::context::CompileContext,
    condition_type: &str,
) -> Option<Expr> {
    use crate::types::ParamValue;

    let param = condition_params.get(param_key)?;

    // Build the base name from condition_type + param_key
    let var_base = format!("{}_{}", condition_type, param_key);

    match param {
        ParamValue::Int(n) => {
            let count = ctx.next_effect_count(&var_base);
            let var_name = ctx.unique_var_name(&var_base, count);
            ctx.add_config_int(&var_name, *n);
            Some(ability_path_expr(ctx.object_type, &var_name))
        }
        ParamValue::Float(n) => {
            let count = ctx.next_effect_count(&var_base);
            let var_name = ctx.unique_var_name(&var_base, count);
            ctx.add_config_num(&var_name, *n);
            Some(ability_path_expr(ctx.object_type, &var_name))
        }
        ParamValue::Str(s) => {
            if s.trim().is_empty() {
                return None;
            }
            if let Ok(n) = s.parse::<f64>() {
                let count = ctx.next_effect_count(&var_base);
                let var_name = ctx.unique_var_name(&var_base, count);
                if n.fract() == 0.0 {
                    ctx.add_config_int(&var_name, n as i64);
                } else {
                    ctx.add_config_num(&var_name, n);
                }
                Some(ability_path_expr(ctx.object_type, &var_name))
            } else if ctx.has_user_var(s) {
                Some(ctx.user_var_expr(s))
            } else {
                // Non-numeric string literals must be quoted.
                Some(lua_str(s))
            }
        }
        ParamValue::Typed(t) => {
            if is_game_variable_type(&t.value_type) {
                if let Some(s) = t.value.as_str() {
                    if let Some(gv) = parse_game_var(s) {
                        return Some(build_game_var_expr(&gv));
                    }
                }
                None
            } else if is_user_variable_type(&t.value_type) {
                if let Some(name) = t.value.as_str() {
                    return Some(ctx.user_var_expr(name));
                }
                None
            } else {
                if let Some(n) = t.value.as_i64() {
                    let count = ctx.next_effect_count(&var_base);
                    let var_name = ctx.unique_var_name(&var_base, count);
                    ctx.add_config_int(&var_name, n);
                    return Some(ability_path_expr(ctx.object_type, &var_name));
                }
                if let Some(n) = t.value.as_f64() {
                    let count = ctx.next_effect_count(&var_base);
                    let var_name = ctx.unique_var_name(&var_base, count);
                    ctx.add_config_num(&var_name, n);
                    return Some(ability_path_expr(ctx.object_type, &var_name));
                }
                if let Some(s) = t.value.as_str() {
                    if s.trim().is_empty() {
                        return None;
                    }
                    if ctx.has_user_var(s) {
                        return Some(ctx.user_var_expr(s));
                    }
                    return Some(lua_str(s));
                }
                None
            }
        }
        _ => None,
    }
}

/// Convert a comparison operator string to the corresponding Lua binary op expression.
pub fn comparison_op(operator: &str, lhs: Expr, rhs: Expr) -> Expr {
    match operator {
        "equals" | "equal" | "==" => lua_eq(lhs, rhs),
        "not_equals" | "not_equal" | "~=" => lua_neq(lhs, rhs),
        "greater_than" | ">" => lua_gt(lhs, rhs),
        "less_than" | "<" => lua_lt(lhs, rhs),
        "greater_than_or_equal" | "greater_equals" | ">=" => lua_ge(lhs, rhs),
        "less_than_or_equal" | "less_equals" | "<=" => lua_le(lhs, rhs),
        _ => lua_eq(lhs, rhs),
    }
}
