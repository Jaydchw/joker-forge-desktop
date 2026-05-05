use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::compiler::values::is_user_variable_type;
use crate::lua_ast::*;
use crate::types::{EffectDef, ParamValue};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn get_str(effect: &EffectDef, key: &str) -> Option<String> {
    effect.params.get(key).map(|v| v.to_string_lossy())
}

fn get_str_default<'a>(effect: &'a EffectDef, key: &str, default: &'a str) -> String {
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

/// Get the string value out of a TypedValue param (the `.value` field).
fn get_typed_str(effect: &EffectDef, key: &str) -> String {
    match effect.params.get(key) {
        Some(ParamValue::Typed(t)) => t.value.as_str().unwrap_or("none").to_string(),
        Some(v) => v.to_string_lossy(),
        None => "none".to_string(),
    }
}

/// Get the valueType of a TypedValue param.
fn get_typed_value_type(effect: &EffectDef, key: &str) -> String {
    match effect.params.get(key) {
        Some(ParamValue::Typed(t)) => t.value_type.clone(),
        _ => "specific".to_string(),
    }
}

fn is_scoring_trigger(trigger: &str) -> bool {
    matches!(trigger, "hand_played" | "card_scored")
}

/// Convert a rank name to its SMODS rank ID.
fn rank_to_id(rank: &str) -> &str {
    match rank {
        "Ace" => "A",
        "King" => "K",
        "Queen" => "Q",
        "Jack" => "J",
        other => other,
    }
}

/// Resolve the Lua expression for a value parameter as a string: registering
/// a config var if needed.
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
                // Try as number literal
                if let Some(n) = t.value.as_f64() {
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
                        // Game variable or other string
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
        }
        Some(ParamValue::Str(s)) if ctx.has_user_var(s) => ctx.user_var_path(s),
        _ => "1".to_string(),
    }
}

// ---------------------------------------------------------------------------
// edit_card
// ---------------------------------------------------------------------------

