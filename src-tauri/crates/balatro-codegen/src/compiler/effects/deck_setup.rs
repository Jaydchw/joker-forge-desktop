use crate::compiler::context::CompileContext;
use crate::compiler::effects::EffectOutput;
use crate::lua_ast::*;
use crate::types::{EffectDef, ParamValue};

const RANK_POOL_ORDER: [&str; 13] = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];
const SUIT_POOL_ORDER: [&str; 4] = ["Spades", "Hearts", "Diamonds", "Clubs"];

fn get_str<'a>(effect: &'a EffectDef, key: &str) -> Option<&'a str> {
    effect
        .params
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// Full SMODS.Ranks key for a rank given as card_key, display name or key.
fn full_rank_key(rank: &str) -> String {
    match rank {
        "A" | "Ace" => "Ace".to_string(),
        "K" | "King" => "King".to_string(),
        "Q" | "Queen" => "Queen".to_string(),
        "J" | "Jack" => "Jack".to_string(),
        other => other.to_string(),
    }
}

/// Read a checkbox pool param into quoted Lua entries. Supports boolean
/// arrays (zipped against the canonical option order) and string arrays.
fn pool_entries(effect: &EffectDef, key: &str, order: &[&str]) -> Vec<String> {
    let values = match effect.params.get(key) {
        Some(ParamValue::Typed(t)) => t.value.as_array().cloned().unwrap_or_default(),
        _ => return Vec::new(),
    };

    let mut out = Vec::new();
    for (i, v) in values.iter().enumerate() {
        if let Some(flag) = v.as_bool() {
            if flag {
                if let Some(name) = order.get(i) {
                    out.push(format!("'{}'", name));
                }
            }
        } else if let Some(s) = v.as_str() {
            out.push(format!("'{}'", s));
        }
    }
    out
}

fn run_start_event(body: &str) -> Stmt {
    lua_raw_stmt(format!(
        "G.E_MANAGER:add_event(Event({{\n    func = function()\n{}\n        G.GAME.starting_deck_size = #G.playing_cards\n        return true\n    end\n}}))",
        body
    ))
}

fn deck_output(stmts: Vec<Stmt>, colour: &str) -> EffectOutput {
    EffectOutput {
        return_fields: vec![],
        pre_return: stmts,
        config_vars: vec![],
        message: None,
        colour: Some(lua_raw_expr(colour)),
        segment_id: None,
    }
}

/// Edit Starting Dollars: modify starting money in the deck apply hook.
pub fn edit_starting_dollars(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let operation = get_str(effect, "operation").unwrap_or("add");
    let value = crate::compiler::values::resolve_config_value(
        &effect.params,
        "value",
        ctx,
        "starting_dollars",
    );

    let code = match operation {
        "subtract" => format!(
            "G.GAME.starting_params.dollars = G.GAME.starting_params.dollars - {}",
            value.lua_str
        ),
        "set" => format!("G.GAME.starting_params.dollars = {}", value.lua_str),
        _ => format!(
            "G.GAME.starting_params.dollars = G.GAME.starting_params.dollars + {}",
            value.lua_str
        ),
    };

    deck_output(vec![lua_raw_stmt(code)], "G.C.MONEY")
}

