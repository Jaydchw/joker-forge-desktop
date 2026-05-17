use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::compiler::effects::utils::is_literal_one_param;
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
pub fn destroy_joker(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let target = effect
        .params
        .get("target")
        .and_then(|v| v.as_str())
        .unwrap_or("self");

    let destroy_target = match target {
        "self" => lua_ident("card"),
        "random" => lua_raw_expr("pseudorandom_element(G.jokers.cards, pseudoseed('destroy_joker'))"),
        _ => lua_ident("card"),
    };

    let destroy_call = lua_expr_stmt(lua_method(destroy_target, "start_dissolve", vec![]));

    let event_body = vec![destroy_call, lua_return(lua_bool(true))];

    let event = lua_expr_stmt(lua_method(
        lua_path(&["G", "E_MANAGER"]),
        "add_event",
        vec![lua_call(
            "Event",
            vec![lua_table_raw(vec![TableEntry::KeyValue(
                "func".to_string(),
                Expr::Function {
                    params: vec![],
                    body: event_body,
                },
            )])],
        )],
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
