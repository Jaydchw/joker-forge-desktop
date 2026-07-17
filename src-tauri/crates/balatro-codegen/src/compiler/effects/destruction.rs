use crate::compiler::context::CompileContext;
use crate::compiler::effects::utils::is_literal_one_param;
use crate::compiler::effects::EffectOutput;
use crate::lua_ast::*;
use crate::types::EffectDef;

/// Destroy Card effect: marks a card for destruction.
///
/// Behaviour varies by trigger:
/// - `card_discarded`: uses `remove = true` return field
/// - Other triggers: uses pre-return code to set `card.should_destroy`
pub fn destroy_card(effect: &EffectDef, _ctx: &mut CompileContext, trigger: &str) -> EffectOutput {
    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .unwrap_or("Destroyed!");

    match trigger {
        "card_discarded" => EffectOutput {
            return_fields: vec![("remove".to_string(), lua_bool(true))],
            pre_return: vec![],
            config_vars: vec![],
            message: Some(lua_str(message)),
            colour: Some(lua_raw_expr("G.C.RED")),

            segment_id: None,
        },
        _ => {
            let mut pre = vec![];
            // check whether glass trigger flag is needed
            let set_glass = effect
                .params
                .get("setGlassTrigger")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);

            if set_glass {
                pre.push(lua_assign(
                    lua_path(&["context", "other_card", "glass_trigger"]),
                    lua_bool(true),
                ));
            }
            pre.push(lua_assign(
                lua_path(&["context", "other_card", "should_destroy"]),
                lua_bool(true),
            ));

            EffectOutput {
                return_fields: vec![],
                pre_return: pre,
                config_vars: vec![],
                message: Some(lua_str(message)),
                colour: Some(lua_raw_expr("G.C.RED")),

                segment_id: None,
            }
        }
    }
}

/// Destroy Joker effect: destroys a specific joker.
pub fn destroy_joker(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let selection_method =
        get_str_param_any(effect, &["selection_method", "target"]).unwrap_or("random");
    let joker_key = get_str_param(effect, "joker_key").unwrap_or("");
    let position = get_str_param(effect, "position").unwrap_or("first");
    let specific_index = crate::compiler::values::resolve_config_value(
        &effect.params,
        "specific_index",
        ctx,
        "destroy_joker_index",
    )
    .lua_str;
    let bypass_eternal = matches!(
        get_str_param(effect, "bypass_eternal"),
        Some("yes" | "true" | "ignore")
    ) || effect
        .params
        .get("bypass_eternal")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let animation = get_str_param(effect, "animation").unwrap_or("start_dissolve");
    let animation = match animation {
        "shatter" | "explode" => animation,
        _ => "start_dissolve",
    };

    let eternal_check = if bypass_eternal {
        ""
    } else {
        " and not SMODS.is_eternal(joker)"
    };

    let selection_code = match selection_method {
        "self" => "local target_joker = card".to_string(),
        "specific" if !joker_key.is_empty() => format!(
            "local target_joker = nil\n\
            for _, joker in ipairs(G.jokers.cards or {{}}) do\n\
                if joker.config.center.key == '{}'{} and not joker.getting_sliced then\n\
                    target_joker = joker\n\
                    break\n\
                end\n\
            end",
            lua_escape(&normalize_joker_key(joker_key)),
            eternal_check
        ),
        "position" => match position {
            "last" => format!(
                "local target_joker = nil\n\
                for i = #(G.jokers.cards or {{}}), 1, -1 do\n\
                    local joker = G.jokers.cards[i]\n\
                    if joker ~= card{} and not joker.getting_sliced then\n\
                        target_joker = joker\n\
                        break\n\
                    end\n\
                end",
                eternal_check
            ),
            "left" => format!(
                "local target_joker = nil\n\
                local my_pos = nil\n\
                for i, joker in ipairs(G.jokers.cards or {{}}) do\n\
                    if joker == card then my_pos = i; break end\n\
                end\n\
                if my_pos and my_pos > 1 then\n\
                    local joker = G.jokers.cards[my_pos - 1]\n\
                    if joker{} and not joker.getting_sliced then target_joker = joker end\n\
                end",
                eternal_check
            ),
            "right" => format!(
                "local target_joker = nil\n\
                local my_pos = nil\n\
                for i, joker in ipairs(G.jokers.cards or {{}}) do\n\
                    if joker == card then my_pos = i; break end\n\
                end\n\
                if my_pos and my_pos < #G.jokers.cards then\n\
                    local joker = G.jokers.cards[my_pos + 1]\n\
                    if joker{} and not joker.getting_sliced then target_joker = joker end\n\
                end",
                eternal_check
            ),
            "specific" => format!(
                "local target_joker = nil\n\
                local joker = G.jokers.cards[{}]\n\
                if joker and joker ~= card{} and not joker.getting_sliced then\n\
                    target_joker = joker\n\
                end",
                specific_index, eternal_check
            ),
            _ => format!(
                "local target_joker = nil\n\
                for _, joker in ipairs(G.jokers.cards or {{}}) do\n\
                    if joker ~= card{} and not joker.getting_sliced then\n\
                        target_joker = joker\n\
                        break\n\
                    end\n\
                end",
                eternal_check
            ),
        },
        _ => format!(
            "local destructable_jokers = {{}}\n\
            for _, joker in ipairs(G.jokers.cards or {{}}) do\n\
                if joker ~= card{} and not joker.getting_sliced then\n\
                    destructable_jokers[#destructable_jokers + 1] = joker\n\
                end\n\
            end\n\
            local target_joker = #destructable_jokers > 0 and pseudorandom_element(destructable_jokers, pseudoseed('destroy_joker')) or nil",
            eternal_check
        ),
    };

    let bypass_eternal_code = if bypass_eternal {
        "\n        if target_joker.ability then target_joker.ability.eternal = nil end"
    } else {
        ""
    };

    let event = lua_raw_stmt(format!(
        "{selection_code}\n\
        if target_joker then{bypass_eternal_code}\n\
            target_joker.getting_sliced = true\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    target_joker:{animation}({{G.C.RED}}, nil, 1.6)\n\
                    return true\n\
                end\n\
            }}))\n\
        end",
    ));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![event],
        config_vars: vec![],
        message: Some(lua_str("Destroyed!")),
        colour: Some(lua_raw_expr("G.C.RED")),

        segment_id: None,
    }
}

