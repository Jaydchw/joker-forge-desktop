use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::compiler::effects::utils::is_literal_one_param;
use crate::lua_ast::*;
use crate::types::EffectDef;

/// Create Joker effect: spawns a joker card.
///
/// This is one of the more complex effects: it needs pre-return code for
/// the event manager, handles slot limits, editions: and stickers.
pub fn create_joker(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let joker_type = get_str_param(effect, "jokerType").unwrap_or("random");
    let edition = get_str_param(effect, "edition");
    let sticker = get_str_param(effect, "sticker");
    let ignore_slots = get_bool_param(effect, "ignoreSlots");

    // Build SMODS.add_card payload using native SMODS fields.
    let mut add_card_entries = vec![TableEntry::KeyValue("set".to_string(), lua_str("Joker"))];

    match joker_type {
        "specific" => {
            if let Some(key) = get_str_param(effect, "jokerKey") {
                let key = normalize_joker_key(key);
                add_card_entries.push(TableEntry::KeyValue("key".to_string(), lua_str(key)));
            }
        }
        "pool" => {
            if let Some(pool) = get_str_param(effect, "pool") {
                add_card_entries.push(TableEntry::KeyValue("set".to_string(), lua_str(pool)));
            }
        }
        "common" | "uncommon" | "rare" | "legendary" => {
            add_card_entries.push(TableEntry::KeyValue(
                "rarity".to_string(),
                lua_str(joker_type),
            ));
        }
        _ => {} // "random" , no extra params
    }

    if let Some(ed) = edition {
        if !ed.is_empty() && ed != "none" {
            let normalized = if ed.starts_with("e_") {
                ed.to_string()
            } else {
                format!("e_{}", ed)
            };
            add_card_entries.push(TableEntry::KeyValue("edition".to_string(), lua_str(normalized)));
        }
    }

    if let Some(st) = sticker {
        if !st.is_empty() && st != "none" {
            add_card_entries.push(TableEntry::KeyValue(
                "stickers".to_string(),
                lua_table_raw(vec![TableEntry::Value(lua_str(st))]),
            ));
            add_card_entries.push(TableEntry::KeyValue(
                "force_stickers".to_string(),
                lua_table_raw(vec![TableEntry::Value(lua_str(st))]),
            ));
        }
    }

    // Build the event body (actual spawn happens asynchronously via event queue).
    let event_body: Vec<Stmt> = vec![
        lua_expr_stmt(lua_call(
            "SMODS.add_card",
            vec![lua_table_raw(add_card_entries)],
        )),
        lua_return(lua_bool(true)),
    ];

    // Wrap in G.E_MANAGER:add_event(Event({...}))
    let event_func = Expr::Function {
        params: vec![],
        body: event_body,
    };

    let event_call = lua_expr_stmt(lua_method(
        lua_path(&["G", "E_MANAGER"]),
        "add_event",
        vec![lua_call(
            "Event",
            vec![lua_table_raw(vec![TableEntry::KeyValue(
                "func".to_string(),
                event_func,
            )])],
        )],
    ));

    // Emit a synchronous created_joker flag so return message logic is valid.
    let has_slot_check = !ignore_slots;
    let mut pre_return: Vec<Stmt> = Vec::new();
    if has_slot_check {
        pre_return.push(lua_local("created_joker", lua_bool(false)));
        pre_return.push(lua_if(
            lua_lt(
                lua_add(
                    lua_len(lua_path(&["G", "jokers", "cards"])),
                    lua_path(&["G", "GAME", "joker_buffer"]),
                ),
                lua_path(&["G", "jokers", "config", "card_limit"]),
            ),
            vec![
                lua_assign(lua_ident("created_joker"), lua_bool(true)),
                event_call,
            ],
        ));
    } else {
        pre_return.push(lua_local("created_joker", lua_bool(true)));
        pre_return.push(event_call);
    }

    // Message for the return
    let message = if has_slot_check {
        Some(lua_and(
            lua_ident("created_joker"),
            lua_call("localize", vec![lua_str("k_plus_joker")]),
        ))
    } else {
        Some(lua_call("localize", vec![lua_str("k_plus_joker")]))
    };

    EffectOutput {
        return_fields: vec![],
        pre_return,
        config_vars: vec![],
        message,
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Create Consumable effect: spawns a consumable card.
pub fn create_consumable(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let set_mode = get_typed_str_param(effect, "set")
        .or_else(|| get_typed_str_param(effect, "consumableType"))
        .unwrap_or_else(|| "random".to_string());
    let key_variable = get_typed_str_param(effect, "variable")
        .or_else(|| get_typed_str_param(effect, "consumableVariable"))
        .unwrap_or_default();
    let specific_card = get_typed_str_param(effect, "specific_card")
        .or_else(|| get_typed_str_param(effect, "consumableKey"))
        .unwrap_or_else(|| "random".to_string());
    let is_negative = get_typed_str_param(effect, "is_negative")
        .map(|v| v == "y" || v == "negative" || v == "true")
        .unwrap_or(false);
    let soulable = get_typed_str_param(effect, "soulable")
        .map(|v| v == "y" || v == "true")
        .unwrap_or(false);
    let ignore_slots = get_typed_str_param(effect, "ignore_slots")
        .map(|v| v == "y" || v == "true")
        .unwrap_or(false);
    let count = crate::compiler::values::resolve_config_value(
        &effect.params,
        "count",
        ctx,
        "create_consumable_count",
    )
    .lua_str;

    let slot_guard = !ignore_slots && !is_negative;
    let has_set_var = set_mode == "keyvar" && !key_variable.is_empty() && ctx.has_user_var(&key_variable);
    let has_random_set = set_mode == "random";
    let has_specific_key = !specific_card.is_empty()
        && specific_card != "random"
        && !specific_card.starts_with("random_set:");
    let has_random_set_override = specific_card.starts_with("random_set:");

    let mut payload_parts: Vec<String> = vec!["area = G.consumeables".to_string()];
    if is_negative {
        payload_parts.push("edition = 'e_negative'".to_string());
    }
    if soulable {
        payload_parts.push("soulable = true".to_string());
    }
    if has_specific_key {
        payload_parts.push(format!("key = '{}'", specific_card.replace('\'', "\\'")));
    }
    if !has_set_var && !has_random_set && !has_random_set_override && !set_mode.is_empty() {
        payload_parts.push(format!("set = '{}'", set_mode.replace('\'', "\\'")));
    }
    let base_payload = format!("{{ {} }}", payload_parts.join(", "));

    let add_stmt = if !has_set_var && !has_random_set && !has_random_set_override {
        format!("SMODS.add_card({})", base_payload)
    } else {
        let set_expr = if has_set_var {
            ctx.user_var_path(&key_variable)
        } else if has_random_set_override {
            format!("'{}'", specific_card[11..].replace('\'', "\\'"))
        } else {
            "pseudorandom_element({'Tarot', 'Planet', 'Spectral'}, pseudoseed('create_consumable_set'))"
                .to_string()
        };
        let mut dyn_payload_parts: Vec<String> = vec![
            "area = G.consumeables".to_string(),
            format!("set = {}", set_expr),
        ];
        if is_negative {
            dyn_payload_parts.push("edition = 'e_negative'".to_string());
        }
        if soulable {
            dyn_payload_parts.push("soulable = true".to_string());
        }
        if has_specific_key {
            dyn_payload_parts.push(format!("key = '{}'", specific_card.replace('\'', "\\'")));
        }
        format!("SMODS.add_card({{ {} }})", dyn_payload_parts.join(", "))
    };

    let add_stmt = if slot_guard {
        format!(
            "if #G.consumeables.cards + (G.GAME.consumeable_buffer or 0) < G.consumeables.config.card_limit then {} end",
            add_stmt
        )
    } else {
        add_stmt
    };

    let lua = if is_literal_one_param(effect, "count") {
        add_stmt
    } else {
        format!("for _ = 1, {} do {} end", count, add_stmt)
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(lua_call("localize", vec![lua_str("k_plus_consumable")])),
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Create Playing Card effect: adds a single base playing card.
pub fn create_playing_card(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let target = get_str_param(effect, "location").unwrap_or("deck");
    let message = get_str_param(effect, "customMessage").unwrap_or("Added Card!");

    let pre = if target == "hand" {
        vec![lua_raw_stmt(
            "local c = SMODS.add_card({ set = 'Base' }); if c and G.hand then G.hand:emplace(c) end",
        )]
    } else {
        vec![lua_raw_stmt("SMODS.add_card({ set = 'Base' })")]
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: pre,
        config_vars: vec![],
        message: Some(lua_str(message)),
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Create Playing Cards effect: adds multiple base playing cards.
pub fn create_playing_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let resolved = crate::compiler::values::resolve_config_value(
        &effect.params,
        "count",
        ctx,
        "create_cards_count",
    );

    let pre = if is_literal_one_param(effect, "count") {
        vec![lua_raw_stmt("SMODS.add_card({ set = 'Base' })")]
    } else {
        vec![lua_raw_stmt(format!(
            "for _ = 1, {} do SMODS.add_card({{ set = 'Base' }}) end",
            resolved.lua_str
        ))]
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: pre,
        config_vars: vec![],
        message: Some(lua_str("Added Cards!")),
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Create Tag effect: creates a random or specific tag.
pub fn create_tag(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let mode = get_str_param(effect, "tag_type").unwrap_or("random");
    let specific = get_str_param(effect, "specific_tag").unwrap_or("tag_double");

    let stmt = if mode == "random" {
        lua_raw_stmt(
            "local selected_tag = pseudorandom_element(G.P_TAGS, pseudoseed('create_tag')).key; local tag = Tag(selected_tag); tag:set_ability(); add_tag(tag)",
        )
    } else {
        lua_raw_stmt(format!(
            "local tag = Tag('{}'); tag:set_ability(); add_tag(tag)",
            specific
        ))
    };

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![stmt],
        config_vars: vec![],
        message: Some(lua_str("Created Tag!")),
        colour: Some(lua_raw_expr("G.C.GREEN")),
    
        segment_id: None,
    }
}

/// Create Copy Triggered Card: copies the card that triggered this joker (context.other_card).
///
/// `add_to` controls whether the copy goes to "deck" (default) or "hand".
/// Trigger-aware: scoring triggers use pre_return; others use func return field.
pub fn create_copy_triggered_card(
    effect: &EffectDef,
    _ctx: &mut CompileContext,
    trigger: &str,
) -> EffectOutput {
    let add_to = get_str_param(effect, "add_to").unwrap_or("deck");
    let custom_message = get_str_param(effect, "customMessage");
    let scoring = matches!(trigger, "hand_played" | "card_scored");

    let visibility_or_effects = if add_to == "hand" {
        "copied_card.states.visible = nil"
    } else {
        "playing_card_joker_effects({true})"
    };

    let core = format!(
        "G.playing_card = (G.playing_card and G.playing_card + 1) or 1\n\
        local copied_card = copy_card(context.other_card, nil, nil, G.playing_card)\n\
        copied_card:add_to_deck()\n\
        G.deck.config.card_limit = G.deck.config.card_limit + 1\n\
        table.insert(G.playing_cards, copied_card)\n\
        G.hand:emplace(copied_card)\n\
        {vis}\n\
        G.E_MANAGER:add_event(Event({{\n\
            func = function()\n\
                copied_card:start_materialize()\n\
                return true\n\
            end\n\
        }}))",
        vis = visibility_or_effects
    );

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Copied Card to Hand!"));

    if scoring {
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![lua_raw_stmt(core)],
            config_vars: vec![],
            message: Some(message),
            colour: Some(lua_raw_expr("G.C.GREEN")),
        
        segment_id: None,
        }
    } else {
        let non_scoring_body = format!(
            "{core}\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    SMODS.calculate_context({{ playing_card_added = true, cards = {{ copied_card }} }})\n\
                    return true\n\
                end\n\
            }}))\n\
            return true",
            core = core
        );
        EffectOutput {
            return_fields: vec![(
                "func".to_string(),
                Expr::Function {
                    params: vec![],
                    body: vec![lua_raw_stmt(non_scoring_body)],
                },
            )],
            pre_return: vec![],
            config_vars: vec![],
            message: Some(message),
            colour: Some(lua_raw_expr("G.C.GREEN")),
        
        segment_id: None,
        }
    }
}

/// Create Copy Played Card: copies cards from context.full_hand based on filters.
///
/// Supports filtering by `card_index` (position), `card_rank`: and `card_suit`.
/// `add_to` controls "deck" (default) or "hand" destination.
/// Trigger-aware: scoring triggers use pre_return; others use func return field.
pub fn create_copy_played_card(
    effect: &EffectDef,
    _ctx: &mut CompileContext,
    trigger: &str,
) -> EffectOutput {
    let add_to = get_str_param(effect, "add_to").unwrap_or("deck");
    let card_index = get_typed_str_param(effect, "card_index").unwrap_or_else(|| "any".into());
    let card_rank = get_typed_str_param(effect, "card_rank").unwrap_or_else(|| "any".into());
    let card_suit = get_typed_str_param(effect, "card_suit").unwrap_or_else(|| "any".into());
    let custom_message = get_str_param(effect, "customMessage");
    let scoring = matches!(trigger, "hand_played" | "card_scored");

    let selection = build_card_selection(&card_index, &card_rank, &card_suit);

    let visibility_or_effects = if add_to == "hand" {
        "copied_card.states.visible = nil"
    } else {
        "playing_card_joker_effects({true})"
    };

    let copy_loop = format!(
        "{selection}\n\
        for i, source_card in ipairs(cards_to_copy) do\n\
            G.playing_card = (G.playing_card and G.playing_card + 1) or 1\n\
            local copied_card = copy_card(source_card, nil, nil, G.playing_card)\n\
            copied_card:add_to_deck()\n\
            G.deck.config.card_limit = G.deck.config.card_limit + 1\n\
            table.insert(G.playing_cards, copied_card)\n\
            G.hand:emplace(copied_card)\n\
            {vis}\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    copied_card:start_materialize()\n\
                    return true\n\
                end\n\
            }}))\n\
        end",
        selection = selection,
        vis = visibility_or_effects
    );

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_str("Copied Cards to Hand!"));

    if scoring {
        EffectOutput {
            return_fields: vec![],
            pre_return: vec![lua_raw_stmt(copy_loop)],
            config_vars: vec![],
            message: Some(message),
            colour: Some(lua_raw_expr("G.C.GREEN")),
        
        segment_id: None,
        }
    } else {
        let non_scoring_body = format!(
            "{loop}\n\
            G.E_MANAGER:add_event(Event({{\n\
                func = function()\n\
                    SMODS.calculate_context({{ playing_card_added = true, cards = cards_to_copy }})\n\
                    return true\n\
                end\n\
            }}))\n\
            return true",
            loop = copy_loop
        );
        EffectOutput {
            return_fields: vec![(
                "func".to_string(),
                Expr::Function {
                    params: vec![],
                    body: vec![lua_raw_stmt(non_scoring_body)],
                },
            )],
            pre_return: vec![],
            config_vars: vec![],
            message: Some(message),
            colour: Some(lua_raw_expr("G.C.GREEN")),
        
        segment_id: None,
        }
    }
}

/// Create Last Played Planet: spawns the planet card for the last hand played.
///
/// Searches `G.P_CENTER_POOLS.Planet` for a planet whose `config.hand_type`
/// matches `G.GAME.last_hand_played`: then calls `SMODS.add_card`.
/// Optional `is_negative` param makes the resulting card negative edition.
pub fn create_last_played_planet(effect: &EffectDef, _ctx: &mut CompileContext) -> EffectOutput {
    let is_negative = get_str_param(effect, "is_negative")
        .map(|s| s == "negative")
        .unwrap_or(false);
    let custom_message = get_str_param(effect, "customMessage");

    let buffer_code = if is_negative {
        ""
    } else {
        "G.GAME.consumeable_buffer = G.GAME.consumeable_buffer + 1\n            "
    };
    let buffer_reset = if is_negative {
        ""
    } else {
        "\n                        G.GAME.consumeable_buffer = 0"
    };
    let negative_code = if is_negative {
        "\n                        planet_card:set_edition(\"e_negative\", true)"
    } else {
        ""
    };

    let lua = format!(
        "{buf}G.E_MANAGER:add_event(Event({{\n\
            trigger = 'before',\n\
            delay = 0.0,\n\
            func = function()\n\
                if G.GAME.last_hand_played then\n\
                    local _planet = nil\n\
                    for k, v in pairs(G.P_CENTER_POOLS.Planet) do\n\
                        if v.config.hand_type == G.GAME.last_hand_played then\n\
                            _planet = v.key\n\
                        end\n\
                    end\n\
                    if _planet then\n\
                        local planet_card = SMODS.add_card({{ key = _planet }}){neg}\n\
                    end{reset}\n\
                end\n\
                return true\n\
            end\n\
        }}))",
        buf = buffer_code,
        neg = negative_code,
        reset = buffer_reset,
    );

    let message = custom_message
        .map(lua_str)
        .unwrap_or_else(|| lua_raw_expr("localize('k_plus_planet')"));

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(lua)],
        config_vars: vec![],
        message: Some(message),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Planet")),
    
        segment_id: None,
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Returns the string value of a param: supporting both plain strings and
/// TypedValue (e.g. userVariable) whose value is a string.
fn get_typed_str_param(effect: &EffectDef, key: &str) -> Option<String> {
    use crate::types::ParamValue;
    match effect.params.get(key)? {
        ParamValue::Str(s) => Some(s.clone()),
        ParamValue::Typed(t) => t.value.as_str().map(str::to_owned),
        _ => None,
    }
}

/// Build Lua card selection code for `create_copy_played_card`.
///
/// Returns a Lua snippet that declares `local cards_to_copy = {}` and populates
/// it from `context.full_hand` according to position, rank: and suit filters.
fn build_card_selection(card_index: &str, card_rank: &str, card_suit: &str) -> String {
    // Build filter conditions
    let mut conditions: Vec<String> = Vec::new();

    if card_rank != "any" {
        let rank_id = rank_to_id(card_rank);
        conditions.push(format!("c:get_id() == {}", rank_id));
    }

    if card_suit != "any" {
        conditions.push(format!("c:is_suit(\"{}\")", card_suit));
    }

    if card_index == "any" {
        if conditions.is_empty() {
            "local cards_to_copy = {}\n\
            for i, c in ipairs(context.full_hand) do\n\
                table.insert(cards_to_copy, c)\n\
            end"
            .to_string()
        } else {
            format!(
                "local cards_to_copy = {{}}\n\
                for i, c in ipairs(context.full_hand) do\n\
                    if {cond} then\n\
                        table.insert(cards_to_copy, c)\n\
                    end\n\
                end",
                cond = conditions.join(" and ")
            )
        }
    } else if conditions.is_empty() {
        format!(
            "local cards_to_copy = {{}}\n\
            local target_index = {idx}\n\
            if context.full_hand[target_index] then\n\
                table.insert(cards_to_copy, context.full_hand[target_index])\n\
            end",
            idx = card_index
        )
    } else {
        format!(
            "local cards_to_copy = {{}}\n\
            local target_index = {idx}\n\
            if context.full_hand[target_index] then\n\
                local c = context.full_hand[target_index]\n\
                if {cond} then\n\
                    table.insert(cards_to_copy, c)\n\
                end\n\
            end",
            idx = card_index,
            cond = conditions.join(" and ")
        )
    }
}

/// Map a rank string to its Balatro numeric ID.
fn rank_to_id(rank: &str) -> String {
    match rank {
        "2" => "2".into(),
        "3" => "3".into(),
        "4" => "4".into(),
        "5" => "5".into(),
        "6" => "6".into(),
        "7" => "7".into(),
        "8" => "8".into(),
        "9" => "9".into(),
        "10" => "10".into(),
        "J" => "11".into(),
        "Q" => "12".into(),
        "K" => "13".into(),
        "A" => "14".into(),
        other => other.to_string(),
    }
}

fn get_str_param<'a>(effect: &'a EffectDef, key: &str) -> Option<&'a str> {
    effect.params.get(key).and_then(|v| v.as_str())
}

fn get_bool_param(effect: &EffectDef, key: &str) -> bool {
    effect
        .params
        .get(key)
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

fn normalize_joker_key(key: &str) -> String {
    if key.starts_with("j_") {
        key.to_string()
    } else {
        format!("j_{}", key)
    }
}
