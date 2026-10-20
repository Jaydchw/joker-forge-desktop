use crate::compiler::context::CompileContext;
use crate::compiler::effects::utils::is_literal_one_param;
use crate::compiler::effects::EffectOutput;
use crate::lua_ast::*;
use crate::types::{EffectDef, ObjectType};

/// Destroy Card effect: marks a card for destruction.
///
/// Behaviour varies by trigger:
/// - `card_discarded`: uses `remove = true` return field
/// - Other triggers: uses pre-return code to set `card.should_destroy`
pub fn destroy_card(effect: &EffectDef, ctx: &mut CompileContext, trigger: &str) -> EffectOutput {
    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .unwrap_or("Destroyed!");
    let target = if matches!(
        ctx.object_type,
        ObjectType::Enhancement | ObjectType::Seal | ObjectType::Edition
    ) {
        "card"
    } else {
        "context.other_card"
    };
    let set_glass = effect
        .params
        .get("set_glass_trigger")
        .or_else(|| effect.params.get("setGlassTrigger"))
        .map(|value| value.as_bool().unwrap_or_else(|| {
            matches!(value.to_string_lossy().trim().to_ascii_lowercase().as_str(), "y" | "yes" | "true")
        }))
        .unwrap_or(false);

    match trigger {
        "card_discarded" => EffectOutput {
            return_fields: vec![("remove".to_string(), lua_bool(true))],
            pre_return: vec![],
            config_vars: vec![],
            message: Some(lua_str(message)),
            colour: Some(lua_raw_expr("G.C.RED")),

            segment_id: None,
        },
        "card_held_in_hand_end_of_round" => {
            // The normal destruction pass has already run. Queue the actual
            // removal so the engine can finish iterating over held cards.
            // Capture the card now: context is reused by later evaluations.
            let index = ctx.next_effect_count("destroy_card_request");
            let captured = format!("jf_destroy_target{index}");
            let requested = format!("jf_destroy_requested{index}");
            let glass_code = if set_glass {
                format!("{captured}.glass_trigger = true\n")
            } else {
                String::new()
            };
            let schedule = lua_raw_stmt(format!(
                "local {captured} = {target}\n\
                local {requested} = false\n\
                if {captured} and not {captured}.removed and not {captured}.destroyed and not {captured}.shattered and not {captured}.getting_sliced and not {captured}.jf_destroy_card_pending and not SMODS.is_eternal({captured}, {{destroy_cards = true}}) then\n\
                    {captured}.jf_destroy_card_pending = true\n\
                    {requested} = true\n\
                    {glass_code}\
                    G.E_MANAGER:add_event(Event({{\n\
                        func = function()\n\
                            {captured}.jf_destroy_card_pending = nil\n\
                            if {captured}.removed or {captured}.destroyed or {captured}.shattered or {captured}.getting_sliced then return true end\n\
                            SMODS.destroy_cards({{{captured}}})\n\
                            return true\n\
                        end\n\
                    }}))\n\
                end"
            ));
            EffectOutput {
                return_fields: vec![],
                pre_return: vec![schedule],
                config_vars: vec![],
                message: Some(lua_raw_expr(format!(
                    "{requested} and {} or nil", lua_str(message)
                ))),
                colour: Some(lua_raw_expr("G.C.RED")),
                segment_id: None,
            }
        }
        _ => {
            let mut mark_destroyed = Vec::new();
            if set_glass {
                mark_destroyed.push(lua_assign(
                    lua_field(lua_raw_expr(target), "glass_trigger"),
                    lua_bool(true),
                ));
            }
            mark_destroyed.push(lua_assign(
                lua_field(lua_raw_expr(target), "should_destroy"),
                lua_bool(true),
            ));

            EffectOutput {
                return_fields: vec![],
                pre_return: vec![lua_if(lua_raw_expr(target), mark_destroyed)],
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

/// Destroy one owned consumable matching the selected set and card key.
pub fn destroy_consumable(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let set = get_str_param_any(effect, &["consumable_type", "set", "consumableType"])
        .unwrap_or("random");
    let key = get_str_param_any(
        effect,
        &["specific_card", "consumable_key", "consumableKey"],
    )
    .unwrap_or("random");
    // Dynamic catalogue options can select a random card from a particular set.
    let (set, key) = match key.strip_prefix("random_set:") {
        Some(set) => (set, "random"),
        None => (set, key),
    };
    let set = match set.to_ascii_lowercase().as_str() {
        "tarot" => "Tarot",
        "planet" => "Planet",
        "spectral" => "Spectral",
        _ => set,
    };
    let mut filters =
        vec!["consumable and not consumable.getting_sliced and not consumable.removed".to_string()];
    if !set.is_empty() && !matches!(set, "random" | "any") {
        filters.push(format!(
            "((consumable.ability and consumable.ability.set) or (consumable.config and consumable.config.center and consumable.config.center.set)) == {}",
            lua_str(set)
        ));
    }
    if !key.is_empty() && !matches!(key, "random" | "any" | "none") {
        filters.push(format!(
            "consumable.config and consumable.config.center and consumable.config.center.key == {}",
            lua_str(&normalize_consumable_key(key))
        ));
    }
    let stmt = lua_raw_stmt(format!(
        "do\n\
            local target_consumables = {{}}\n\
            for _, consumable in ipairs((G and G.consumeables and G.consumeables.cards) or {{}}) do\n\
                if {} then\n\
                    target_consumables[#target_consumables + 1] = consumable\n\
                end\n\
            end\n\
            if #target_consumables > 0 then\n\
                local target_consumable = pseudorandom_element(target_consumables, pseudoseed('destroy_consumable'))\n\
                if target_consumable then SMODS.destroy_cards({{target_consumable}}) end\n\
            end\n\
        end",
        filters.join(" and ")
    ));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str(
            get_str_param(effect, "customMessage").unwrap_or("Destroyed Consumable!"),
        )),
        colour: Some(lua_raw_expr("G.C.RED")),

        segment_id: None,
    }
}

fn normalize_consumable_key(key: &str) -> String {
    if key.starts_with("c_") {
        return key.to_string();
    }
    // Saved projects from the original web generator used display-derived IDs.
    let key = key.strip_prefix("the_").unwrap_or(key);
    let key = match key {
        "hierophant" => "heirophant",
        _ => key,
    };
    format!("c_{key}")
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