fn get_str_param<'a>(effect: &'a EffectDef, key: &str) -> Option<&'a str> {
    effect.params.get(key).and_then(|v| v.as_str())
}

fn get_str_param_any<'a>(effect: &'a EffectDef, keys: &[&str]) -> Option<&'a str> {
    keys.iter().find_map(|key| get_str_param(effect, key))
}

fn normalize_joker_key(key: &str) -> String {
    if key.starts_with("j_") {
        key.to_string()
    } else {
        format!("j_{}", key)
    }
}

fn lua_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Destroy Consumable effect: destroys a consumable from the consumable area.
pub fn destroy_consumable(_effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let stmt = lua_raw_stmt(
        "if #G.consumeables.cards > 0 then local c = pseudorandom_element(G.consumeables.cards, pseudoseed('destroy_consumable')); if c then SMODS.destroy_cards({c}) end end",
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Destroyed Consumable!")),
        colour: Some(lua_raw_expr("G.C.RED")),

        segment_id: None,
    }
}

/// Destroy Cards effect: destroys highlighted or random cards in hand.
pub fn destroy_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let method = effect
        .params
        .get("method")
        .and_then(|v| v.as_str())
        .unwrap_or("random");

    let stmt = if method == "selected" {
        lua_raw_stmt(
            "if G.hand and G.hand.highlighted then SMODS.destroy_cards(G.hand.highlighted) end",
        )
    } else {
        let resolved = crate::compiler::values::resolve_config_value(
            &effect.params,
            "count",
            ctx,
            "destroy_count",
        );
        if is_literal_one_param(effect, "count") {
            lua_raw_stmt(
                "if G.hand and G.hand.cards and #G.hand.cards > 0 then local c = pseudorandom_element(G.hand.cards, pseudoseed('destroy_cards')); if c then SMODS.destroy_cards({c}) end end",
            )
        } else {
            lua_raw_stmt(format!(
                "local destroyed_cards = {{}}; local temp_hand = {{}}; for _, c in ipairs(G.hand.cards or {{}}) do temp_hand[#temp_hand + 1] = c end; pseudoshuffle(temp_hand, pseudoseed('destroy_cards')); for i = 1, {} do if temp_hand[i] then destroyed_cards[#destroyed_cards + 1] = temp_hand[i] end end; if #destroyed_cards > 0 then SMODS.destroy_cards(destroyed_cards) end",
                resolved.lua_str
            ))
        }
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Destroyed Cards!")),
        colour: Some(lua_raw_expr("G.C.RED")),

        segment_id: None,
    }
}
