use crate::lua_ast::*;
use crate::types::*;
use super::context::CompileContext;
use super::colors::normalize_hex_colour;
use super::{compile_rules, build_shared_loc_vars, RuleOutput};
use super::enhancement::build_card_calculate_function;

/// Compile a seal definition into a Lua chunk.
pub fn compile_seal(seal: &SealDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Seal,
        mod_prefix.to_string(),
        seal.key.clone(),
        false,
    );
    ctx.set_user_vars(seal.user_variables.clone());

    let rule_outputs = compile_rules(&seal.rules, &mut ctx);
    let table = build_seal_table(seal, &ctx, &rule_outputs);

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Seal"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    Chunk {
        stmts: vec![lua_comment(format!(" {}", seal.name)), smods_call],
    }
}

fn has_non_discard_destroy(rules: &[RuleDef]) -> bool {
    rules.iter().any(|r| {
        r.trigger != "card_discarded"
            && r.effects
                .iter()
                .any(|e| e.effect_type == "destroy_playing_card")
    })
}

fn has_retrigger_effects(rules: &[RuleDef]) -> bool {
    rules
        .iter()
        .any(|r| r.effects.iter().any(|e| e.effect_type == "retrigger_card"))
}

fn build_seal_table(
    seal: &SealDef,
    ctx: &CompileContext,
    rule_outputs: &[RuleOutput],
) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&seal.key)));

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(seal.pos.x as i64)),
            ("y", lua_int(seal.pos.y as i64)),
        ]),
    ));

    // Config extra (seals use card.ability.seal.extra)
    let config_extra = ctx.build_config_extra_table();
    if !config_extra.is_empty() {
        entries.push(TableEntry::KeyValue(
            "config".to_string(),
            lua_table_raw(vec![TableEntry::KeyValue(
                "extra".to_string(),
                lua_table_raw(config_extra),
            )]),
        ));
    }

    // Badge colour
    if let Some(colour) = &seal.badge_colour {
        if let Some(hex) = normalize_hex_colour(colour) {
            if hex != "FFFFFF" {
                entries.push(kv("badge_colour", lua_call("HEX", vec![lua_str(hex)])));
            }
        }
    }

    // loc_txt with label
    let text_entries: Vec<TableEntry> = seal
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();
    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&seal.name)),
            TableEntry::IndexValue(lua_str("label"), lua_str(&seal.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ]),
    ));

    entries.push(kv("atlas", lua_str(&seal.atlas)));

    if let Some(v) = seal.unlocked {
        entries.push(kv("unlocked", lua_bool(v)));
    }
    if let Some(v) = seal.discovered {
        entries.push(kv("discovered", lua_bool(v)));
    }
    if let Some(v) = seal.no_collection {
        entries.push(kv("no_collection", lua_bool(v)));
    }

    // Sound
    if seal.sound != "gold_seal" {
        entries.push(TableEntry::KeyValue(
            "sound".to_string(),
            lua_table(vec![
                ("sound", lua_str(&seal.sound)),
                ("per", lua_num(seal.pitch.unwrap_or(1.2))),
                ("vol", lua_num(seal.volume.unwrap_or(0.4))),
            ]),
        ));
    }

    // loc_vars
    if let Some(f) = build_shared_loc_vars(ctx, rule_outputs) {
        entries.push(TableEntry::KeyValue("loc_vars".to_string(), f));
    }

    // calculate function
    if let Some(f) = build_card_calculate_function(
        rule_outputs,
        ctx,
        has_non_discard_destroy(&seal.rules),
        has_retrigger_effects(&seal.rules),
        "seal",
    ) {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    lua_table_raw(entries)
}

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}
