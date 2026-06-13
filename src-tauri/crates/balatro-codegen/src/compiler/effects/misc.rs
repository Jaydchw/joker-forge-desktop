use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::compiler::effects::utils::{get_str_default, get_str_opt, is_literal_one_param};
use crate::compiler::values::resolve_config_value;
use crate::lua_ast::*;
use crate::types::EffectDef;

/// Show Message effect: displays a status message.
pub fn show_message(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let msg_type = effect
        .params
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("text");

    let colour = effect
        .params
        .get("colour")
        .and_then(|v| v.as_str())
        .unwrap_or("G.C.WHITE");

    let message = match msg_type {
        "variable" => {
            let var_name = effect
                .params
                .get("textVariable")
                .and_then(|v| v.as_str())
                .unwrap_or("message");
            ctx.user_var_expr(var_name)
        }
        _ => {
            let text = effect
                .params
                .get("customMessage")
                .and_then(|v| v.as_str())
                .unwrap_or("Message!");
            lua_str(text)
        }
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr(colour)),
    
        segment_id: None,
    }
}

/// Play Sound effect: plays a game sound.
pub fn play_sound(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let sound = effect
        .params
        .get("sound")
        .or_else(|| effect.params.get("sound_key"))
        .and_then(|v| v.as_str())
        .unwrap_or("card1");

    let play = lua_expr_stmt(lua_call("play_sound", vec![lua_str(sound)]));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![play],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    }
}

/// Juice Up Joker: visual juice animation on the joker card.
pub fn juice_up_joker(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    juice_up_target(effect, ctx, "card")
}

/// Juice Up Card: visual juice animation on the evaluated card.
pub fn juice_up_card(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    juice_up_target(effect, ctx, "context.other_card")
}

fn juice_up_target(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    target_expr: &str,
) -> EffectOutput {
    let mode = get_str_default(effect, "mode", "onetime");
    let scale = resolve_config_value(&effect.params, "scale", ctx, "juice_scale");
    let rotation = resolve_config_value(&effect.params, "rotation", ctx, "juice_rotation");

    let statement = if mode == "constant" {
        format!(
            "local target_card = {target}\n\
            if target_card then\n\
                local function juice_card_until_(juice_target, eval_func, first, delay)\n\
                    G.E_MANAGER:add_event(Event({{\n\
                        trigger = 'after',\n\
                        delay = delay or 0.1,\n\
                        blocking = false,\n\
                        blockable = false,\n\
                        timer = 'REAL',\n\
                        func = (function()\n\
                            if eval_func(juice_target) then\n\
                                if not first or first then\n\
                                    juice_target:juice_up({scale}, {rotation})\n\
                                end\n\
                                juice_card_until_(juice_target, eval_func, nil, 0.8)\n\
                            end\n\
                            return true\n\
                        end)\n\
                    }}))\n\
                end\n\
                local eval = function() return not G.RESET_JIGGLES end\n\
                juice_card_until_(target_card, eval, true)\n\
            end",
            target = target_expr,
            scale = scale.lua_str,
            rotation = rotation.lua_str
        )
    } else {
        format!(
            "local target_card = {target}\n\
            if target_card then\n\
                target_card:juice_up({scale}, {rotation})\n\
            end",
            target = target_expr,
            scale = scale.lua_str,
            rotation = rotation.lua_str
        )
    };

    let juice = lua_raw_stmt(statement);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![juice],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    }
}

/// Free Rerolls: modifies the number of free rerolls in the shop.
pub fn free_rerolls(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let resolved = resolve_config_value(&effect.params, "value", ctx, "reroll_amount");

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(format!(
            "SMODS.change_free_rerolls({})",
            resolved.lua_str
        ))],
        config_vars: vec![],
        message: effect
            .params
            .get("customMessage")
            .and_then(|v| v.as_str())
            .map(lua_str),
        colour: Some(lua_raw_expr("G.C.DARK_EDITION")),
    
        segment_id: None,
    }
}

/// Set Dollars: adds or removes money.
pub fn set_dollars(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let resolved = resolve_config_value(&effect.params, "value", ctx, "dollars");

    EffectOutput {
        return_fields: vec![("dollars".to_string(), resolved.expr)],
        pre_return: vec![],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.MONEY")),
    
        segment_id: None,
    }
}

/// Retrigger effect: causes cards to retrigger.
pub fn retrigger(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let resolved = resolve_config_value(&effect.params, "value", ctx, "repetitions");

    EffectOutput {
        return_fields: vec![("repetitions".to_string(), resolved.expr)],
        pre_return: vec![],
        config_vars: vec![],
        message: Some(lua_call("localize", vec![lua_str("k_again_ex")])),
        colour: Some(lua_raw_expr("G.C.RED")),
    
        segment_id: None,
    }
}

/// Level Up Hand effect.
pub fn level_up_hand(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let hand = effect.params.get("hand").and_then(|v| v.as_str());
    let resolved = crate::compiler::values::resolve_config_value(
        &effect.params,
        "amount",
        ctx,
        "level_amount",
    );
    let hand_expr = hand
        .map(|h| format!("'{}'", h))
        .unwrap_or_else(|| "context.scoring_name".to_string());

    let level_call = lua_raw_stmt(format!(
        "SMODS.smart_level_up_hand(card, {}, false, {})",
        hand_expr, resolved.lua_str
    ));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![level_call],
        config_vars: vec![],
        message: Some(lua_call("localize", vec![lua_str("k_level_up_ex")])),
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Edit Blind Size: modifies the blind's chip requirement.
pub fn edit_blind_size(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operator = effect
        .params
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("multiply");
    let resolved =
        crate::compiler::values::resolve_config_value(&effect.params, "value", ctx, "blind_size");

    let code = match operator {
        "multiply" => format!(
            "G.GAME.blind.chips = G.GAME.blind.chips * {}",
            resolved.lua_str
        ),
        "divide" => format!(
            "G.GAME.blind.chips = G.GAME.blind.chips / {}",
            resolved.lua_str
        ),
        "add" => format!(
            "G.GAME.blind.chips = G.GAME.blind.chips + {}",
            resolved.lua_str
        ),
        "subtract" => format!(
            "G.GAME.blind.chips = G.GAME.blind.chips - {}",
            resolved.lua_str
        ),
        "set" => format!("G.GAME.blind.chips = {}", resolved.lua_str),
        _ => format!(
            "G.GAME.blind.chips = G.GAME.blind.chips * {}",
            resolved.lua_str
        ),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    }
}

/// Set Sell Value effect: adjusts card sell value.
pub fn set_sell_value(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = effect
        .params
        .get("operation")
        .and_then(|v| v.as_str())
        .unwrap_or("add");
    let resolved =
        crate::compiler::values::resolve_config_value(&effect.params, "value", ctx, "sell_value");

    let stmt = match operation {
        "set" => lua_raw_stmt(format!(
            "card.ability.extra_value = {}; if card.set_cost then card:set_cost() end",
            resolved.lua_str
        )),
        "subtract" => lua_raw_stmt(format!(
            "card.ability.extra_value = math.max(0, (card.ability.extra_value or 0) - {}); if card.set_cost then card:set_cost() end",
            resolved.lua_str
        )),
        _ => lua_raw_stmt(format!(
            "card.ability.extra_value = (card.ability.extra_value or 0) + {}; if card.set_cost then card:set_cost() end",
            resolved.lua_str
        )),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Sell Value Updated")),
        colour: Some(lua_raw_expr("G.C.MONEY")),
    
        segment_id: None,
    }
}

/// Set Ante effect.
pub fn set_ante(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = effect
        .params
        .get("operation")
        .and_then(|v| v.as_str())
        .unwrap_or("set");
    let resolved =
        crate::compiler::values::resolve_config_value(&effect.params, "value", ctx, "ante_value");

    let mod_expr = match operation {
        "subtract" => format!("-{}", resolved.lua_str),
        "add" => resolved.lua_str.to_string(),
        _ => format!("{} - (G.GAME.round_resets.ante or 0)", resolved.lua_str),
    };

    let stmt = lua_raw_stmt(format!(
        "local mod = {}; ease_ante(mod); G.GAME.round_resets.blind_ante = (G.GAME.round_resets.blind_ante or 0) + mod",
        mod_expr
    ));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Ante Updated")),
        colour: Some(lua_raw_expr("G.C.YELLOW")),
    
        segment_id: None,
    }
}

