use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::lua_ast::*;
use crate::types::EffectDef;

fn get_str(effect: &EffectDef, key: &str) -> Option<String> {
    effect.params.get(key).map(|v| v.to_string_lossy())
}

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

fn is_scoring_trigger(trigger: &str) -> bool {
    matches!(trigger, "hand_played" | "card_scored")
}

// ---------------------------------------------------------------------------
// modify_internal_variable
// ---------------------------------------------------------------------------

/// Modify Internal Variable: changes a user-defined number variable.
pub fn modify_internal_variable(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    trigger: &str,
) -> EffectOutput {
    let variable_name = get_str_default(effect, "variable_name", "var1");
    let operation = get_str_default(effect, "operation", "increment");
    let index_method = get_str_default(effect, "index_method", "self");
    let custom_message = get_str(effect, "customMessage");
    let search_key = get_str_default(effect, "joker_key", "j_joker");
    let search_var = get_str_default(effect, "joker_variable", "jokerVar");
    let scoring = is_scoring_trigger(trigger);

    let resolved = crate::compiler::values::resolve_config_value(
        &effect.params,
        "value",
        ctx,
        &format!("var_{}", variable_name),
    );
    let variable_path = ctx.user_var_path(&variable_name);

    let operation_code = match operation.as_str() {
        "set" => format!(
            "{path} = {val}",
            path = variable_path,
            val = resolved.lua_str
        ),
        "increment" => format!(
            "{path} = ({path}) + {val}",
            path = variable_path,
            val = resolved.lua_str
        ),
        "decrement" => format!(
            "{path} = math.max(0, ({path}) - {val})",
            path = variable_path,
            val = resolved.lua_str
        ),
        "multiply" => format!(
            "{path} = ({path}) * {val}",
            path = variable_path,
            val = resolved.lua_str
        ),
        "divide" => format!(
            "{path} = ({path}) / {val}",
            path = variable_path,
            val = resolved.lua_str
        ),
        "power" => format!(
            "{path} = ({path}) ^ {val}",
            path = variable_path,
            val = resolved.lua_str
        ),
        "absolute" => format!("{path} = math.abs({path})", path = variable_path),
        "natural_log" => format!("{path} = math.log({path})", path = variable_path),
        "log10" => format!("{path} = math.log10({path})", path = variable_path),
        "square_root" => format!("{path} = math.sqrt({path})", path = variable_path),
        "ceil" => format!("{path} = math.ceil({path})", path = variable_path),
        "floor" => format!("{path} = math.floor({path})", path = variable_path),
        "index" => match index_method.as_str() {
            "self" => format!(
                "for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i] == card then\n\
                        {path} = i\n\
                        break\n\
                    end\n\
                end",
                path = variable_path
            ),
            "random" => format!(
                "{path} = math.random(1, #G.jokers.cards)",
                path = variable_path
            ),
            "first" => format!("{path} = 1", path = variable_path),
            "last" => format!("{path} = #G.jokers.cards", path = variable_path),
            "left" => format!(
                "local my_pos = nil\n\
                for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i] == card then\n\
                        my_pos = i\n\
                        break\n\
                    end\n\
                end\n\
                {path} = math.max(my_pos - 1, 0)",
                path = variable_path
            ),
            "right" => format!(
                "local my_pos = nil\n\
                for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i] == card then\n\
                        my_pos = i\n\
                        break\n\
                    end\n\
                end\n\
                if my_pos > #G.jokers.cards then\n\
                    my_pos = -1\n\
                end\n\
                {path} = my_pos + 1",
                path = variable_path
            ),
            "key" => format!(
                "local search_key = '{key}'\n\
                {path} = 0\n\
                for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i].config.center.key == search_key then\n\
                        {path} = i\n\
                        break\n\
                    end\n\
                end",
                path = variable_path,
                key = search_key
            ),
            "variable" => format!(
                "local search_key = {search_var_path}\n\
                {path} = 0\n\
                for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i].config.center.key == search_key then\n\
                        {path} = i\n\
                        break\n\
                    end\n\
                end",
                search_var_path = ctx.user_var_path(&search_var),
                path = variable_path
            ),
            "selected_joker" => format!(
                "for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i] == G.jokers.highlighted[1] then\n\
                        {path} = i\n\
                        break\n\
                    end\n\
                end",
                path = variable_path
            ),
            "evaled_joker" => format!(
                "for i = 1, #G.jokers.cards do\n\
                    if G.jokers.cards[i] == context.other_joker then\n\
                        {path} = i\n\
                        break\n\
                    end\n\
                end",
                path = variable_path
            ),
            _ => format!(
                "{path} = ({path}) + {val}",
                path = variable_path,
                val = resolved.lua_str
            ),
        },
        _ => format!(
            "{path} = ({path}) + {val}",
            path = variable_path,
            val = resolved.lua_str
        ),
    };

    let message_colour = match operation.as_str() {
        "set" => "G.C.BLUE",
        "increment" => "G.C.GREEN",
        "decrement" => "G.C.RED",
        "multiply" | "divide" => "G.C.MULT",
        _ => "G.C.BLUE",
    };

    let message = custom_message.map(lua_str);

    if scoring {
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![lua_raw_stmt(operation_code)],
            config_vars: vec![],
            message,
            colour: Some(lua_raw_expr(message_colour)),
        }
    } else {
        let func_body = vec![lua_raw_stmt(format!("{}\nreturn true", operation_code))];
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
            message,
            colour: Some(lua_raw_expr(message_colour)),
        }
    }
}

