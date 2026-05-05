use crate::compiler::context::CompileContext;
use crate::compiler::effects::{passive::PassiveEffectOutput, EffectOutput};
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
            if s.is_empty() { default.to_string() } else { s }
        }
        None => default.to_string(),
    }
}

fn get_str(effect: &EffectDef, key: &str) -> Option<String> {
    effect.params.get(key).map(|v| v.to_string_lossy())
}

/// Resolve a value param to a Lua expression string: registering a config var
/// for literal numbers.
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
                } else if let Some(s) = t.value.as_str() {
                    if let Ok(n) = s.parse::<f64>() {
                        if n.fract() == 0.0 {
                            ctx.add_config_int(&var_name, n as i64);
                        } else {
                            ctx.add_config_num(&var_name, n);
                        }
                        format!("{}.{}", ctx.ability_path(), var_name)
                    } else {
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
// edit_joker_slots  (modifies G.jokers.config.card_limit)
// ---------------------------------------------------------------------------

/// Edit Joker Slots effect: changes the joker card limit.
///
/// For joker context: returns `func = function() ... end` in the return table.
pub fn edit_joker_slots(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let custom_message = get_str(effect, "customMessage");
    let value_str = value_to_lua_str(effect, "value", ctx, "joker_slots");

    let (slots_code, colour_str, _default_msg) = match operation.as_str() {
        "subtract" => (
            format!("G.jokers.config.card_limit = math.max(1, G.jokers.config.card_limit - {})", value_str),
            "G.C.RED",
            format!("\"-\"..tostring({})..\"+\" Joker Slot\"\"", value_str),
        ),
        "set" => (
            format!("G.jokers.config.card_limit = {}", value_str),
            "G.C.BLUE",
            format!("\"Joker Slots set to \"..tostring({})", value_str),
        ),
        _ => (
            format!("G.jokers.config.card_limit = G.jokers.config.card_limit + {}", value_str),
            "G.C.DARK_EDITION",
            format!("\"+\"..tostring({})..\"+\" Joker Slot\"\"", value_str),
        ),
    };

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or_else(|| match operation.as_str() {
            "subtract" => format!("\"-\"..tostring({})..' Joker Slot'", value_str),
            "set" => format!("\"Joker Slots set to \"..tostring({})", value_str),
            _ => format!("\"+\"..tostring({})..' Joker Slot'", value_str),
        });

    let func_body = vec![
        lua_raw_stmt(format!(
            "card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {{message = {}, colour = {}}})\n\
            {}\n\
            return true",
            msg_lua, colour_str, slots_code
        )),
    ];

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
        message: None,
        colour: Some(lua_raw_expr("G.C.DARK_EDITION")),
    }
}

/// Edit Joker Slots passive: changes card_limit when joker is added/removed from deck.
pub fn edit_joker_slots_passive(effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    // We use the same value resolution but need raw strings for add/remove
    let count = ctx.next_effect_count("joker_slots");
    let var_name = ctx.unique_var_name("joker_slots", count);

    let value_str = match effect.params.get("value") {
        Some(ParamValue::Int(n)) => {
            ctx.add_config_int(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        Some(ParamValue::Float(n)) => {
            ctx.add_config_num(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        _ => "1".to_string(),
    };

    let (add_to_deck, remove_from_deck) = match operation.as_str() {
        "subtract" => (
            format!("G.jokers.config.card_limit = math.max(1, G.jokers.config.card_limit - {})", value_str),
            format!("G.jokers.config.card_limit = G.jokers.config.card_limit + {}", value_str),
        ),
        "set" => (
            format!(
                "card.ability.extra.original_joker_slots = G.jokers.config.card_limit\n\
                G.jokers.config.card_limit = {}",
                value_str
            ),
            "if card.ability.extra.original_joker_slots then\n\
                G.jokers.config.card_limit = card.ability.extra.original_joker_slots\n\
            end"
                .to_string(),
        ),
        _ => (
            format!("G.jokers.config.card_limit = G.jokers.config.card_limit + {}", value_str),
            format!("G.jokers.config.card_limit = G.jokers.config.card_limit - {}", value_str),
        ),
    };

    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(add_to_deck)],
        remove_from_deck: vec![lua_raw_stmt(remove_from_deck)],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// edit_joker_size  (modifies G.jokers.config.highlighted_limit)
// ---------------------------------------------------------------------------

/// Edit Joker Size effect: changes how many jokers can be highlighted at once.
pub fn edit_joker_size(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let custom_message = get_str(effect, "customMessage");
    let value_str = value_to_lua_str(effect, "value", ctx, "joker_size");

    let (size_code, colour_str) = match operation.as_str() {
        "subtract" => (
            format!("G.jokers.config.highlighted_limit = math.max(1, G.jokers.config.highlighted_limit - {})", value_str),
            "G.C.RED",
        ),
        "set" => (
            format!("G.jokers.config.highlighted_limit = {}", value_str),
            "G.C.BLUE",
        ),
        _ => (
            format!("G.jokers.config.highlighted_limit = G.jokers.config.highlighted_limit + {}", value_str),
            "G.C.DARK_EDITION",
        ),
    };

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or_else(|| match operation.as_str() {
            "subtract" => format!("\"-\"..tostring({})..' Joker Size'", value_str),
            "set" => format!("\"Joker Sizes set to \"..tostring({})", value_str),
            _ => format!("\"+\"..tostring({})..' Joker Size'", value_str),
        });

    let func_body = vec![
        lua_raw_stmt(format!(
            "card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {{message = {}, colour = {}}})\n\
            {}\n\
            return true",
            msg_lua, colour_str, size_code
        )),
    ];

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
        message: None,
        colour: Some(lua_raw_expr("G.C.DARK_EDITION")),
    }
}

/// Edit Joker Size passive: changes highlighted_limit when joker is added/removed.
pub fn edit_joker_size_passive(effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let count = ctx.next_effect_count("joker_size");
    let var_name = ctx.unique_var_name("joker_size", count);

    let value_str = match effect.params.get("value") {
        Some(ParamValue::Int(n)) => {
            ctx.add_config_int(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        Some(ParamValue::Float(n)) => {
            ctx.add_config_num(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        _ => "1".to_string(),
    };

    let (add_to_deck, remove_from_deck) = match operation.as_str() {
        "subtract" => (
            format!("G.jokers.config.highlighted_limit = math.max(1, G.jokers.config.highlighted_limit - {})", value_str),
            format!("G.jokers.config.highlighted_limit = G.jokers.config.highlighted_limit + {}", value_str),
        ),
        "set" => (
            format!(
                "card.ability.extra.original_joker_size = G.jokers.config.highlighted_limit\n\
                G.jokers.config.highlighted_limit = {}",
                value_str
            ),
            "if card.ability.extra.original_joker_size then\n\
                G.jokers.config.highlighted_limit = card.ability.extra.original_joker_size\n\
            end"
                .to_string(),
        ),
        _ => (
            format!("G.jokers.config.highlighted_limit = G.jokers.config.highlighted_limit + {}", value_str),
            format!("G.jokers.config.highlighted_limit = G.jokers.config.highlighted_limit - {}", value_str),
        ),
    };

    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(add_to_deck)],
        remove_from_deck: vec![lua_raw_stmt(remove_from_deck)],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// edit_consumable_slots  (modifies G.consumeables.config.card_limit)
// ---------------------------------------------------------------------------

/// Edit Consumable Slots effect: changes the consumable card limit.
pub fn edit_consumable_slots(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let custom_message = get_str(effect, "customMessage");
    let value_str = value_to_lua_str(effect, "value", ctx, "consumable_slots");

    let (slots_code, colour_str) = match operation.as_str() {
        "subtract" => (
            format!("G.consumeables.config.card_limit = math.max(0, G.consumeables.config.card_limit - {})", value_str),
            "G.C.RED",
        ),
        "set" => (
            format!("G.consumeables.config.card_limit = {}", value_str),
            "G.C.BLUE",
        ),
        _ => (
            format!("G.consumeables.config.card_limit = G.consumeables.config.card_limit + {}", value_str),
            "G.C.GREEN",
        ),
    };

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or_else(|| match operation.as_str() {
            "subtract" => format!("\"-\"..tostring({})..' Consumable Slot'", value_str),
            "set" => format!("\"Set to \"..tostring({})..' Consumable Slots'", value_str),
            _ => format!("\"+\"..tostring({})..' Consumable Slot'", value_str),
        });

    let inner_event = format!(
        "G.E_MANAGER:add_event(Event({{func = function()\n\
            {}\n\
            return true\n\
        end }}))",
        slots_code
    );

    let func_body = vec![
        lua_raw_stmt(format!(
            "{}\n\
            card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {{message = {}, colour = {}}})\n\
            return true",
            inner_event, msg_lua, colour_str
        )),
    ];

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
        message: None,
        colour: Some(lua_raw_expr("G.C.GREEN")),
    }
}

/// Edit Consumable Slots passive: changes consumable card_limit when joker added/removed.
pub fn edit_consumable_slots_passive(
    effect: &EffectDef,
    ctx: &mut CompileContext,
) -> PassiveEffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let count = ctx.next_effect_count("consumable_slots");
    let var_name = ctx.unique_var_name("consumable_slots", count);

    let value_str = match effect.params.get("value") {
        Some(ParamValue::Int(n)) => {
            ctx.add_config_int(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        Some(ParamValue::Float(n)) => {
            ctx.add_config_num(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        _ => "1".to_string(),
    };

    let make_event = |code: &str| -> String {
        format!(
            "G.E_MANAGER:add_event(Event({{func = function()\n\
                {}\n\
                return true\n\
            end }}))",
            code
        )
    };

    let (add_to_deck, remove_from_deck) = match operation.as_str() {
        "subtract" => (
            make_event(&format!(
                "G.consumeables.config.card_limit = math.max(0, G.consumeables.config.card_limit - {})",
                value_str
            )),
            make_event(&format!(
                "G.consumeables.config.card_limit = G.consumeables.config.card_limit + {}",
                value_str
            )),
        ),
        "set" => (
            format!(
                "original_slots = G.consumeables.config.card_limit\n{}",
                make_event(&format!(
                    "G.consumeables.config.card_limit = {}",
                    value_str
                ))
            ),
            format!(
                "if original_slots then\n    {}\nend",
                make_event("G.consumeables.config.card_limit = original_slots")
            ),
        ),
        _ => (
            make_event(&format!(
                "G.consumeables.config.card_limit = G.consumeables.config.card_limit + {}",
                value_str
            )),
            make_event(&format!(
                "G.consumeables.config.card_limit = G.consumeables.config.card_limit - {}",
                value_str
            )),
        ),
    };

    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(add_to_deck)],
        remove_from_deck: vec![lua_raw_stmt(remove_from_deck)],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// edit_item_size  (hand size, play limit, discard limit, voucher/shop slots)
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct ItemSizeData {
    slots_code: &'static str,
    difference_check: &'static str,
    var_name: &'static str,
    custom_message: &'static str,
}

fn item_size_data(item_type: &str) -> ItemSizeData {
    match item_type {
        "voucher_slots" => ItemSizeData {
            slots_code: "SMODS.change_voucher_limit",
            difference_check: "G.GAME.modifiers.extra_vouchers",
            var_name: "voucher_slots",
            custom_message: "Voucher Slots",
        },
        "booster_slots" => ItemSizeData {
            slots_code: "SMODS.change_booster_limit",
            difference_check: "G.GAME.modifiers.extra_boosters",
            var_name: "booster_slots",
            custom_message: "Booster Slots",
        },
        "shop_slots" => ItemSizeData {
            slots_code: "change_shop_size",
            difference_check: "G.GAME.modifiers.shop_size",
            var_name: "shop_slots",
            custom_message: "Shop Slots",
        },
        "play_size" => ItemSizeData {
            slots_code: "SMODS.change_play_limit",
            difference_check: "G.GAME.starting_params.play_limit",
            var_name: "play_size",
            custom_message: "Play Size",
        },
        "discard_size" => ItemSizeData {
            slots_code: "SMODS.change_discard_limit",
            difference_check: "G.GAME.starting_params.discard_limit",
            var_name: "discard_size",
            custom_message: "Discard Size",
        },
        _ => ItemSizeData {
            // hand_size (default)
            slots_code: "G.hand:change_size",
            difference_check: "G.hand.config.card_limit",
            var_name: "hand_size",
            custom_message: "Hand Limit",
        },
    }
}

/// Edit Item Size effect: changes hand size, play/discard limits, or shop/voucher slots.
///
/// The `item_size_type` param on the effect specifies which stat to modify:
/// `"hand_size"` | `"play_size"` | `"discard_size"` | `"voucher_slots"` |
/// `"booster_slots"` | `"shop_slots"`.
pub fn edit_item_size(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let size_type = get_str_default(effect, "item_size_type", "hand_size");
    edit_item_size_typed(effect, ctx, &size_type)
}

/// Explicit-type variant: size type is provided directly (e.g. derived from the
/// effect ID `edit_hand_size` → `"hand_size"`) rather than read from params.
pub fn edit_item_size_typed(effect: &EffectDef, ctx: &mut CompileContext, size_type: &str) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let custom_message = get_str(effect, "customMessage");
    let data = item_size_data(size_type);
    let value_str = value_to_lua_str(effect, "value", ctx, data.var_name);

    let (value_arg, set_code) = match operation.as_str() {
        "subtract" => (format!("-{}", value_str), String::new()),
        "set" => {
            let set = format!(
                "local current_{name} = ({check} or 0)\n\
                local target_{name} = {val}\n\
                local difference = target_{name} - current_{name}",
                name = data.var_name,
                check = data.difference_check,
                val = value_str,
            );
            ("difference".to_string(), set)
        }
        _ => (value_str.clone(), String::new()),
    };

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or_else(|| match operation.as_str() {
            "set" => format!("\"{}  set to \"..tostring({})", data.custom_message, value_str),
            "add" => format!("\"+\"..tostring({})..' {}'", value_str, data.custom_message),
            "subtract" => format!("\"-\"..tostring({})..' {}'", value_str, data.custom_message),
            _ => format!("\"+\"..tostring({})..' {}'", value_str, data.custom_message),
        });

    let func_body = vec![lua_raw_stmt(format!(
        "card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {{message = {}, colour = G.C.BLUE}})\n\
        {}\n\
        {}({})\n\
        return true",
        msg_lua, set_code, data.slots_code, value_arg
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
        message: None,
        colour: Some(lua_raw_expr("G.C.BLUE")),
    }
}

/// Edit Item Size passive: modifies item sizes when joker is added/removed.
///
/// Reads `item_size_type` from effect params; use `edit_item_size_passive_typed` when
/// the type is known from the effect ID.
pub fn edit_item_size_passive(effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let size_type = get_str_default(effect, "item_size_type", "hand_size");
    edit_item_size_passive_typed(effect, ctx, &size_type)
}

/// Explicit-type variant for edit_item_size_passive.
pub fn edit_item_size_passive_typed(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    size_type: &str,
) -> PassiveEffectOutput {
    let operation = get_str_default(effect, "operation", "add");
    let data = item_size_data(size_type);

    let count = ctx.next_effect_count(data.var_name);
    let var_name = ctx.unique_var_name(&format!("{}_increase", data.var_name), count);

    let value_str = match effect.params.get("value") {
        Some(ParamValue::Int(n)) => {
            ctx.add_config_int(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        Some(ParamValue::Float(n)) => {
            ctx.add_config_num(&var_name, *n);
            format!("{}.{}", ctx.ability_path(), var_name)
        }
        _ => "1".to_string(),
    };

    let (add_to_deck, remove_from_deck) = match operation.as_str() {
        "subtract" => (
            format!("{}(-{})", data.slots_code, value_str),
            format!("{}({})", data.slots_code, value_str),
        ),
        "set" => (
            format!(
                "card.ability.extra.original_{name} = {check} or 0\n\
                local difference = {val} - {check}\n\
                {code}(difference)",
                name = data.var_name,
                check = data.difference_check,
                val = value_str,
                code = data.slots_code,
            ),
            format!(
                "if card.ability.extra.original_{name} then\n\
                    local difference = card.ability.extra.original_{name} - {check}\n\
                    {code}(difference)\n\
                end",
                name = data.var_name,
                check = data.difference_check,
                code = data.slots_code,
            ),
        ),
        _ => (
            format!("{}({})", data.slots_code, value_str),
            format!("{}(-{})", data.slots_code, value_str),
        ),
    };

    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(add_to_deck)],
        remove_from_deck: vec![lua_raw_stmt(remove_from_deck)],
        ..Default::default()
    }
}