/// Build the card modification Lua code (rank, suit, enhancement, seal: edition).
///
/// `target` is the Lua expression for the card to modify (e.g. `"card"` or
/// `"context.other_card"`).
/// `ability_path` is for user_var lookups (e.g. `"card.ability.extra"`).
fn build_card_modification_code(effect: &EffectDef, target: &str, ability_path: &str) -> String {
    let new_rank_val = get_typed_str(effect, "new_rank");
    let new_rank_type = get_typed_value_type(effect, "new_rank");
    let new_suit_val = get_typed_str(effect, "new_suit");
    let new_suit_type = get_typed_value_type(effect, "new_suit");
    let new_enhancement_val = get_typed_str(effect, "new_enhancement");
    let new_enhancement_type = get_typed_value_type(effect, "new_enhancement");
    let new_seal_val = get_typed_str(effect, "new_seal");
    let new_seal_type = get_typed_value_type(effect, "new_seal");
    let new_edition_val = get_typed_str(effect, "new_edition");
    let new_edition_type = get_typed_value_type(effect, "new_edition");

    let mut code = String::new();

    // Rank / suit change
    if new_rank_val != "none" || new_suit_val != "none" {
        let suit_param = if new_suit_type == "user_var" {
            format!("G.GAME.current_round.{}_card.suit", new_suit_val)
        } else if new_suit_val == "random" {
            "pseudorandom_element(SMODS.Suits, 'edit_card_suit').key".to_string()
        } else if new_suit_val != "none" {
            format!("\"{}\"", new_suit_val)
        } else {
            "nil".to_string()
        };

        let rank_param = if new_rank_type == "user_var" {
            format!("G.GAME.current_round.{}_card.rank", new_rank_val)
        } else if new_rank_val == "random" {
            "pseudorandom_element(SMODS.Ranks, 'edit_card_rank').key".to_string()
        } else if new_rank_val != "none" {
            format!("\"{}\"", rank_to_id(&new_rank_val))
        } else {
            "nil".to_string()
        };

        code.push_str(&format!(
            "\n        assert(SMODS.change_base({}, {}, {}))",
            target, suit_param, rank_param
        ));
    }

    // Enhancement
    if new_enhancement_val == "remove" {
        code.push_str(&format!(
            "\n        {}:set_ability(G.P_CENTERS.c_base)",
            target
        ));
    } else if new_enhancement_val == "random" {
        code.push_str(&format!(
            "\n        local enhancement_pool = {{}}\
            \n        for _, enhancement in pairs(G.P_CENTER_POOLS.Enhanced) do\
            \n            if enhancement.key ~= 'm_stone' then\
            \n                enhancement_pool[#enhancement_pool + 1] = enhancement\
            \n            end\
            \n        end\
            \n        local random_enhancement = pseudorandom_element(enhancement_pool, 'edit_card_enhancement')\
            \n        {}:set_ability(random_enhancement)",
            target
        ));
    } else if new_enhancement_type == "user_var" && new_enhancement_val != "none" {
        code.push_str(&format!(
            "\n        {}:set_ability(G.P_CENTERS[{}.{}])",
            target, ability_path, new_enhancement_val
        ));
    } else if new_enhancement_val != "none" {
        code.push_str(&format!(
            "\n        {}:set_ability(G.P_CENTERS.{})",
            target, new_enhancement_val
        ));
    }

    // Seal
    if new_seal_val == "remove" {
        code.push_str(&format!("\n        {}:set_seal(nil)", target));
    } else if new_seal_val == "random" {
        code.push_str(&format!(
            "\n        local random_seal = SMODS.poll_seal({{mod = 10, guaranteed = true}})\
            \n        if random_seal then\
            \n            {}:set_seal(random_seal, true)\
            \n        end",
            target
        ));
    } else if new_seal_type == "user_var" && new_seal_val != "none" {
        code.push_str(&format!(
            "\n        {}:set_seal({}.{}, true)",
            target, ability_path, new_seal_val
        ));
    } else if new_seal_val != "none" {
        code.push_str(&format!(
            "\n        {}:set_seal(\"{}\", true)",
            target, new_seal_val
        ));
    }

    // Edition
    if new_edition_val == "remove" {
        code.push_str(&format!("\n        {}:set_edition(nil)", target));
    } else if new_edition_val == "random" {
        code.push_str(&format!(
            "\n        local random_edition = poll_edition('edit_card_edition', nil, true, true)\
            \n        if random_edition then\
            \n            {}:set_edition(random_edition, true)\
            \n        end",
            target
        ));
    } else if new_edition_type == "user_var" && new_edition_val != "none" {
        code.push_str(&format!(
            "\n        {}:set_edition({}.{}, true)",
            target, ability_path, new_edition_val
        ));
    } else if new_edition_val != "none" {
        let key = if new_edition_val.starts_with("e_") {
            new_edition_val.clone()
        } else {
            format!("e_{}", new_edition_val)
        };
        code.push_str(&format!(
            "\n        {}:set_edition(\"{}\", true)",
            target, key
        ));
    }

    code
}

/// Edit Card effect: modifies a card's rank, suit, enhancement, seal, and/or edition.
///
/// For joker context with `card_scored` trigger: wraps in an event manager call.
/// For other joker triggers: returns `func = function() ... end` in the return table.
/// For card context: applies modifications directly (pre_return for card_scored).
pub fn edit_card(effect: &EffectDef, ctx: &mut CompileContext, trigger: &str) -> EffectOutput {
    let custom_message =
        get_str(effect, "customMessage").unwrap_or_else(|| "Card Modified!".to_string());
    let ability_path = ctx.ability_path().to_string();
    let scoring = is_scoring_trigger(trigger);

    // For joker context
    let target = "context.other_card";

    let mod_code = build_card_modification_code(effect, target, &ability_path);

    if scoring {
        // Wrap in event manager with pre_return
        let stmt = lua_raw_stmt(format!(
            "local scored_card = context.other_card\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function(){}\n\
                    card_eval_status_text(scored_card, 'extra', nil, nil, nil, {{message = \"{}\", colour = G.C.ORANGE}})\n\
                    return true\n\
                end\n\
            }}))",
            mod_code, custom_message
        ));
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![stmt],
            config_vars: vec![],
            message: None,
            colour: Some(lua_raw_expr("G.C.BLUE")),
        }
    } else {
        // func = function() ... end in return table
        let func_body = vec![lua_raw_stmt(format!(
            "{}\n            return true",
            mod_code
        ))];
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
            message: Some(lua_str(custom_message)),
            colour: Some(lua_raw_expr("G.C.BLUE")),
        }
    }
}