// ---------------------------------------------------------------------------
// change_key_variable
// ---------------------------------------------------------------------------

/// Change Key Variable: changes a key-type user variable.
pub fn change_key_variable(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let variable_name = get_str_default(effect, "variable_name", "keyvar");
    let change_type = get_str_default(effect, "change_type", "specific");
    let key_type = get_str_default(effect, "key_type", "joker");
    let specific_key = get_str_default(effect, "specific_key", "j_joker");
    let custom_message = get_str(effect, "customMessage");

    let variable_path = ctx.user_var_path(&variable_name);
    let code = match change_type.as_str() {
        "random" => match key_type.as_str() {
            "joker" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Joker, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "consumable" | "tarot" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Tarot, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "planet" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Planet, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "spectral" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Spectral, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "enhancement" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Enhanced, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "seal" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Seal, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "edition" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Edition, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "voucher" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Voucher, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "tag" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Tag, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            "booster" => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Booster, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
            _ => format!(
                "{path} = pseudorandom_element(G.P_CENTER_POOLS.Joker, pseudoseed('{seed}')).key",
                path = variable_path,
                seed = variable_name
            ),
        },
        "scored_card" => format!(
            "{path} = context.other_card.config.center.key",
            path = variable_path
        ),
        "evaled_joker" => format!(
            "{path} = context.other_joker.config.center.key",
            path = variable_path
        ),
        "selected_joker" => format!(
            "if G.jokers.highlighted[1] then\n\
                {path} = G.jokers.highlighted[1].config.center.key\n\
            end",
            path = variable_path
        ),
        _ => format!(
            "{path} = '{key}'",
            path = variable_path,
            key = specific_key
        ),
    };

    let message = custom_message.map(lua_str);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.FILTER")),
    }
}

// ---------------------------------------------------------------------------
// change_text_variable
// ---------------------------------------------------------------------------

/// Change Text Variable: changes a text-type user variable.
pub fn change_text_variable(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let variable_name = get_str_default(effect, "variable_name", "textvar");
    let change_type = get_str_default(effect, "change_type", "custom_text");
    let custom_text = get_str_default(effect, "text", "");
    let key_var = get_str_default(effect, "key_variable", "keyvar");
    let custom_message = get_str(effect, "customMessage");

    let variable_path = ctx.user_var_path(&variable_name);
    let key_var_path = ctx.user_var_path(&key_var);
    let code = match change_type.as_str() {
        "key_var" => format!(
            "local all_key_lists = {{}}\n\
            for _, pool in pairs(G.P_CENTER_POOLS) do\n\
                for _, item in pairs(pool) do\n\
                    table.insert(all_key_lists, item)\n\
                end\n\
            end\n\
            for _, current_card in pairs(all_key_lists) do\n\
                if current_card.key == {kv_path} then\n\
                    if current_card.set == 'Seal' then\n\
                        {var_path} = current_card.key\n\
                    else\n\
                        {var_path} = current_card.name\n\
                    end\n\
                    break\n\
                end\n\
            end",
            var_path = variable_path,
            kv_path = key_var_path
        ),
        _ => format!("{path} = '{t}'", path = variable_path, t = custom_text),
    };

    let message = custom_message.map(lua_str);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.FILTER")),
    }
}

// ---------------------------------------------------------------------------
// change_rank_variable
// ---------------------------------------------------------------------------

/// Change Rank Variable: changes a rank-type user variable.
pub fn change_rank_variable(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let variable_name = get_str_default(effect, "variable_name", "rankvar");
    let change_type = get_str_default(effect, "change_type", "random");
    let specific_rank = get_str_default(effect, "specific_rank", "A");
    let custom_message = get_str(effect, "customMessage");

    let code = match change_type.as_str() {
        "random" => format!(
            "if G.playing_cards then\n\
                local valid_{v}_cards = {{}}\n\
                for _, v in ipairs(G.playing_cards) do\n\
                    if not SMODS.has_no_rank(v) then\n\
                        valid_{v}_cards[#valid_{v}_cards + 1] = v\n\
                    end\n\
                end\n\
                if valid_{v}_cards[1] then\n\
                    local {v}_card = pseudorandom_element(valid_{v}_cards, pseudoseed('{v}' .. G.GAME.round_resets.ante))\n\
                    G.GAME.current_round.{v}_card.rank = {v}_card.base.value\n\
                    G.GAME.current_round.{v}_card.id = {v}_card.base.id\n\
                end\n\
            end",
            v = variable_name
        ),
        "scored_card" | "destroyed_card" | "added_card" | "card_held_in_hand"
        | "discarded_card" => format!(
            "G.GAME.current_round.{v}_card.rank = context.other_card.base.id",
            v = variable_name
        ),
        _ => {
            let rank_id = rank_to_id(&specific_rank);
            format!(
                "G.GAME.current_round.{v}_card.rank = '{r}'\n\
                G.GAME.current_round.{v}_card.id = {id}",
                v = variable_name,
                r = specific_rank,
                id = rank_id
            )
        }
    };

    let message = custom_message.map(lua_str);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.FILTER")),
    }
}

