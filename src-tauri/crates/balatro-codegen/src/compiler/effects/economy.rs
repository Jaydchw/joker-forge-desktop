use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::compiler::values::is_user_variable_type;
use crate::lua_ast::*;
use crate::types::{EffectDef, ParamValue};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn get_str_default(effect: &EffectDef, key: &str, default: &str) -> String {
    match effect.params.get(key) {
        Some(v) => {
            let s = v.to_string_lossy();
            if s.is_empty() {
                default.to_string()
            } else {
                s
            }
        }
        None => default.to_string(),
    }
}

fn get_str(effect: &EffectDef, key: &str) -> Option<String> {
    effect.params.get(key).map(|v| v.to_string_lossy())
}

fn value_to_lua_str(
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
            } else {
                if let Some(n) = t.value.as_f64() {
                    if n.fract() == 0.0 {
                        ctx.add_config_int(&var_name, n as i64);
                    } else {
                        ctx.add_config_num(&var_name, n);
                    }
                    format!("{}.{}", ctx.ability_path(), var_name)
                } else {
                    "1".to_string()
                }
            }
        }
        Some(ParamValue::Str(s)) if ctx.has_user_var(s) => ctx.user_var_path(s),
        _ => "1".to_string(),
    }
}

fn is_scoring_trigger(trigger: &str) -> bool {
    matches!(trigger, "hand_played" | "card_scored")
}

// ---------------------------------------------------------------------------
// edit_reroll_price
// ---------------------------------------------------------------------------

/// Edit Reroll Price: modifies the reroll cost in the shop.
pub fn edit_reroll_price(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let value_str = value_to_lua_str(effect, "value", ctx, "reroll_cost");

    let lua = match operation.as_str() {
        "subtract" => format!(
            "G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    G.GAME.round_resets.reroll_cost = G.GAME.round_resets.reroll_cost - {val}\n\
                    G.GAME.current_round.reroll_cost = math.max(0, G.GAME.current_round.reroll_cost - {val})\n\
                    return true\n\
                end\n\
            }}))",
            val = value_str
        ),
        _ => format!(
            "G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    G.GAME.round_resets.reroll_cost = G.GAME.round_resets.reroll_cost + {val}\n\
                    G.GAME.current_round.reroll_cost = math.max(0, G.GAME.current_round.reroll_cost + {val})\n\
                    return true\n\
                end\n\
            }}))",
            val = value_str
        ),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(lua_str("Reroll Cost Changed")),
        colour: Some(lua_raw_expr("G.C.MONEY")),
    }
}

// ---------------------------------------------------------------------------
// edit_interest_cap
// ---------------------------------------------------------------------------

/// Edit Interest Cap: modifies G.GAME.interest_cap.
pub fn edit_interest_cap(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let value_str = value_to_lua_str(effect, "value", ctx, "interest_cap");

    let inner = match operation.as_str() {
        "subtract" => format!("G.GAME.interest_cap = G.GAME.interest_cap - {}", value_str),
        "set" => format!("G.GAME.interest_cap = {}", value_str),
        "multiply" => format!("G.GAME.interest_cap = G.GAME.interest_cap * {}", value_str),
        "divide" => format!("G.GAME.interest_cap = G.GAME.interest_cap / {}", value_str),
        _ => format!("G.GAME.interest_cap = G.GAME.interest_cap + {}", value_str),
    };

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            func = function()\n\
                {}\n\
                return true\n\
            end\n\
        }}))",
        inner
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(lua_str("Interest Cap Changed")),
        colour: Some(lua_raw_expr("G.C.MONEY")),
    }
}

// ---------------------------------------------------------------------------
// discount_items
// ---------------------------------------------------------------------------

/// Discount Items: modifies G.GAME.discount_percent and refreshes prices.
pub fn discount_items(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let value_str = value_to_lua_str(effect, "value", ctx, "item_prices");

    let refresh = "for _, v in pairs(G.I.CARD) do\n\
                    if v.set_cost then v:set_cost() end\n\
                end\n\
                return true";

    let inner = match operation.as_str() {
        "subtract" => format!(
            "G.GAME.discount_percent = (G.GAME.discount_percent or 0) - {}\n{}",
            value_str, refresh
        ),
        "set" => format!("G.GAME.discount_percent = {}\n{}", value_str, refresh),
        "multiply" => format!(
            "G.GAME.discount_percent = (G.GAME.discount_percent or 0) * {}\n{}",
            value_str, refresh
        ),
        "divide" => format!(
            "G.GAME.discount_percent = (G.GAME.discount_percent or 0) / {}\n{}",
            value_str, refresh
        ),
        _ => format!(
            "G.GAME.discount_percent = (G.GAME.discount_percent or 0) + {}\n{}",
            value_str, refresh
        ),
    };

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            func = function()\n\
                {}\n\
            end\n\
        }}))",
        inner
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(lua_str("Items Discounted")),
        colour: Some(lua_raw_expr("G.C.MONEY")),
    }
}

// ---------------------------------------------------------------------------
// edit_item_weight
// ---------------------------------------------------------------------------

