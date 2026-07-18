use crate::compiler::context::CompileContext;
use crate::compiler::effects::utils::is_literal_one_param;
use crate::compiler::effects::EffectOutput;
use crate::lua_ast::*;
use crate::types::EffectDef;

/// Create Joker effect: spawns a joker card.
///
/// This is one of the more complex effects: it needs pre-return code for
/// the event manager, handles slot limits, editions: and stickers.
pub fn create_joker(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let joker_type = get_str_param_any(effect, &["joker_type", "jokerType"]).unwrap_or("random");
    let rarity = get_str_param(effect, "rarity").unwrap_or("random");
    let edition = get_str_param(effect, "edition");
    let sticker = get_str_param(effect, "sticker");
    let ignore_slots = get_bool_param(effect, "ignoreSlots")
        || matches!(
            get_str_param(effect, "ignore_slots"),
            Some("ignore" | "true" | "yes")
        );

    let mut card_params = Vec::new();
    let pool = get_str_param(effect, "pool").unwrap_or("").trim();
    if joker_type == "pool" && !pool.is_empty() {
        card_params.push(format!(
            "set = '{}'",
            lua_escape(&normalize_pool_key(pool, &ctx.mod_prefix))
        ));
    } else {
        card_params.push("set = 'Joker'".to_string());
    }

    if joker_type == "specific" {
        if let Some(key) = get_str_param_any(effect, &["joker_key", "jokerKey"]) {
            let key = normalize_joker_key(key);
            card_params.push(format!("key = '{}'", lua_escape(&key)));
        }
    } else if joker_type != "pool" {
        let rarity = if matches!(joker_type, "common" | "uncommon" | "rare" | "legendary") {
            joker_type
        } else {
            rarity
        };
        if let Some(rarity) = normalize_joker_rarity(rarity, &ctx.mod_prefix) {
            card_params.push(format!("rarity = '{}'", lua_escape(&rarity)));
        }
    }

    if let Some(ed) = edition {
        if let Some(normalized) = edition_payload_key(ed, &ctx.mod_prefix) {
            card_params.push(format!("edition = '{}'", lua_escape(&normalized)));
        }
    }

    if let Some(st) = sticker {
        if !st.is_empty() && st != "none" {
            card_params.push(format!("stickers = {{ '{}' }}", lua_escape(st)));
            card_params.push("force_stickers = true".to_string());
        }
    }

    let is_negative = edition.map(is_negative_edition).unwrap_or(false);
    let bypass_slot_check = ignore_slots || is_negative;
    let payload = card_params.join(", ");
    let slot_open = if bypass_slot_check {
        "local created_joker = true".to_string()
    } else {
        "local created_joker = false\nif G.jokers and G.jokers.cards and G.jokers.config and #G.jokers.cards + (G.GAME.joker_buffer or 0) < G.jokers.config.card_limit then\n    created_joker = true\n    G.GAME.joker_buffer = (G.GAME.joker_buffer or 0) + 1".to_string()
    };
    let slot_close = if bypass_slot_check {
        String::new()
    } else {
        "\nend".to_string()
    };
    let buffer_reset = if bypass_slot_check {
        ""
    } else {
        "\n            G.GAME.joker_buffer = math.max(0, (G.GAME.joker_buffer or 1) - 1)"
    };

    let pre_return = vec![lua_raw_stmt(format!(
        "{slot_open}\n\
        G.E_MANAGER:add_event(Event({{\n\
            func = function()\n\
                local joker_card = SMODS.add_card({{ {payload} }}){buffer_reset}\n\
                return true\n\
            end\n\
        }})){slot_close}",
    ))];

    // Message for the return
    let message = Some(lua_and(
        lua_ident("created_joker"),
        lua_call("localize", vec![lua_str("k_plus_joker")]),
    ));

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
    let edition = get_typed_str_param(effect, "edition").unwrap_or_else(|| {
        if get_typed_str_param(effect, "is_negative")
            .map(|v| v == "y" || v == "negative" || v == "true")
            .unwrap_or(false)
        {
            "e_negative".to_string()
        } else {
            "none".to_string()
        }
    });
    let is_negative = is_negative_edition(&edition);
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
    let has_set_var =
        set_mode == "keyvar" && !key_variable.is_empty() && ctx.has_user_var(&key_variable);
    let has_random_set = set_mode == "random";
    let has_specific_key = !specific_card.is_empty()
        && specific_card != "random"
        && !specific_card.starts_with("random_set:");
    let has_random_set_override = specific_card.starts_with("random_set:");

    let mut payload_parts: Vec<String> = vec!["area = G.consumeables".to_string()];
    if let Some(edition_payload) =
        edition_payload_entry(&edition, "create_consumable_edition", &ctx.mod_prefix)
    {
        payload_parts.push(edition_payload);
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
        if let Some(edition_payload) =
            edition_payload_entry(&edition, "create_consumable_edition", &ctx.mod_prefix)
        {
            dyn_payload_parts.push(edition_payload);
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

fn get_str_param_any<'a>(effect: &'a EffectDef, keys: &[&str]) -> Option<&'a str> {
    keys.iter().find_map(|key| get_str_param(effect, key))
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

fn normalize_pool_key(pool: &str, mod_prefix: &str) -> String {
    let pool = pool.trim();
    let mod_prefix = mod_prefix.trim();
    if mod_prefix.is_empty() || pool.starts_with(&format!("{}_", mod_prefix)) {
        pool.to_string()
    } else {
        format!("{}_{}", mod_prefix, pool)
    }
}

fn normalize_joker_rarity(rarity: &str, mod_prefix: &str) -> Option<String> {
    match rarity {
        "" | "random" | "any" => None,
        "1" | "common" | "Common" => Some("Common".to_string()),
        "2" | "uncommon" | "Uncommon" => Some("Uncommon".to_string()),
        "3" | "rare" | "Rare" => Some("Rare".to_string()),
        "4" | "legendary" | "Legendary" => Some("Legendary".to_string()),
        other if mod_prefix.is_empty() || other.starts_with(&format!("{}_", mod_prefix)) => {
            Some(other.to_string())
        }
        other => Some(format!("{}_{}", mod_prefix, other)),
    }
}

fn is_negative_edition(edition: &str) -> bool {
    matches!(edition, "e_negative" | "negative" | "y" | "true")
}

fn edition_payload_key(edition: &str, mod_prefix: &str) -> Option<String> {
    if edition.is_empty() || edition == "none" {
        return None;
    }
    Some(normalize_edition_key(edition, mod_prefix))
}

fn lua_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
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

fn edition_payload_entry(edition: &str, seed: &str, mod_prefix: &str) -> Option<String> {
    if edition.is_empty() || edition == "none" {
        return None;
    }

    if edition == "random" {
        return Some(format!(
            "edition = SMODS.poll_edition({{ key = '{}', no_negative = true, guaranteed = true }})",
            seed
        ));
    }

    Some(format!(
        "edition = '{}'",
        normalize_edition_key(edition, mod_prefix).replace('\'', "\\'")
    ))
}

/// Copy Selected Cards effect: duplicates the highlighted playing cards.
pub fn copy_selected_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let enhancement = get_str_param(effect, "enhancement").unwrap_or("none");
    let seal = get_str_param(effect, "seal").unwrap_or("none");
    let edition = get_str_param(effect, "edition").unwrap_or("none");
    let message = get_str_param(effect, "customMessage").map(|s| s.to_string());

    let copies = crate::compiler::values::resolve_config_value(
        &effect.params,
        "copies",
        ctx,
        "copy_cards_amount",
    );

    let mut modifications = String::new();
    match enhancement {
        "none" => {}
        "random" => modifications.push_str(
            "\n                        local cen_pool = {}\
             \n                        for _, enhancement_center in pairs(G.P_CENTER_POOLS['Enhanced']) do\
             \n                            if enhancement_center.key ~= 'm_stone' then\
             \n                                cen_pool[#cen_pool + 1] = enhancement_center\
             \n                            end\
             \n                        end\
             \n                        copied_card:set_ability(pseudorandom_element(cen_pool, 'copy_cards_enhancement'))",
        ),
        specific => modifications.push_str(&format!(
            "\n                        copied_card:set_ability(G.P_CENTERS['{}'])",
            specific
        )),
    }
    match seal {
        "none" => {}
        "random" => modifications.push_str(
            "\n                        copied_card:set_seal(SMODS.poll_seal({ key = 'copy_cards_seal', guaranteed = true }), nil, true)",
        ),
        specific => modifications.push_str(&format!(
            "\n                        copied_card:set_seal('{}', nil, true)",
            specific
        )),
    }
    match edition {
        "none" => {}
        "remove" => modifications
            .push_str("\n                        copied_card:set_edition(nil, true)"),
        "random" => modifications.push_str(
            "\n                        copied_card:set_edition(SMODS.poll_edition({ key = 'copy_cards_edition', no_negative = true, guaranteed = true }), true)",
        ),
        specific => modifications.push_str(&format!(
            "\n                        copied_card:set_edition('{}', true)",
            normalize_edition_key(specific, &ctx.mod_prefix)
        )),
    }

    let code = format!(
        "G.E_MANAGER:add_event(Event({{\
         \n    func = function()\
         \n        local _first_materialize = nil\
         \n        local new_cards = {{}}\
         \n        for _, selected_card in pairs(G.hand.highlighted) do\
         \n            for i = 1, {copies} do\
         \n                G.playing_card = (G.playing_card and G.playing_card + 1) or 1\
         \n                local copied_card = copy_card(selected_card, nil, nil, G.playing_card)\
         \n                copied_card:add_to_deck()\
         \n                G.deck.config.card_limit = G.deck.config.card_limit + 1\
         \n                table.insert(G.playing_cards, copied_card)\
         \n                G.hand:emplace(copied_card)\
         \n                copied_card:start_materialize(nil, _first_materialize)\
         \n                _first_materialize = true\
         \n                new_cards[#new_cards + 1] = copied_card{mods}\
         \n            end\
         \n        end\
         \n        SMODS.calculate_context({{ playing_card_added = true, cards = new_cards }})\
         \n        return true\
         \n    end\
         \n}}))\
         \ndelay(0.6)",
        copies = copies.lua_str,
        mods = modifications
    );

    EffectOutput {
        return_fields: vec![],
        pre_return: vec![lua_raw_stmt(code)],
        config_vars: vec![],
        message: message.map(lua_str),
        colour: Some(lua_raw_expr("G.C.SECONDARY_SET.Spectral")),
        segment_id: None,
    }
}