// ---------------------------------------------------------------------------
// change_suit_variable
// ---------------------------------------------------------------------------

/// Change Suit Variable: changes a suit-type user variable.
pub fn change_suit_variable(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let variable_name = get_str_default(effect, "variable_name", "suitvar");
    let change_type = get_str_default(effect, "change_type", "random");
    let specific_suit = get_str_default(effect, "specific_suit", "Spades");
    let custom_message = get_str(effect, "customMessage");

    let code = match change_type.as_str() {
        "random" => format!(
            "if G.playing_cards then\n\
                local valid_{v}_cards = {{}}\n\
                for _, v in ipairs(G.playing_cards) do\n\
                    if not SMODS.has_no_suit(v) then\n\
                        valid_{v}_cards[#valid_{v}_cards + 1] = v\n\
                    end\n\
                end\n\
                if valid_{v}_cards[1] then\n\
                    local {v}_card = pseudorandom_element(valid_{v}_cards, pseudoseed('{v}' .. G.GAME.round_resets.ante))\n\
                    G.GAME.current_round.{v}_card.suit = {v}_card.base.suit\n\
                end\n\
            end",
            v = variable_name
        ),
        "scored_card" | "destroyed_card" | "added_card" | "card_held_in_hand"
        | "discarded_card" => format!(
            "G.GAME.current_round.{v}_card.suit = context.other_card.base.suit",
            v = variable_name
        ),
        _ => format!(
            "G.GAME.current_round.{v}_card.suit = '{s}'",
            v = variable_name,
            s = specific_suit
        ),
    };

    let message = custom_message.map(lua_str);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.FILTER")),
    }
}

// ---------------------------------------------------------------------------
// change_poker_hand_variable
// ---------------------------------------------------------------------------

/// Change Poker Hand Variable: changes a poker-hand-type user variable.
pub fn change_poker_hand_variable(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let variable_name = get_str_default(effect, "variable_name", "pokerhandvar");
    let change_type = get_str_default(effect, "change_type", "random");
    let specific = get_str_default(effect, "specific_pokerhand", "High Card");
    let custom_message = get_str(effect, "customMessage");

    let code = match change_type.as_str() {
        "random" => format!(
            "local {v}_hands = {{}}\n\
            for handname, _ in pairs(G.GAME.hands) do\n\
                if G.GAME.hands[handname].visible then\n\
                    {v}_hands[#{v}_hands + 1] = handname\n\
                end\n\
            end\n\
            if {v}_hands[1] then\n\
                G.GAME.current_round.{v}_hand = pseudorandom_element({v}_hands, pseudoseed('{v}' .. G.GAME.round_resets.ante))\n\
            end",
            v = variable_name
        ),
        "most_played" => format!(
            "local {v}_hand, {v}_tally = nil, 0\n\
            for k, v in ipairs(G.handlist) do\n\
                if G.GAME.hands[v].visible and G.GAME.hands[v].played > {v}_tally then\n\
                    {v}_hand = v\n\
                    {v}_tally = G.GAME.hands[v].played\n\
                end\n\
            end\n\
            if {v}_hand then\n\
                G.GAME.current_round.{v}_hand = {v}_hand\n\
            end",
            v = variable_name
        ),
        "least_played" => format!(
            "local {v}_hand, {v}_tally = nil, math.huge\n\
            for k, v in ipairs(G.handlist) do\n\
                if G.GAME.hands[v].visible and G.GAME.hands[v].played < {v}_tally then\n\
                    {v}_hand = v\n\
                    {v}_tally = G.GAME.hands[v].played\n\
                end\n\
            end\n\
            if {v}_hand then\n\
                G.GAME.current_round.{v}_hand = {v}_hand\n\
            end",
            v = variable_name
        ),
        _ => format!(
            "G.GAME.current_round.{v}_hand = '{h}'",
            v = variable_name,
            h = specific
        ),
    };

    let message = custom_message.map(lua_str);

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.FILTER")),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn rank_to_id(rank: &str) -> &'static str {
    match rank {
        "A" | "Ace" => "14",
        "K" | "King" => "13",
        "Q" | "Queen" => "12",
        "J" | "Jack" => "11",
        "10" => "10",
        "9" => "9",
        "8" => "8",
        "7" => "7",
        "6" => "6",
        "5" => "5",
        "4" => "4",
        "3" => "3",
        "2" => "2",
        _ => "14",
    }
}
