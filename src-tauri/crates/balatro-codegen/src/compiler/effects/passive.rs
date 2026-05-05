use crate::compiler::context::CompileContext;
use crate::lua_ast::*;
use crate::types::EffectDef;

/// Result of compiling a passive effect.
/// Passive effects don't go through the normal trigger→condition→effect flow;
/// they produce code for `add_to_deck`, `remove_from_deck`: or special
/// calculate blocks.
#[derive(Debug, Default)]
pub struct PassiveEffectOutput {
    pub add_to_deck: Vec<Stmt>,
    pub remove_from_deck: Vec<Stmt>,
    pub calculate_stmts: Vec<Stmt>,
    pub config_vars: Vec<(String, crate::types::ConfigValue)>,
    pub loc_vars: Vec<String>,
}

/// Splash: all played cards count as scored.
pub fn splash(_effect: &EffectDef, _ctx: &mut CompileContext) -> PassiveEffectOutput {
    // In calculate():
    // if context.modify_scoring_hand and not context.blueprint then
    //     return { add_to_hand = true }
    // end
    let check = lua_if(
        lua_and(
            lua_path(&["context", "modify_scoring_hand"]),
            lua_not(lua_path(&["context", "blueprint"])),
        ),
        vec![lua_return(lua_table(vec![("add_to_hand", lua_bool(true))]))],
    );

    PassiveEffectOutput {
        calculate_stmts: vec![check],
        ..Default::default()
    }
}

/// Free rerolls: sets reroll cost to 0 while joker is held.
pub fn free_rerolls(_effect: &EffectDef, _ctx: &mut CompileContext) -> PassiveEffectOutput {
    // add_to_deck: G.GAME.round_resets.reroll_cost = 0
    // remove_from_deck: G.GAME.round_resets.reroll_cost = 5
    let add = lua_assign(
        lua_path(&["G", "GAME", "round_resets", "reroll_cost"]),
        lua_int(0),
    );
    let remove = lua_assign(
        lua_path(&["G", "GAME", "round_resets", "reroll_cost"]),
        lua_int(5),
    );

    PassiveEffectOutput {
        add_to_deck: vec![add],
        remove_from_deck: vec![remove],
        ..Default::default()
    }
}