/// Edit Item Weight: modifies spawn rates for item types.
///
/// `item_weight_type` controls whether it modifies `_rate` or `_mod`.
pub fn edit_item_weight(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let key = get_str_default(effect, "key", "");
    let weight_type = get_str_default(effect, "weight_type", "rate");
    let value_str = value_to_lua_str(effect, "value", ctx, "item_rate");

    let item_code = if weight_type == "rarity_weight" {
        format!("G.GAME.{}_mod", key)
    } else {
        format!("G.GAME.{}_rate", key)
    };

    let assign = match operation.as_str() {
        "subtract" => format!("{} = {} - {}", item_code, item_code, value_str),
        "set" => format!("{} = {}", item_code, value_str),
        "multiply" => format!("{} = {} * {}", item_code, item_code, value_str),
        "divide" => format!("{} = {} / {}", item_code, item_code, value_str),
        _ => format!("{} = {} + {}", item_code, item_code, value_str),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(assign)],
        config_vars: vec![],
        message: Some(lua_str("Spawn Rate Changed")),
        colour: Some(lua_raw_expr("G.C.BLUE")),
    }
}

// ---------------------------------------------------------------------------
// edit_winner_ante
// ---------------------------------------------------------------------------

/// Edit Winner Ante: modifies G.GAME.win_ante (the ante needed to win).
pub fn edit_winner_ante(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    trigger: &str,
) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "set");
    let custom_message = get_str(effect, "customMessage");
    let value_str = value_to_lua_str(effect, "value", ctx, "winner_ante_value");
    let scoring = is_scoring_trigger(trigger);

    let (ante_code, default_msg) = match operation.as_str() {
        "add" => (
            format!(
                "G.E_MANAGER:add_event(Event({{\n\
                    func = function()\n\
                        local ante = G.GAME.win_ante + {val}\n\
                        local int_part, frac_part = math.modf(ante)\n\
                        local rounded = int_part + (frac_part >= 0.5 and 1 or 0)\n\
                        G.GAME.win_ante = rounded\n\
                        return true\n\
                    end\n\
                }}))",
                val = value_str
            ),
            format!("\"Winner Ante +\"..tostring({})", value_str),
        ),
        "subtract" => (
            format!(
                "G.E_MANAGER:add_event(Event({{\n\
                    trigger = 'after',\n\
                    delay = 0.4,\n\
                    func = function()\n\
                        local ante = G.GAME.win_ante - {val}\n\
                        local int_part, frac_part = math.modf(ante)\n\
                        local rounded = int_part + (frac_part >= 0.5 and 1 or 0)\n\
                        G.GAME.win_ante = rounded\n\
                        return true\n\
                    end\n\
                }}))",
                val = value_str
            ),
            format!("\"Winner Ante -\"..tostring({})", value_str),
        ),
        _ => (
            format!(
                "G.E_MANAGER:add_event(Event({{\n\
                    func = function()\n\
                        G.GAME.win_ante = {val}\n\
                        return true\n\
                    end\n\
                }}))",
                val = value_str
            ),
            format!("\"Winner Ante set to \"..tostring({})..'!'", value_str),
        ),
    };

    let message_expr = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_raw_expr(default_msg));

    if scoring {
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![lua_raw_stmt(ante_code)],
            config_vars: vec![],
            message: Some(message_expr),
            colour: Some(lua_raw_expr("G.C.FILTER")),
        }
    } else {
        let func_body = vec![lua_raw_stmt(format!("{}\nreturn true", ante_code))];
        EffectOutput {
            return_fields: vec![(
                "func".to_string(),
                Expr::Function {
                    params: vec![],
                    body: func_body,
                },
            )],
            pre_return: vec![],
            config_vars: vec![],
            message: Some(message_expr),
            colour: Some(lua_raw_expr("G.C.FILTER")),
        }
    }
}

// ---------------------------------------------------------------------------
// edit_end_round_hand_money
// ---------------------------------------------------------------------------

/// Edit End Round Hand Money: modifies G.GAME.modifiers.money_per_hand.
pub fn edit_end_round_hand_money(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let value_str = value_to_lua_str(effect, "value", ctx, "hand_money");

    let code = match operation.as_str() {
        "subtract" => format!(
            "G.GAME.modifiers.money_per_hand = (G.GAME.modifiers.money_per_hand or 1) - {}",
            value_str
        ),
        "set" => format!("G.GAME.modifiers.money_per_hand = {}", value_str),
        _ => format!(
            "G.GAME.modifiers.money_per_hand = (G.GAME.modifiers.money_per_hand or 1) + {}",
            value_str
        ),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: Some(lua_str("End-Round Money Changed")),
        colour: Some(lua_raw_expr("G.C.MONEY")),
    }
}

// ---------------------------------------------------------------------------
// edit_end_round_discard_money
// ---------------------------------------------------------------------------

/// Edit End Round Discard Money: modifies G.GAME.modifiers.money_per_discard.
pub fn edit_end_round_discard_money(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "set");
    let value_str = value_to_lua_str(effect, "value", ctx, "discard_money");

    let code = match operation.as_str() {
        "subtract" => format!(
            "G.GAME.modifiers.money_per_discard = (G.GAME.modifiers.money_per_discard or 0) - {}",
            value_str
        ),
        "add" => format!(
            "G.GAME.modifiers.money_per_discard = (G.GAME.modifiers.money_per_discard or 0) + {}",
            value_str
        ),
        _ => format!("G.GAME.modifiers.money_per_discard = {}", value_str),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: Some(lua_str("Discard Money Changed")),
        colour: Some(lua_raw_expr("G.C.MONEY")),
    }
}