/// Disable Boss Blind effect.
pub fn disable_boss_blind(_effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let stmt = lua_raw_stmt(
        "if G.GAME.blind and G.GAME.blind.boss and not G.GAME.blind.disabled then G.GAME.blind:disable(); play_sound('timpani') end",
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_call("localize", vec![lua_str("ph_boss_disabled")])),
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Force Game Over effect.
pub fn force_game_over(_effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let stmt = lua_raw_stmt(
        "G.E_MANAGER:add_event(Event({ trigger = 'after', delay = 0.5, func = function() if G.STAGE == G.STAGES.RUN then G.STATE = G.STATES.GAME_OVER; G.STATE_COMPLETE = false end return true end }))",
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Game Over")),
        colour: Some(lua_raw_expr("G.C.RED")),
    
        segment_id: None,
    }
}

/// Win Game effect.
pub fn win_game(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let win_type = effect
        .params
        .get("win_type")
        .and_then(|v| v.as_str())
        .unwrap_or("blind");

    let stmt = if win_type == "run" {
        lua_raw_stmt("win_game(); G.GAME.won = true")
    } else {
        lua_raw_stmt(
            "if G.STATE == G.STATES.SELECTING_HAND then G.GAME.chips = G.GAME.blind.chips; G.STATE = G.STATES.HAND_PLAYED; G.STATE_COMPLETE = true; end_round() end",
        )
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Win!")),
        colour: Some(lua_raw_expr("G.C.ORANGE")),
    
        segment_id: None,
    }
}

/// Crash Game effect: throws a Lua error, intentionally crashing.
pub fn crash_game(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .unwrap_or("EasternFarmer Was Here")
        .replace('"', "\\\"")
        .replace('\'', "\\'");

    let stmt = lua_raw_stmt(format!("error(\"{}\")", message));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    }
}

/// Show Special Message: displays an attention_text popup in the centre of the screen.
pub fn show_special_message(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .unwrap_or("Special Message!");

    let colour = effect
        .params
        .get("colour")
        .and_then(|v| v.as_str())
        .unwrap_or("G.C.WHITE");

    let scale_resolved = resolve_config_value(&effect.params, "scale", ctx, "msg_scale");
    let hold_resolved = resolve_config_value(&effect.params, "hold", ctx, "msg_hold");
    let silent = effect
        .params
        .get("silent")
        .and_then(|v| v.as_str())
        .unwrap_or("true");

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                attention_text({{\n\
                    text = \"{msg}\",\n\
                    scale = {scale},\n\
                    hold = {hold},\n\
                    major = card,\n\
                    backdrop_colour = {colour},\n\
                    align = (G.STATE == G.STATES.TAROT_PACK or G.STATE == G.STATES.SPECTRAL_PACK or G.STATE == G.STATES.SMODS_BOOSTER_OPENED) and 'tm' or 'cm',\n\
                    offset = {{ x = 0, y = (G.STATE == G.STATES.TAROT_PACK or G.STATE == G.STATES.SPECTRAL_PACK or G.STATE == G.STATES.SMODS_BOOSTER_OPENED) and -0.2 or 0 }},\n\
                    silent = {silent},\n\
                }})\n\
                G.E_MANAGER:add_event(Event({{\n\
                    trigger = 'after',\n\
                    delay = 0.06 * G.SETTINGS.GAMESPEED,\n\
                    blockable = false,\n\
                    blocking = false,\n\
                    func = function()\n\
                        play_sound('tarot2', 0.76, 0.4)\n\
                        return true\n\
                    end\n\
                }}))\n\
                play_sound('tarot2', 1, 0.4)\n\
                card:juice_up(0.3, 0.5)\n\
                return true\n\
            end\n\
        }}))",
        msg = custom_message,
        scale = scale_resolved.lua_str,
        hold = hold_resolved.lua_str,
        colour = colour,
        silent = silent
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: None,
        colour: None,
    
        segment_id: None,
    }
}

/// Shuffle Jokers: animates joker shuffling.
pub fn shuffle_jokers(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let lua = "if #G.jokers.cards > 1 then\n\
        G.jokers:unhighlight_all()\n\
        G.E_MANAGER:add_event(Event({\n\
            trigger = 'before',\n\
            func = function()\n\
                G.E_MANAGER:add_event(Event({\n\
                    func = function()\n\
                        G.jokers:shuffle('aajk')\n\
                        play_sound('cardSlide1', 0.85)\n\
                        return true\n\
                    end,\n\
                }))\n\
                delay(0.15)\n\
                G.E_MANAGER:add_event(Event({\n\
                    func = function()\n\
                        G.jokers:shuffle('aajk')\n\
                        play_sound('cardSlide1', 1.15)\n\
                        return true\n\
                    end\n\
                }))\n\
                delay(0.15)\n\
                G.E_MANAGER:add_event(Event({\n\
                    func = function()\n\
                        G.jokers:shuffle('aajk')\n\
                        play_sound('cardSlide1', 1)\n\
                        return true\n\
                    end\n\
                }))\n\
                delay(0.5)\n\
                return true\n\
            end\n\
        }))\n\
    end";

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Shuffle!"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.ORANGE")),
    
        segment_id: None,
    }
}