/// Add Starting Cards: create new playing cards at run start.
pub fn add_starting_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let rank = get_str(effect, "rank").unwrap_or("random");
    let suit = get_str(effect, "suit").unwrap_or("none");
    let enhancement = get_str(effect, "enhancement").unwrap_or("none");
    let seal = get_str(effect, "seal").unwrap_or("none");
    let edition = get_str(effect, "edition").unwrap_or("none");
    let count = crate::compiler::values::resolve_config_value(
        &effect.params,
        "count",
        ctx,
        "add_starting_cards_count",
    );

    let mut body = String::new();
    body.push_str("        local cards = {}\n");
    body.push_str(&format!("        for i = 1, {} do\n", count.lua_str));

    match rank {
        "random" => body.push_str(
            "            local _rank = pseudorandom_element(SMODS.Ranks, 'add_random_rank').card_key\n",
        ),
        "pool" => {
            let pool = pool_entries(effect, "rank_pool", &RANK_POOL_ORDER);
            let pool = if pool.is_empty() {
                RANK_POOL_ORDER
                    .iter()
                    .map(|r| format!("'{}'", r))
                    .collect::<Vec<_>>()
            } else {
                pool
            };
            body.push_str(&format!(
                "            local rank_pool = {{{}}}\n            local _rank = pseudorandom_element(rank_pool, 'add_rank_pool')\n",
                pool.join(", ")
            ));
        }
        specific => body.push_str(&format!("            local _rank = '{}'\n", specific)),
    }

    match suit {
        "none" | "random" => body.push_str(
            "            local _suit = pseudorandom_element(SMODS.Suits, 'add_random_suit').key\n",
        ),
        "pool" => {
            let pool = pool_entries(effect, "suit_pool", &SUIT_POOL_ORDER);
            let pool = if pool.is_empty() {
                SUIT_POOL_ORDER
                    .iter()
                    .map(|s| format!("'{}'", s))
                    .collect::<Vec<_>>()
            } else {
                pool
            };
            body.push_str(&format!(
                "            local suit_pool = {{{}}}\n            local _suit = pseudorandom_element(suit_pool, 'add_suit_pool')\n",
                pool.join(", ")
            ));
        }
        specific => body.push_str(&format!("            local _suit = '{}'\n", specific)),
    }

    body.push_str("            local new_card_params = { set = 'Base', area = G.deck, rank = _rank, suit = _suit }\n");

    match enhancement {
        "none" => {}
        "random" => body.push_str(
            "            local cen_pool = {}\n            for _, enhancement_center in pairs(G.P_CENTER_POOLS['Enhanced']) do\n                if enhancement_center.key ~= 'm_stone' and not enhancement_center.overrides_base_rank then\n                    cen_pool[#cen_pool + 1] = enhancement_center\n                end\n            end\n            new_card_params.enhancement = pseudorandom_element(cen_pool, 'add_cards_enhancement').key\n",
        ),
        specific => body.push_str(&format!(
            "            new_card_params.enhancement = '{}'\n",
            specific
        )),
    }

    body.push_str("            cards[i] = SMODS.add_card(new_card_params)\n");

    match seal {
        "none" => {}
        "random" => body.push_str(
            "            if cards[i] then\n                cards[i]:set_seal(SMODS.poll_seal({ key = 'add_cards_seal', guaranteed = true }), true, true)\n            end\n",
        ),
        specific => body.push_str(&format!(
            "            if cards[i] then\n                cards[i]:set_seal('{}', true, true)\n            end\n",
            specific
        )),
    }

    match edition {
        "none" => {}
        "random" => body.push_str(
            "            if cards[i] then\n                cards[i]:set_edition(SMODS.poll_edition({ key = 'add_cards_edition', no_negative = true, guaranteed = true }), true)\n            end\n",
        ),
        specific => body.push_str(&format!(
            "            if cards[i] then\n                cards[i]:set_edition('{}', true)\n            end\n",
            edition_key(specific, &ctx.mod_prefix)
        )),
    }

    body.push_str("        end\n        SMODS.calculate_context({ playing_card_added = true, cards = cards })");

    deck_output(vec![run_start_event(&body)], "G.C.SECONDARY_SET.Spectral")
}

/// Edit All Starting Cards: apply modifications to every starting card.
pub fn edit_all_starting_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let body = card_modification_loop(effect, ctx, None, None);
    deck_output(vec![run_start_event(&body)], "G.C.SECONDARY_SET.Tarot")
}

/// Edit Starting Suits: modify or remove all cards of one suit.
pub fn edit_starting_suits(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let selected_suit = get_str(effect, "selected_suit").unwrap_or("Spades");
    let replace = get_str(effect, "replace_suit").unwrap_or("none");

    let mut stmts = Vec::new();
    if replace == "remove" {
        stmts.push(run_start_event(&format!(
            "        for i = #G.playing_cards, 1, -1 do\n            if G.playing_cards[i]:is_suit('{suit}') then\n                G.playing_cards[i]:remove()\n            end\n        end",
            suit = selected_suit
        )));
    } else {
        let filter = format!("v:is_suit('{}')", selected_suit);
        let suit_override = if replace == "none" {
            None
        } else {
            Some(("suit", replace))
        };
        let body = card_modification_loop(effect, ctx, Some(&filter), suit_override);
        stmts.push(run_start_event(&body));
    }

    deck_output(stmts, "G.C.SECONDARY_SET.Tarot")
}

/// Edit Starting Ranks: modify or remove all cards of one rank.
pub fn edit_starting_ranks(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let selected_rank = full_rank_key(
        get_str(effect, "specific_selected_Rank")
            .or_else(|| get_str(effect, "selected_rank"))
            .unwrap_or("King"),
    );
    let replace = get_str(effect, "specific_replace_Rank")
        .or_else(|| get_str(effect, "replace_rank"))
        .unwrap_or("none");

    let mut stmts = Vec::new();
    if replace == "remove" {
        stmts.push(run_start_event(&format!(
            "        for i = #G.playing_cards, 1, -1 do\n            if G.playing_cards[i].base.value == '{rank}' then\n                G.playing_cards[i]:remove()\n            end\n        end",
            rank = selected_rank
        )));
    } else {
        let filter = format!("v.base.value == '{}'", selected_rank);
        let rank_override = if replace == "none" {
            None
        } else {
            Some(("rank", replace))
        };
        let body = card_modification_loop(effect, ctx, Some(&filter), rank_override);
        stmts.push(run_start_event(&body));
    }

    deck_output(stmts, "G.C.SECONDARY_SET.Tarot")
}