/// Allow debt: lets player go into negative money.
pub fn allow_debt(effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let resolved =
        crate::compiler::values::resolve_config_value(&effect.params, "amount", ctx, "debt_amount");

    let add = lua_raw_stmt(format!(
        "G.GAME.bankrupt_at = G.GAME.bankrupt_at - {}",
        resolved.lua_str
    ));
    let remove = lua_raw_stmt(format!(
        "G.GAME.bankrupt_at = G.GAME.bankrupt_at + {}",
        resolved.lua_str
    ));

    PassiveEffectOutput {
        add_to_deck: vec![add],
        remove_from_deck: vec![remove],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Shortcut, allows straights to wrap (gap of 1)
// ---------------------------------------------------------------------------

pub fn shortcut(_effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    // Shortcut uses the SMODS hook system, the joker key enables the behavior
    let key = ctx.smods_key();
    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(format!(
            "-- Shortcut straights enabled ({})",
            key
        ))],
        remove_from_deck: vec![lua_raw_stmt("-- Shortcut straights disabled".to_string())],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Showman, allows duplicate cards
// ---------------------------------------------------------------------------

pub fn showman(_effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let key = ctx.smods_key();
    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(format!("-- Showman effect enabled ({})", key))],
        remove_from_deck: vec![lua_raw_stmt("-- Showman effect disabled".to_string())],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Combine Ranks, treats certain ranks as the same rank
// ---------------------------------------------------------------------------

pub fn combine_ranks(effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let _source_rank_type = effect
        .params
        .get("source_rank_type")
        .and_then(|v| v.as_str())
        .unwrap_or("specific");
    let target_rank = effect
        .params
        .get("target_rank")
        .and_then(|v| v.as_str())
        .unwrap_or("J");

    ctx.add_config_str("target_rank", target_rank);

    let key = ctx.smods_key();
    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(format!(
            "-- Combine ranks effect enabled ({})",
            key
        ))],
        remove_from_deck: vec![lua_raw_stmt("-- Combine ranks effect disabled".to_string())],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Combine Suits, treats two suits as the same
// ---------------------------------------------------------------------------

pub fn combine_suits(_effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let key = ctx.smods_key();
    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(format!(
            "-- Combine suits effect enabled ({})",
            key
        ))],
        remove_from_deck: vec![lua_raw_stmt("-- Combine suits effect disabled".to_string())],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Reduce Flush/Straight Requirement
// ---------------------------------------------------------------------------

pub fn reduce_flush_straight_requirement(
    effect: &EffectDef,
    ctx: &mut CompileContext,
) -> PassiveEffectOutput {
    let resolved = crate::compiler::values::resolve_config_value(
        &effect.params,
        "reduction_value",
        ctx,
        "reduction_value",
    );
    let key = ctx.smods_key();

    PassiveEffectOutput {
        add_to_deck: vec![lua_raw_stmt(format!(
            "-- Flush/Straight requirements reduced by {} ({})",
            resolved.lua_str, key
        ))],
        remove_from_deck: vec![lua_raw_stmt(
            "-- Flush/Straight requirements restored".to_string(),
        )],
        ..Default::default()
    }
}

// ---------------------------------------------------------------------------
// Copy Joker Ability
// ---------------------------------------------------------------------------

pub fn copy_joker_ability(effect: &EffectDef, ctx: &mut CompileContext) -> PassiveEffectOutput {
    let selection_method = effect
        .params
        .get("selection_method")
        .and_then(|v| v.as_str())
        .unwrap_or("right");

    let target_logic = match selection_method {
        "right" => "local my_pos = nil\n\
            for i = 1, #G.jokers.cards do\n\
                if G.jokers.cards[i] == card then my_pos = i; break end\n\
            end\n\
            target_joker = (my_pos and my_pos < #G.jokers.cards) and G.jokers.cards[my_pos + 1] or nil"
            .to_string(),
        "left" => "local my_pos = nil\n\
            for i = 1, #G.jokers.cards do\n\
                if G.jokers.cards[i] == card then my_pos = i; break end\n\
            end\n\
            target_joker = (my_pos and my_pos > 1) and G.jokers.cards[my_pos - 1] or nil"
            .to_string(),
        "last" => "target_joker = G.jokers.cards[#G.jokers.cards]\n\
            if target_joker == card then target_joker = nil end"
            .to_string(),
        "first" => "target_joker = G.jokers.cards[1]\n\
            if target_joker == card then target_joker = nil end"
            .to_string(),
        "specific" => {
            let resolved = crate::compiler::values::resolve_config_value(
                &effect.params, "specific_index", ctx, "copy_ability_index",
            );
            format!(
                "target_joker = G.jokers.cards[{}]\n\
                if target_joker == card then target_joker = nil end",
                resolved.lua_str
            )
        },
        _ => "target_joker = G.jokers.cards[#G.jokers.cards]\n\
            if target_joker == card then target_joker = nil end"
            .to_string(),
    };

    let calc = format!(
        "local target_joker = nil\n\
        {}\n\
        local ret = SMODS.blueprint_effect(card, target_joker, context)\n\
        if ret then\n\
            SMODS.calculate_effect(ret, card)\n\
        end",
        target_logic
    );

    PassiveEffectOutput {
        calculate_stmts: vec![lua_raw_stmt(calc)],
        ..Default::default()
    }
}

/// Dispatch a passive effect by type.
pub fn compile_passive(
    effect: &EffectDef,
    ctx: &mut crate::compiler::context::CompileContext,
) -> Option<PassiveEffectOutput> {
    match effect.effect_type.as_str() {
        "splash" => Some(splash(effect, ctx)),
        "free_rerolls" => Some(free_rerolls(effect, ctx)),
        "allow_debt" => Some(allow_debt(effect, ctx)),

        // Slot management passives (delegated to slot_management module)
        "edit_joker_slots" => {
            let out = super::slot_management::edit_joker_slots_passive(effect, ctx);
            Some(out)
        }
        "edit_joker_size" => {
            let out = super::slot_management::edit_joker_size_passive(effect, ctx);
            Some(out)
        }
        "edit_consumable_slots" => {
            let out = super::slot_management::edit_consumable_slots_passive(effect, ctx);
            Some(out)
        }
        "edit_hand_size" | "edit_play_size" | "edit_discard_size" | "edit_voucher_slots"
        | "edit_booster_slots" | "edit_shop_slots" => {
            let size_type = effect
                .effect_type
                .strip_prefix("edit_")
                .unwrap_or("hand_size");
            Some(super::slot_management::edit_item_size_passive_typed(
                effect, ctx, size_type,
            ))
        }

        // New passive effects
        "shortcut" => Some(shortcut(effect, ctx)),
        "showman" => Some(showman(effect, ctx)),
        "combine_ranks" => Some(combine_ranks(effect, ctx)),
        "combine_suits" => Some(combine_suits(effect, ctx)),
        "reduce_flush_straight_requirement" | "reduce_flush_straight_requirements" => {
            Some(reduce_flush_straight_requirement(effect, ctx))
        }
        "copy_joker_ability" => Some(copy_joker_ability(effect, ctx)),

        _ => None,
    }
}