// ---------------------------------------------------------------------------
// convert_all_cards_to_rank  (consumable context)
// ---------------------------------------------------------------------------

pub fn convert_all_cards_to_rank(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let rank_val = get_typed_str(effect, "rank");
    let custom_message = get_str(effect, "customMessage");
    let rank_pool_active: Vec<bool> = match effect.params.get("rank_pool") {
        Some(ParamValue::Typed(t)) => t
            .value
            .as_array()
            .map(|arr| arr.iter().map(|v| v.as_bool().unwrap_or(false)).collect())
            .unwrap_or_default(),
        _ => vec![],
    };
    let rank_pool_values = [
        "'A'", "'2'", "'3'", "'4'", "'5'", "'6'", "'7'", "'8'", "'9'", "'10'", "'J'", "'Q'", "'K'",
    ];

    let rank_code = if rank_val == "random" {
        "local _rank = pseudorandom_element(SMODS.Ranks, 'convert_all_rank').key".to_string()
    } else if rank_val == "pool" {
        let pool: Vec<&str> = rank_pool_active
            .iter()
            .enumerate()
            .filter(|(_, &active)| active)
            .filter_map(|(i, _)| rank_pool_values.get(i).copied())
            .collect();
        format!(
            "local rank_pool = {{{}}}\n            local _rank = pseudorandom_element(rank_pool, 'convert_all_rank')",
            pool.join(", ")
        )
    } else {
        format!("local _rank = '{}'", rank_to_id(&rank_val))
    };

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                play_sound('tarot1')\n\
                used_card:juice_up(0.3, 0.5)\n\
                return true\n\
            end\n\
        }}))\n\
        for i = 1, #G.hand.cards do\n\
            local percent = 1.15 - (i - 0.999) / (#G.hand.cards - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.cards[i]:flip()\n\
                    play_sound('card1', percent)\n\
                    G.hand.cards[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        {}\n\
        for i = 1, #G.hand.cards do\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    local _card = G.hand.cards[i]\n\
                    assert(SMODS.change_base(_card, nil, _rank))\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        for i = 1, #G.hand.cards do\n\
            local percent = 0.85 + (i - 0.999) / (#G.hand.cards - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.cards[i]:flip()\n\
                    play_sound('tarot2', percent, 0.6)\n\
                    G.hand.cards[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        delay(0.5)",
        rank_code
    );

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Rank Changed!"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Tarot")),
    }
}

// ---------------------------------------------------------------------------
// convert_all_cards_to_suit  (consumable context)
// ---------------------------------------------------------------------------

pub fn convert_all_cards_to_suit(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let suit_val = get_typed_str(effect, "suit");
    let custom_message = get_str(effect, "customMessage");
    let suit_pool_active: Vec<bool> = match effect.params.get("suit_pool") {
        Some(ParamValue::Typed(t)) => t
            .value
            .as_array()
            .map(|arr| arr.iter().map(|v| v.as_bool().unwrap_or(false)).collect())
            .unwrap_or_default(),
        _ => vec![],
    };
    let suit_pool_values = ["'Spades'", "'Hearts'", "'Diamonds'", "'Clubs'"];

    let suit_code = if suit_val == "random" {
        "local _suit = pseudorandom_element(SMODS.Suits, 'convert_all_suit').key".to_string()
    } else if suit_val == "pool" {
        let pool: Vec<&str> = suit_pool_active
            .iter()
            .enumerate()
            .filter(|(_, &active)| active)
            .filter_map(|(i, _)| suit_pool_values.get(i).copied())
            .collect();
        format!(
            "local suit_pool = {{{}}}\n            local _suit = pseudorandom_element(suit_pool, 'convert_all_suit')",
            pool.join(", ")
        )
    } else {
        format!("local _suit = '{}'", suit_val)
    };

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                play_sound('tarot1')\n\
                used_card:juice_up(0.3, 0.5)\n\
                return true\n\
            end\n\
        }}))\n\
        for i = 1, #G.hand.cards do\n\
            local percent = 1.15 - (i - 0.999) / (#G.hand.cards - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.cards[i]:flip()\n\
                    play_sound('card1', percent)\n\
                    G.hand.cards[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        {}\n\
        for i = 1, #G.hand.cards do\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    local _card = G.hand.cards[i]\n\
                    assert(SMODS.change_base(_card, _suit, nil))\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        for i = 1, #G.hand.cards do\n\
            local percent = 0.85 + (i - 0.999) / (#G.hand.cards - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.cards[i]:flip()\n\
                    play_sound('tarot2', percent, 0.6)\n\
                    G.hand.cards[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        delay(0.5)",
        suit_code
    );

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Suit Changed!"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Tarot")),
    }
}