/// Flip Joker: flips a joker card face-up or face-down.
pub fn flip_joker(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let selection_method = effect
        .params
        .get("selection_method")
        .and_then(|v| v.as_str())
        .unwrap_or("random");
    let position = effect
        .params
        .get("position")
        .and_then(|v| v.as_str())
        .unwrap_or("first");
    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(str::to_owned);
    let joker_variable = effect
        .params
        .get("joker_variable")
        .and_then(|v| v.as_str())
        .unwrap_or("j_joker");

    let flip_code = match selection_method {
        "all" => "if #G.jokers.cards > 0 then\n\
                for _, joker in ipairs(G.jokers.cards) do\n\
                    joker:flip()\n\
                end\n\
            end"
            .to_string(),
        "selected_joker" => "if #G.jokers.cards > 0 then\n\
                for i = 1, #G.jokers.highlighted do\n\
                    G.jokers.highlighted[i]:flip()\n\
                    break\n\
                end\n\
            end"
            .to_string(),
        "evaled_joker" => "if #G.jokers.cards > 0 then\n\
                context.other_joker:flip()\n\
            end"
            .to_string(),
        "self" => "if #G.jokers.cards > 0 then\n\
                for _, joker in ipairs(G.jokers.cards) do\n\
                    if joker == card then\n\
                        joker:flip()\n\
                        break\n\
                    end\n\
                end\n\
            end"
            .to_string(),
        "position" => match position {
            "first" => "if G.jokers.cards[1] then\n    G.jokers.cards[1]:flip()\nend".to_string(),
            "last" => "if G.jokers.cards[#G.jokers.cards] then\n    G.jokers.cards[#G.jokers.cards]:flip()\nend".to_string(),
            "left" => "local self_index = 1\n\
                    if #G.jokers.cards > 0 then\n\
                        for i = 1, #G.jokers.cards do\n\
                            if G.jokers.cards[i] == card then self_index = i; break end\n\
                        end\n\
                        if self_index > 1 then G.jokers.cards[self_index - 1]:flip() end\n\
                    end"
                .to_string(),
            "right" => "local self_index = 1\n\
                    if #G.jokers.cards > 0 then\n\
                        for i = 1, #G.jokers.cards do\n\
                            if G.jokers.cards[i] == card then self_index = i; break end\n\
                        end\n\
                        if self_index < #G.jokers.cards then G.jokers.cards[self_index + 1]:flip() end\n\
                    end"
                .to_string(),
            _ => {
                let resolved = resolve_config_value(
                    &effect.params, "specific_index", ctx, "flip_index",
                );
                format!(
                    "if #G.jokers.cards > 0 then\n\
                        if G.jokers.cards[{idx}] then G.jokers.cards[{idx}]:flip() end\n\
                    end",
                    idx = resolved.lua_str
                )
            },
        },
        "variable" => format!(
            "local joker_to_flip_key = {}\n\
            for i = 1, #G.jokers.cards do\n\
                if G.jokers.cards[i].config.center.key == joker_to_flip_key then\n\
                    G.jokers.cards[i]:flip()\n\
                end\n\
            end",
            ctx.user_var_path(joker_variable)
        ),
        _ => "if #G.jokers.cards > 0 then\n\
                local available_jokers = {}\n\
                for i, joker in ipairs(G.jokers.cards) do\n\
                    table.insert(available_jokers, joker)\n\
                end\n\
                pseudorandom_element(available_jokers, pseudoseed('flip_joker')):flip()\n\
            end"
            .to_string(),
    };

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Flip!"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(flip_code)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.ORANGE")),
    
        segment_id: None,
    }
}

/// Copy Joker: copies a joker (for joker context).
pub fn copy_joker(effect: &EffectDef, ctx: &mut CompileContext, trigger: &str) -> EffectOutput {
    let selection_method = effect
        .params
        .get("selection_method")
        .and_then(|v| v.as_str())
        .unwrap_or("random");
    let joker_key = effect
        .params
        .get("joker_key")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let position = effect
        .params
        .get("position")
        .and_then(|v| v.as_str())
        .unwrap_or("first");
    let edition = effect
        .params
        .get("edition")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    let sticker = effect
        .params
        .get("sticker")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    let ignore_slots = effect
        .params
        .get("ignore_slots")
        .and_then(|v| v.as_str())
        .map(|s| s == "ignore")
        .unwrap_or(false);
    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let scoring = matches!(trigger, "hand_played" | "card_scored");

    let normalized_key = if joker_key.starts_with("j_") {
        joker_key.to_string()
    } else if joker_key.is_empty() {
        String::new()
    } else {
        format!("j_{}", joker_key)
    };

    let is_negative = edition == "e_negative";
    let has_edition = edition != "none" && !edition.is_empty();
    let has_sticker = sticker != "none" && !sticker.is_empty();

    let joker_selection = match selection_method {
        "specific" if !normalized_key.is_empty() => format!(
            "local target_joker = nil\n\
            for i, joker in ipairs(G.jokers.cards) do\n\
                if joker.config.center.key == \"{}\" then\n\
                    target_joker = joker\n\
                    break\n\
                end\n\
            end",
            normalized_key
        ),
        "position" => match position {
            "first" => "local target_joker = G.jokers.cards[1] or nil".to_string(),
            "last" => "local target_joker = G.jokers.cards[#G.jokers.cards] or nil".to_string(),
            "left" => "local my_pos = nil\n\
                    for i = 1, #G.jokers.cards do\n\
                        if G.jokers.cards[i] == card then my_pos = i; break end\n\
                    end\n\
                    local target_joker = (my_pos and my_pos > 1) and G.jokers.cards[my_pos - 1] or nil"
                .to_string(),
            "right" => "local my_pos = nil\n\
                    for i = 1, #G.jokers.cards do\n\
                        if G.jokers.cards[i] == card then my_pos = i; break end\n\
                    end\n\
                    local target_joker = (my_pos and my_pos < #G.jokers.cards) and G.jokers.cards[my_pos + 1] or nil"
                .to_string(),
            _ => {
                let resolved = resolve_config_value(
                    &effect.params, "specific_index", ctx, "copy_joker_index",
                );
                format!(
                    "local target_joker = G.jokers.cards[{}] or nil",
                    resolved.lua_str
                )
            },
        },
        _ => "local available_jokers = {}\n\
                for i, joker in ipairs(G.jokers.cards) do\n\
                    table.insert(available_jokers, joker)\n\
                end\n\
                local target_joker = #available_jokers > 0 and pseudorandom_element(available_jokers, pseudoseed('copy_joker')) or nil"
            .to_string(),
    };

    let space_check = if is_negative || ignore_slots {
        "if target_joker then".to_string()
    } else {
        "if target_joker and #G.jokers.cards + G.GAME.joker_buffer < G.jokers.config.card_limit then".to_string()
    };

    let edition_code = if has_edition {
        format!(
            "\n            copied_joker:set_edition(\"{}\", true)",
            edition
        )
    } else {
        String::new()
    };

    let sticker_code = if has_sticker {
        format!(
            "\n            copied_joker:add_sticker('{}', true)",
            sticker
        )
    } else {
        String::new()
    };

    let buffer_code = if is_negative {
        String::new()
    } else {
        "\n            G.GAME.joker_buffer = G.GAME.joker_buffer + 1".to_string()
    };
    let buffer_reset = if is_negative {
        String::new()
    } else {
        "\n            G.GAME.joker_buffer = 0".to_string()
    };

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or_else(|| "localize('k_duplicated_ex')".to_string());

    let copy_code = format!(
        "{selection}\n\
        {space_check}{buffer}\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    local copied_joker = copy_card(target_joker, nil, nil, nil, target_joker.edition and target_joker.edition.negative){edition}{sticker}\n\
                    copied_joker:add_to_deck()\n\
                    G.jokers:emplace(copied_joker){reset}\n\
                    return true\n\
                end\n\
            }}))\n\
            card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {{message = {msg}, colour = G.C.GREEN}})\n\
        end",
        selection = joker_selection,
        space_check = space_check,
        buffer = buffer_code,
        edition = edition_code,
        sticker = sticker_code,
        reset = buffer_reset,
        msg = msg_lua
    );

    if scoring {
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![lua_raw_stmt(copy_code)],
            config_vars: vec![],
            message: None,
            colour: Some(lua_raw_expr("G.C.GREEN")),
        
        segment_id: None,
        }
    } else {
        let func_body = vec![lua_raw_stmt(format!("{}\nreturn true", copy_code))];
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
        
        segment_id: None,
        }
    }
}