/// Remove Starting Cards: destroy all or a number of random starting cards.
pub fn remove_starting_cards(effect: &EffectDef, ctx: &mut CompileContext) -> EffectOutput {
    let remove_type = get_str(effect, "remove_type").unwrap_or("all");

    if remove_type == "all" {
        return deck_output(
            vec![run_start_event(
                "        for i = #G.playing_cards, 1, -1 do\n            G.playing_cards[i]:remove()\n        end",
            )],
            "G.C.RED",
        );
    }

    let count = crate::compiler::values::resolve_config_value(
        &effect.params,
        "count",
        ctx,
        "remove_starting_cards_count",
    );

    let body = format!(
        "        local temp_deck = {{}}\n        for _, playing_card in ipairs(G.playing_cards) do temp_deck[#temp_deck + 1] = playing_card end\n        pseudoshuffle(temp_deck, pseudoseed('remove_starting_cards'))\n        for i = 1, math.min({count}, #temp_deck) do\n            temp_deck[i]:remove()\n        end",
        count = count.lua_str
    );

    deck_output(vec![run_start_event(&body)], "G.C.RED")
}

/// Shared enhancement/seal/edition/suit/rank modification loop over
/// G.playing_cards, optionally filtered.
fn card_modification_loop(
    effect: &EffectDef,
    ctx: &mut CompileContext,
    filter: Option<&str>,
    base_override: Option<(&str, &str)>,
) -> String {
    let enhancement = get_str(effect, "enhancement").unwrap_or("none");
    let seal = get_str(effect, "seal").unwrap_or("none");
    let edition = get_str(effect, "edition").unwrap_or("none");
    let mut suit = get_str(effect, "suit").unwrap_or("none");
    let mut rank = get_str(effect, "rank").unwrap_or("none");
    match base_override {
        Some(("suit", v)) => suit = v,
        Some(("rank", v)) => rank = v,
        _ => {}
    }

    let mut mods = String::new();

    match enhancement {
        "none" => {}
        "random" => mods.push_str(
            "                local cen_pool = {}\n                for _, enhancement_center in pairs(G.P_CENTER_POOLS['Enhanced']) do\n                    if enhancement_center.key ~= 'm_stone' then\n                        cen_pool[#cen_pool + 1] = enhancement_center\n                    end\n                end\n                v:set_ability(pseudorandom_element(cen_pool, 'edit_cards_enhancement'))\n",
        ),
        specific => mods.push_str(&format!(
            "                v:set_ability(G.P_CENTERS['{}'])\n",
            specific
        )),
    }

    match seal {
        "none" => {}
        "random" => mods.push_str(
            "                v:set_seal(SMODS.poll_seal({ key = 'edit_cards_seal', guaranteed = true }), true, true)\n",
        ),
        specific => mods.push_str(&format!(
            "                v:set_seal('{}', true, true)\n",
            specific
        )),
    }

    match edition {
        "none" => {}
        "random" => mods.push_str(
            "                v:set_edition(SMODS.poll_edition({ key = 'edit_cards_edition', no_negative = true, guaranteed = true }), true, true)\n",
        ),
        specific => mods.push_str(&format!(
            "                v:set_edition('{}', true, true)\n",
            edition_key(specific, &ctx.mod_prefix)
        )),
    }

    match suit {
        "none" => {}
        "random" => mods.push_str(
            "                SMODS.change_base(v, pseudorandom_element(SMODS.Suits, 'edit_cards_suit').key)\n",
        ),
        specific => mods.push_str(&format!(
            "                SMODS.change_base(v, '{}')\n",
            specific
        )),
    }

    match rank {
        "none" => {}
        "random" => mods.push_str(
            "                SMODS.change_base(v, nil, pseudorandom_element(SMODS.Ranks, 'edit_cards_rank').key)\n",
        ),
        specific => mods.push_str(&format!(
            "                SMODS.change_base(v, nil, '{}')\n",
            full_rank_key(specific)
        )),
    }

    match filter {
        Some(check) => format!(
            "        for _, v in pairs(G.playing_cards) do\n            if {} then\n{}            end\n        end",
            check, mods
        ),
        None => format!(
            "        for _, v in pairs(G.playing_cards) do\n{}        end",
            mods
        ),
    }
}

fn edition_key(edition: &str, mod_prefix: &str) -> String {
    if edition.starts_with("e_") {
        return edition.to_string();
    }
    if matches!(edition, "foil" | "holo" | "polychrome" | "negative") || mod_prefix.is_empty() {
        return format!("e_{}", edition);
    }
    format!("e_{}_{}", mod_prefix, edition)
}