// ---------------------------------------------------------------------------
// increment_rank  (consumable context)
// ---------------------------------------------------------------------------

pub fn increment_rank(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "increment");
    let custom_message = get_str(effect, "customMessage");
    let value_str = value_to_lua_str(effect, "value", ctx, "rank_change");

    let actual_value = if operation == "decrement" {
        format!("-{}", value_str)
    } else {
        value_str
    };

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                play_sound('tarot1')\n\
                used_card:juice_up(0.3, 0.5)\n\
                return true\n\
            end\n\
        }}))\n\
        for i = 1, #G.hand.highlighted do\n\
            local percent = 1.15 - (i - 0.999) / (#G.hand.highlighted - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.highlighted[i]:flip()\n\
                    play_sound('card1', percent)\n\
                    G.hand.highlighted[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        delay(0.2)\n\
        for i = 1, #G.hand.highlighted do\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.1,\n\
                func = function()\n\
                    assert(SMODS.modify_rank(G.hand.highlighted[i], {}))\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        for i = 1, #G.hand.highlighted do\n\
            local percent = 0.85 + (i - 0.999) / (#G.hand.highlighted - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.highlighted[i]:flip()\n\
                    play_sound('tarot2', percent, 0.6)\n\
                    G.hand.highlighted[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }}))\n\
        end\n\
        G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.2,\n\
            func = function()\n\
                G.hand:unhighlight_all()\n\
                return true\n\
            end\n\
        }}))\n\
        delay(0.5)",
        actual_value
    );

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Rank Incremented!"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Tarot")),
    }
}

// ---------------------------------------------------------------------------
// convert_left_to_right  (consumable context)
// ---------------------------------------------------------------------------

pub fn convert_left_to_right(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let custom_message = get_str(effect, "customMessage");

    let lua = "G.E_MANAGER:add_event(Event({\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                play_sound('tarot1')\n\
                used_card:juice_up(0.3, 0.5)\n\
                return true\n\
            end\n\
        }))\n\
        for i = 1, #G.hand.highlighted do\n\
            local percent = 1.15 - (i - 0.999) / (#G.hand.highlighted - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.highlighted[i]:flip()\n\
                    play_sound('card1', percent)\n\
                    G.hand.highlighted[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }))\n\
        end\n\
        delay(0.2)\n\
        local rightmost = G.hand.highlighted[1]\n\
        for i = 1, #G.hand.highlighted do\n\
            if G.hand.highlighted[i].T.x > rightmost.T.x then\n\
                rightmost = G.hand.highlighted[i]\n\
            end\n\
        end\n\
        for i = 1, #G.hand.highlighted do\n\
            G.E_MANAGER:add_event(Event({\n\
                trigger = 'after',\n\
                delay = 0.1,\n\
                func = function()\n\
                    if G.hand.highlighted[i] ~= rightmost then\n\
                        copy_card(rightmost, G.hand.highlighted[i])\n\
                    end\n\
                    return true\n\
                end\n\
            }))\n\
        end\n\
        for i = 1, #G.hand.highlighted do\n\
            local percent = 0.85 + (i - 0.999) / (#G.hand.highlighted - 0.998) * 0.3\n\
            G.E_MANAGER:add_event(Event({\n\
                trigger = 'after',\n\
                delay = 0.15,\n\
                func = function()\n\
                    G.hand.highlighted[i]:flip()\n\
                    play_sound('tarot2', percent, 0.6)\n\
                    G.hand.highlighted[i]:juice_up(0.3, 0.3)\n\
                    return true\n\
                end\n\
            }))\n\
        end\n\
        G.E_MANAGER:add_event(Event({\n\
            trigger = 'after',\n\
            delay = 0.2,\n\
            func = function()\n\
                G.hand:unhighlight_all()\n\
                return true\n\
            end\n\
        }))\n\
        delay(0.5)";

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Converted!"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Tarot")),
    }
}