/// Copy Consumable: copies a consumable card from the consumables area.
pub fn copy_consumable(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    trigger: &str,
) -> EffectOutput {
    let consumable_type = effect
        .params
        .get("consumable_type")
        .and_then(|v| v.as_str())
        .unwrap_or("random");
    let specific_card = effect
        .params
        .get("specific_card")
        .and_then(|v| v.as_str())
        .unwrap_or("random");
    let edition = effect
        .params
        .get("edition")
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| {
            if effect
                .params
                .get("is_negative")
                .and_then(|v| v.as_str())
                .map(|s| s == "negative")
                .unwrap_or(false)
            {
                "e_negative".to_string()
            } else {
                "none".to_string()
            }
        });
    let is_negative = is_negative_edition(&edition);
    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let scoring = matches!(trigger, "hand_played" | "card_scored");

    let slot_check = if is_negative {
        ""
    } else {
        "and #G.consumeables.cards + G.GAME.consumeable_buffer < G.consumeables.config.card_limit"
    };
    let buffer_code = if is_negative {
        ""
    } else {
        "G.GAME.consumeable_buffer = G.GAME.consumeable_buffer + 1"
    };
    let buffer_reset = if is_negative {
        ""
    } else {
        "G.GAME.consumeable_buffer = 0"
    };
    let edition_set = edition_set_code(&edition, "copy_consumable_edition", &ctx.mod_prefix);

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or_else(|| "\"Copied Consumable!\"".to_string());

    let status_target = "context.blueprint_card or card";

    let filter = if consumable_type == "random" {
        String::new()
    } else if specific_card == "random" {
        format!(
            "\n            if consumable.ability.set == \"{}\" then",
            consumable_type
        )
    } else {
        format!(
            "\n            if consumable.ability.set == \"{}\" and consumable.config.center.key == \"{}\" then",
            consumable_type, specific_card
        )
    };
    let filter_end = if consumable_type == "random" {
        ""
    } else {
        "\n            end"
    };

    let copy_code = format!(
        "local target_cards = {{}}\n\
        for i, consumable in ipairs(G.consumeables.cards) do{filter}\n\
            table.insert(target_cards, consumable){filter_end}\n\
        end\n\
        if #target_cards > 0 {slot_check} then\n\
            local card_to_copy = pseudorandom_element(target_cards, pseudoseed('copy_consumable'))\n\
            {buffer}\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    local copied_card = copy_card(card_to_copy){edition}\n\
                    copied_card:add_to_deck()\n\
                    G.consumeables:emplace(copied_card)\n\
                    {reset}\n\
                    return true\n\
                end\n\
            }}))\n\
            card_eval_status_text({status}, 'extra', nil, nil, nil, {{message = {msg}, colour = G.C.GREEN}})\n\
        end",
        filter = filter,
        filter_end = filter_end,
        slot_check = slot_check,
        buffer = buffer_code,
        edition = edition_set,
        reset = buffer_reset,
        status = status_target,
        msg = msg_lua,
    );

    if scoring {
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![lua_raw_stmt(copy_code)],
            config_vars: vec![],
            message: None,
            colour: Some(lua_raw_expr("G.C.GREEN")),
        
        segment_id: None,
        }
    } else {
        let func_body = vec![lua_raw_stmt(format!("{}\nreturn true", copy_code))];
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
        
        segment_id: None,
        }
    }
}

/// Draw Cards: draws additional cards into the hand.
pub fn draw_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let resolved = resolve_config_value(&effect.params, "value", ctx, "card_draw");

    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    let draw_stmt = lua_raw_stmt(format!("SMODS.draw_cards({})", resolved.lua_str));

    let message = custom_message.map(lua_str).unwrap_or_else(|| {
        lua_raw_expr(format!(
            "\"+\"..tostring({})..' Cards Drawn'",
            resolved.lua_str
        ))
    });

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![draw_stmt],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.BLUE")),
    
        segment_id: None,
    }
}

/// Emit Flag: sets a game pool flag.
pub fn emit_flag(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let flag_name = effect
        .params
        .get("flag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("custom_flag");
    let change = effect
        .params
        .get("change")
        .and_then(|v| v.as_str())
        .unwrap_or("true");
    let custom_message = effect
        .params
        .get("customMessage")
        .and_then(|v| v.as_str())
        .map(str::to_owned);

    // Sanitise flag name: replace non-alphanumeric chars with underscores
    let safe_flag: String = flag_name
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();

    let mod_prefix = ctx.mod_prefix.clone();
    let full_flag = format!("{}_{}", mod_prefix, safe_flag);

    let change_code = if change == "invert" {
        format!("not (G.GAME.pool_flags.{} or false)", full_flag)
    } else {
        change.to_string()
    };

    let msg_text = custom_message.unwrap_or_else(|| safe_flag.clone());

    let lua = format!(
        "G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                card:juice_up(0.3, 0.5)\n\
                card_eval_status_text(card, 'extra', nil, nil, nil, {{message = \"{msg}\", colour = G.C.BLUE}})\n\
                G.GAME.pool_flags.{flag} = {change}\n\
                return true\n\
            end\n\
        }}))",
        msg = msg_text,
        flag = full_flag,
        change = change_code
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.BLUE")),
    
        segment_id: None,
    }
}

/// Add Booster Into Shop: adds a booster pack to the current shop.
pub fn add_booster_into_shop(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let method = effect
        .params
        .get("method_type")
        .and_then(|v| v.as_str())
        .unwrap_or("specific");
    let specific_booster = effect
        .params
        .get("specific_key")
        .and_then(|v| v.as_str())
        .unwrap_or("p_arcana_normal_1");
    let booster_variable = effect
        .params
        .get("key_variable")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let booster_code = match method {
        "key_var" => format!(
            "SMODS.add_booster_to_shop({})",
            ctx.user_var_path(booster_variable)
        ),
        "random" => "SMODS.add_booster_to_shop()".to_string(),
        _ => format!("SMODS.add_booster_to_shop('{}')", specific_booster),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(booster_code)],
        config_vars: vec![],
        message: Some(lua_str("Added Booster!")),
        colour: Some(lua_raw_expr("G.C.BLUE")),
    
        segment_id: None,
    }
}

/// Add Voucher Into Shop: adds a voucher to the current shop.
pub fn add_voucher_into_shop(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let method = effect
        .params
        .get("method_type")
        .and_then(|v| v.as_str())
        .unwrap_or("specific");
    let specific_voucher = effect
        .params
        .get("specific_key")
        .and_then(|v| v.as_str())
        .unwrap_or("v_overstock_norm");
    let voucher_variable = effect
        .params
        .get("key_variable")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let duration = effect
        .params
        .get("duration")
        .and_then(|v| v.as_str())
        .unwrap_or("false");

    let voucher_code = match method {
        "key_var" => format!(
            "SMODS.add_voucher_to_shop({}, {})",
            ctx.user_var_path(voucher_variable),
            duration
        ),
        "random" => format!("SMODS.add_voucher_to_shop(nil, {})", duration),
        _ => format!(
            "SMODS.add_voucher_to_shop('{}', {})",
            specific_voucher, duration
        ),
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(voucher_code)],
        config_vars: vec![],
        message: Some(lua_str("Added Voucher!")),
        colour: Some(lua_raw_expr("G.C.BLUE")),
    
        segment_id: None,
    }
}

/// Edit Card Appearance: modifies a card's `in_pool` function to show/hide it.
pub fn edit_card_appearance(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let appearance = effect
        .params
        .get("card_appearance")
        .and_then(|v| v.as_str())
        .unwrap_or("appear");
    let key = effect
        .params
        .get("key")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if key.is_empty() || appearance == "none" {
        return EffectOutput::default();
    }

    let code = if appearance == "appear" {
        format!(
            "G.P_CENTERS[\"{}\"].in_pool = function() return true end",
            key
        )
    } else {
        format!(
            "G.P_CENTERS[\"{}\"].in_pool = function() return false end",
            key
        )
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.MONEY")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// edit_game_speed
// ---------------------------------------------------------------------------

/// Edit Game Speed: changes G.SETTINGS.GAMESPEED.
pub fn edit_game_speed(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let speed = get_str_default(effect, "speed", "0.5");
    let custom_message = get_str_opt(effect, "customMessage");

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(format!("G.SETTINGS.GAMESPEED = {}", speed))],
        config_vars: vec![],
        message: custom_message.map(lua_str),
        colour: None,
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// fix_probability
// ---------------------------------------------------------------------------

/// Fix Probability: sets probability numerator and/or denominator.
pub fn fix_probability(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let part = get_str_default(effect, "part", "numerator");
    let resolved = resolve_config_value(&effect.params, "value", ctx, "set_probability");
    let mut return_fields: Vec<(String, Expr)> = Vec::new();
    let value_expr = resolved.expr.clone();

    match part.as_str() {
        "denominator" => {
            return_fields.push(("denominator".to_string(), value_expr));
        }
        "both" => {
            return_fields.push(("numerator".to_string(), value_expr.clone()));
            return_fields.push(("denominator".to_string(), value_expr));
        }
        _ => {
            return_fields.push(("numerator".to_string(), value_expr));
        }
    }

    EffectOutput {
        return_fields,
        pre_return: vec![],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// mod_probability
// ---------------------------------------------------------------------------

/// Mod Probability: modifies probability numerator or denominator.
pub fn mod_probability(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let chance_part = get_str_default(effect, "part", "numerator");
    let operation = get_str_default(effect, "operation", "multiply");
    let resolved = resolve_config_value(&effect.params, "value", ctx, "mod_probability");
    let target_key = if chance_part == "denominator" {
        "denominator"
    } else {
        "numerator"
    };
    let base_expr = lua_path(&["context", target_key]);
    let value_expr = resolved.expr.clone();

    let updated_expr = match operation.as_str() {
        "increment" => lua_add(base_expr, value_expr),
        "decrement" => lua_sub(base_expr, value_expr),
        "divide" => lua_div(base_expr, value_expr),
        _ => lua_mul(base_expr, value_expr),
    };

    EffectOutput {
        return_fields: vec![(target_key.to_string(), updated_expr)],
        pre_return: vec![],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// modify_blind_requirement
// ---------------------------------------------------------------------------

/// Modify Blind Requirement: changes G.GAME.blind.chips with HUD update.
pub fn modify_blind_requirement(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "multiply");
    let custom_message = get_str_opt(effect, "customMessage");
    let resolved = resolve_config_value(&effect.params, "value", ctx, "blind_size");

    let (blind_code, default_msg) = match operation.as_str() {
        "add" => (
            format!(
                "G.GAME.blind.chips = G.GAME.blind.chips + {val}",
                val = resolved.lua_str
            ),
            format!("\"+\"..tostring({})..' Blind Size'", resolved.lua_str),
        ),
        "subtract" => (
            format!(
                "G.GAME.blind.chips = G.GAME.blind.chips - {val}",
                val = resolved.lua_str
            ),
            format!("\"-\"..tostring({})..' Blind Size'", resolved.lua_str),
        ),
        "divide" => (
            format!(
                "G.GAME.blind.chips = G.GAME.blind.chips / {val}",
                val = resolved.lua_str
            ),
            format!("\"/\"..tostring({})..' Blind Size'", resolved.lua_str),
        ),
        "set" => (
            format!("G.GAME.blind.chips = {val}", val = resolved.lua_str),
            format!("\"Set to \"..tostring({})..' Blind Size'", resolved.lua_str),
        ),
        _ => (
            format!(
                "G.GAME.blind.chips = G.GAME.blind.chips * {val}",
                val = resolved.lua_str
            ),
            format!("\"X\"..tostring({})..' Blind Size'", resolved.lua_str),
        ),
    };

    let msg_lua = custom_message
        .map(|m| format!("\"{}\"", m))
        .unwrap_or(default_msg);

    let func_code = format!(
        "func = function()\n\
            if G.GAME.blind.in_blind then\n\
                card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {{message = {msg}, colour = G.C.GREEN}})\n\
                {blind}\n\
                G.GAME.blind.chip_text = number_format(G.GAME.blind.chips)\n\
                G.HUD_blind:recalculate()\n\
                return true\n\
            end\n\
        end",
        msg = msg_lua,
        blind = blind_code
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(func_code)],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// modify_all_blinds_requirement
// ---------------------------------------------------------------------------

/// Modify All Blinds Requirement: changes ante_scaling.
pub fn modify_all_blinds_requirement(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str_default(effect, "operation", "multiply");
    let resolved = resolve_config_value(&effect.params, "value", ctx, "all_blinds_size");

    let inner = match operation.as_str() {
        "add" => format!(
            "G.GAME.starting_params.ante_scaling = G.GAME.starting_params.ante_scaling + {}",
            resolved.lua_str
        ),
        "subtract" => format!(
            "G.GAME.starting_params.ante_scaling = G.GAME.starting_params.ante_scaling - {}",
            resolved.lua_str
        ),
        "divide" => format!(
            "G.GAME.starting_params.ante_scaling = G.GAME.starting_params.ante_scaling / {}",
            resolved.lua_str
        ),
        "set" => format!("G.GAME.starting_params.ante_scaling = {}", resolved.lua_str),
        _ => format!(
            "G.GAME.starting_params.ante_scaling = G.GAME.starting_params.ante_scaling * {}",
            resolved.lua_str
        ),
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
        message: None,
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// permanent_bonus
// ---------------------------------------------------------------------------

/// Permanent Bonus: adds a permanent bonus to scored cards.
pub fn permanent_bonus(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let bonus_type = get_str_default(effect, "bonus_type", "perma_bonus");
    let custom_message = get_str_opt(effect, "customMessage");
    let resolved = resolve_config_value(
        &effect.params,
        "value",
        ctx,
        &format!("pb_{}", bonus_type.replace("perma_", "")),
    );

    let code = format!(
        "context.other_card.ability.{bt} = context.other_card.ability.{bt} or 0\n\
        context.other_card.ability.{bt} = context.other_card.ability.{bt} + {val}",
        bt = bonus_type,
        val = resolved.lua_str
    );

    let colour = if bonus_type.contains("mult") {
        "G.C.MULT"
    } else if bonus_type.contains("dollars") {
        "G.C.MONEY"
    } else {
        "G.C.CHIPS"
    };

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_call("localize", vec![lua_str("k_upgrade_ex")]));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr(colour)),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// redeem_voucher
// ---------------------------------------------------------------------------

/// Redeem Voucher: creates and redeems a voucher card.
pub fn redeem_voucher(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let voucher_type = get_str_default(effect, "voucher_type", "random");
    let voucher_key = get_str_default(effect, "specific_voucher", "v_overstock_norm");
    let key_var = get_str_default(effect, "variable", "keyVar");
    let custom_message = get_str_opt(effect, "customMessage");
    let effect_id = effect
        .params
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("redeem");

    let key_code = match voucher_type.as_str() {
        "random" => format!(
            "local voucher_key = pseudorandom_element(G.P_CENTER_POOLS.Voucher, '{}').key",
            &effect_id[..8.min(effect_id.len())]
        ),
        "keyvar" => format!("local voucher_key = {}", ctx.user_var_path(&key_var)),
        _ => format!("local voucher_key = '{}'", voucher_key),
    };

    let code = format!(
        "{key_code}\n\
        local voucher_card = SMODS.create_card{{area = G.play, key = voucher_key}}\n\
        voucher_card:start_materialize()\n\
        voucher_card.cost = 0\n\
        G.play:emplace(voucher_card)\n\
        delay(0.8)\n\
        voucher_card:redeem()\n\
        G.E_MANAGER:add_event(Event({{\n\
            trigger = 'after',\n\
            delay = 0.5,\n\
            func = function()\n\
                voucher_card:start_dissolve()\n\
                return true\n\
            end\n\
        }}))",
        key_code = key_code
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: custom_message.map(lua_str),
        colour: Some(lua_raw_expr("G.C.RED")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// unlock_joker
// ---------------------------------------------------------------------------

/// Unlock Joker: unlocks and optionally discovers a joker.
pub fn unlock_joker(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let selection_method = get_str_default(effect, "selection_method", "key");
    let joker_key = get_str_default(effect, "joker_key", "j_joker");
    let discover = get_str_default(effect, "discover", "false") == "true";
    let custom_message = get_str_opt(effect, "customMessage");
    let key_variable = get_str_default(effect, "key_variable", "none");

    let normalized_key = if joker_key.starts_with("j_") {
        joker_key.clone()
    } else {
        format!("j_{}", joker_key)
    };

    let discover_code = if discover {
        "\n        discover_card(target_joker)"
    } else {
        ""
    };

    let msg_code = custom_message
        .as_ref()
        .map(|m| {
            format!(
                "\n        SMODS.calculate_effect({{message = \"{}\"}}, card)",
                m
            )
        })
        .unwrap_or_default();

    let key_expr = if selection_method == "key" {
        format!("G.P_CENTERS[\"{}\"]", normalized_key)
    } else {
        format!("G.P_CENTERS[{}]", ctx.user_var_path(&key_variable))
    };

    let code = format!(
        "func = function()\n\
            local target_joker = {key}\n\
            if target_joker then\n\
                unlock_card(target_joker){discover}{msg}\n\
            end\n\
            return true\n\
        end",
        key = key_expr,
        discover = discover_code,
        msg = msg_code
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr("G.C.BLUE")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// saved_effect
// ---------------------------------------------------------------------------

/// Saved effect: returns `saved = true` to prevent destruction.
pub fn saved_effect(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let custom_message = get_str_opt(effect, "customMessage");

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_call("localize", vec![lua_str("k_saved_ex")]));

    EffectOutput {
        return_fields: vec![("saved".to_string(), lua_bool(true))],
        pre_return: vec![],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.RED")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// edit_joker
// ---------------------------------------------------------------------------

/// Edit Joker: modifies a joker's edition or sticker.
pub fn edit_joker(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let edition = get_str_default(effect, "edition", "none");
    let sticker = get_str_default(effect, "sticker", "none");
    let selection_method = get_str_default(effect, "selection_method", "self");
    let custom_message = get_str_opt(effect, "customMessage");

    let target = match selection_method.as_str() {
        "self" => "card".to_string(),
        "evaled_joker" => "context.other_joker".to_string(),
        "selected_joker" => "G.jokers.highlighted[1]".to_string(),
        "random" => "pseudorandom_element(G.jokers.cards, pseudoseed('edit_joker'))".to_string(),
        _ => "card".to_string(),
    };

    let mut code_parts = Vec::new();

    if edition != "none" && !edition.is_empty() {
        if edition == "remove" {
            code_parts.push(format!("{}:set_edition(nil, true)", target));
        } else {
            let e = if edition.starts_with("e_") {
                edition.clone()
            } else {
                format!("e_{}", edition)
            };
            code_parts.push(format!("{}:set_edition('{}', true)", target, e));
        }
    }

    if sticker != "none" && !sticker.is_empty() {
        if sticker == "remove" {
            code_parts.push(format!(
                "{t}.ability.eternal = false\n{t}.ability.perishable = false\n{t}.ability.rental = false",
                t = target
            ));
        } else {
            code_parts.push(format!("{}:add_sticker('{}', true)", target, sticker));
        }
    }

    if code_parts.is_empty() {
        return EffectOutput::default();
    }

    let message = custom_message.map(lua_str);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code_parts.join("\n"))],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.DARK_EDITION")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// edit_booster_packs
// ---------------------------------------------------------------------------

/// Edit Booster Packs: modifies booster pack size/choice.
pub fn edit_booster_packs(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let booster_key = get_str_default(effect, "booster_key", "");
    let modify_type = get_str_default(effect, "modify_type", "size");
    let resolved = resolve_config_value(&effect.params, "value", ctx, "booster_mod");

    if booster_key.is_empty() {
        return EffectOutput::default();
    }

    let field = if modify_type == "choice" {
        "config.choose"
    } else {
        "config.extra"
    };

    let code = format!(
        "if G.P_CENTERS['{key}'] then\n\
            G.P_CENTERS['{key}'].{field} = (G.P_CENTERS['{key}'].{field} or 0) + {val}\n\
        end",
        key = booster_key,
        field = field,
        val = resolved.lua_str
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: Some(lua_str("Booster Updated!")),
        colour: Some(lua_raw_expr("G.C.BLUE")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// fool_effect
// ---------------------------------------------------------------------------

/// Fool effect: recreates the last used Tarot/Planet card (consumable context).
pub fn fool_effect(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let custom_message = get_str_opt(effect, "customMessage");

    let code = "G.E_MANAGER:add_event(Event({\n\
            trigger = 'after',\n\
            delay = 0.4,\n\
            func = function()\n\
                if G.consumeables.config.card_limit > #G.consumeables.cards then\n\
                    play_sound('timpani')\n\
                    SMODS.add_card({ key = G.GAME.last_tarot_planet })\n\
                    used_card:juice_up(0.3, 0.5)\n\
                end\n\
                return true\n\
            end\n\
        }))\n\
        delay(0.6)";

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: custom_message.map(lua_str),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Tarot")),
    
        segment_id: None,
    }
}

fn is_negative_edition(edition: &str) -> bool {
    matches!(edition, "e_negative" | "negative" | "y" | "true")
}

fn normalize_edition_key(edition: &str, mod_prefix: &str) -> String {
    if edition.starts_with("e_") {
        return edition.to_string();
    }

    if matches!(edition, "foil" | "holo" | "polychrome" | "negative") || mod_prefix.is_empty() {
        return format!("e_{}", edition);
    }

    format!("e_{}_{}", mod_prefix, edition)
}

fn edition_set_code(edition: &str, seed: &str, mod_prefix: &str) -> String {
    if edition.is_empty() || edition == "none" {
        return String::new();
    }

    if edition == "random" {
        return format!(
            "\n                        local random_edition = SMODS.poll_edition({{ key = '{}', no_negative = true, guaranteed = true }})\
             \n                        if random_edition then copied_card:set_edition(random_edition, true) end",
            seed
        );
    }

    format!(
        "\n                        copied_card:set_edition(\"{}\", true)",
        normalize_edition_key(edition, mod_prefix).replace('"', "\\\"")
    )
}

// ---------------------------------------------------------------------------
// edit_cards (consumable context, batch card editing)
// ---------------------------------------------------------------------------

/// Edit Cards: applies modifications to selected/random cards in hand (consumable context).
pub fn edit_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let enhancement = get_str_default(effect, "enhancement", "none");
    let seal = get_str_default(effect, "seal", "none");
    let edition = get_str_default(effect, "edition", "none");
    let suit = get_str_default(effect, "suit", "none");
    let rank = get_str_default(effect, "rank", "none");
    let method = get_str_default(effect, "selection_method", "random");
    let custom_message = get_str_opt(effect, "customMessage");

    let has_mods = [&enhancement, &seal, &edition, &suit, &rank]
        .iter()
        .any(|p| p.as_str() != "none");

    if !has_mods {
        return EffectOutput::default();
    }

    let resolved = resolve_config_value(&effect.params, "count", ctx, "edit_count");
    let target = if method == "random" {
        "affected_cards"
    } else {
        "G.hand.highlighted"
    };

    let mut code = String::new();

    let single_random_target = method == "random" && is_literal_one_param(effect, "count");
    if method == "random" && !single_random_target {
        code.push_str(&format!(
            "local affected_cards = {{}}\n\
            local temp_hand = {{}}\n\
            for _, playing_card in ipairs(G.hand.cards) do temp_hand[#temp_hand + 1] = playing_card end\n\
            pseudoshuffle(temp_hand, pseudoseed('edit_cards'))\n\
            for i = 1, math.min({}, #temp_hand) do\n\
                affected_cards[#affected_cards + 1] = temp_hand[i]\n\
            end\n",
            resolved.lua_str
        ));
    }

    if single_random_target {
        code.push_str(
            "local _card = pseudorandom_element(G.hand.cards, pseudoseed('edit_cards'))\n\
            if not _card then return end\n",
        );
    }

    // Flip animation
    if !single_random_target {
        code.push_str(&format!(
            "G.E_MANAGER:add_event(Event({{\n\
                trigger = 'after', delay = 0.4,\n\
                func = function() play_sound('tarot1'); used_card:juice_up(0.3, 0.5); return true end\n\
            }}))\n\
            for i = 1, #{t} do\n\
                local percent = 1.15 - (i - 0.999) / (#{t} - 0.998) * 0.3\n\
                G.E_MANAGER:add_event(Event({{\n\
                    trigger = 'after', delay = 0.15,\n\
                    func = function() {t}[i]:flip(); play_sound('card1', percent); {t}[i]:juice_up(0.3, 0.3); return true end\n\
                }}))\n\
            end\n\
            delay(0.2)\n",
            t = target
        ));
    }

    // Enhancement
    if enhancement != "none" {
        let enh_code = if enhancement == "remove" {
            format!("{t}[i]:set_ability(G.P_CENTERS.c_base)", t = target)
        } else if enhancement == "random" {
            format!(
                "local random_enhancement = SMODS.poll_enhancement({{ key = 'random_enhance', guaranteed = true, no_replace = true }})\n\
                if random_enhancement then {t}[i]:set_ability(G.P_CENTERS[random_enhancement]) end",
                t = target
            )
        } else {
            format!(
                "{t}[i]:set_ability(G.P_CENTERS['{e}'])",
                t = target,
                e = enhancement
            )
        };
        if single_random_target {
            let single_enh_code = enh_code.replace(&format!("{}[i]", target), "_card");
            code.push_str(&single_enh_code);
            code.push('\n');
        } else {
            code.push_str(&format!(
                "for i = 1, #{t} do\n\
                    G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.1, func = function()\n\
                        {c}\n\
                        return true\n\
                    end}}))\n\
                end\n",
                t = target,
                c = enh_code
            ));
        }
    }

    // Seal
    if seal != "none" {
        let seal_code = if seal == "remove" {
            format!("{t}[i]:set_seal(nil, nil, true)", t = target)
        } else if seal == "random" {
            format!(
                "local random_seal = SMODS.poll_seal({{mod = 10, guaranteed = true}})\n\
                if random_seal then {t}[i]:set_seal(random_seal, nil, true) end",
                t = target
            )
        } else {
            format!("{t}[i]:set_seal('{s}', nil, true)", t = target, s = seal)
        };
        if single_random_target {
            let single_seal_code = seal_code.replace(&format!("{}[i]", target), "_card");
            code.push_str(&single_seal_code);
            code.push('\n');
        } else {
            code.push_str(&format!(
                "for i = 1, #{t} do\n\
                    G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.1, func = function()\n\
                        {c}\n\
                        return true\n\
                    end}}))\n\
                end\n",
                t = target,
                c = seal_code
            ));
        }
    }

    // Edition
    if edition != "none" {
        let ed_code = if edition == "remove" {
            format!("{t}[i]:set_edition(nil, true)", t = target)
        } else if edition == "random" {
            format!(
                "local random_edition = SMODS.poll_edition({{ key = 'random_edition', no_negative = true, guaranteed = true }})\n\
                if random_edition then {t}[i]:set_edition(random_edition, true) end",
                t = target
            )
        } else {
            let e = if edition.starts_with("e_") {
                edition.clone()
            } else {
                format!("e_{}", edition)
            };
            format!("{t}[i]:set_edition('{e}', true)", t = target, e = e)
        };
        if single_random_target {
            let single_ed_code = ed_code.replace(&format!("{}[i]", target), "_card");
            code.push_str(&single_ed_code);
            code.push('\n');
        } else {
            code.push_str(&format!(
                "for i = 1, #{t} do\n\
                    G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.1, func = function()\n\
                        {c}\n\
                        return true\n\
                    end}}))\n\
                end\n",
                t = target,
                c = ed_code
            ));
        }
    }

    // Suit
    if suit != "none" {
        let suit_code = if suit == "random" {
            format!(
                "local _suit = pseudorandom_element(SMODS.Suits, 'random_suit')\n\
                assert(SMODS.change_base({t}[i], _suit.key))",
                t = target
            )
        } else {
            format!(
                "assert(SMODS.change_base({t}[i], '{s}'))",
                t = target,
                s = suit
            )
        };
        if single_random_target {
            let single_suit_code = suit_code.replace(&format!("{}[i]", target), "_card");
            code.push_str(&single_suit_code);
            code.push('\n');
        } else {
            code.push_str(&format!(
                "for i = 1, #{t} do\n\
                    G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.1, func = function()\n\
                        {c}\n\
                        return true\n\
                    end}}))\n\
                end\n",
                t = target,
                c = suit_code
            ));
        }
    }

    // Rank
    if rank != "none" {
        let rank_code = if rank == "random" {
            format!(
                "local _rank = pseudorandom_element(SMODS.Ranks, 'random_rank')\n\
                assert(SMODS.change_base({t}[i], nil, _rank.key))",
                t = target
            )
        } else {
            format!(
                "assert(SMODS.change_base({t}[i], nil, '{r}'))",
                t = target,
                r = rank
            )
        };
        if single_random_target {
            let single_rank_code = rank_code.replace(&format!("{}[i]", target), "_card");
            code.push_str(&single_rank_code);
            code.push('\n');
        } else {
            code.push_str(&format!(
                "for i = 1, #{t} do\n\
                    G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.1, func = function()\n\
                        {c}\n\
                        return true\n\
                    end}}))\n\
                end\n",
                t = target,
                c = rank_code
            ));
        }
    }

    // Unflip animation
    if !single_random_target {
        code.push_str(&format!(
            "for i = 1, #{t} do\n\
                local percent = 0.85 + (i - 0.999) / (#{t} - 0.998) * 0.3\n\
                G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.15,\n\
                    func = function() {t}[i]:flip(); play_sound('tarot2', percent, 0.6); {t}[i]:juice_up(0.3, 0.3); return true end\n\
                }}))\n\
            end\n\
            G.E_MANAGER:add_event(Event({{trigger = 'after', delay = 0.2,\n\
                func = function() G.hand:unhighlight_all(); return true end\n\
            }}))\n\
            delay(0.5)",
            t = target
        ));
    }

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: custom_message.map(lua_str),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Tarot")),
    
        segment_id: None,
    }
}
