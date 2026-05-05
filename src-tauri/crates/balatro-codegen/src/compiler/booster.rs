use super::compile_rules;
use super::context::CompileContext;
use crate::lua_ast::*;
use crate::types::*;

/// Compile a booster definition into a Lua chunk.
pub fn compile_booster(booster: &BoosterDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Booster,
        mod_prefix.to_string(),
        booster.key.clone(),
        false,
    );

    let _rule_outputs = compile_rules(&booster.rules, &mut ctx);
    let table = build_booster_table(booster, &ctx);

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Booster"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    Chunk {
        stmts: vec![lua_comment(format!(" {}", booster.name)), smods_call],
    }
}

fn build_booster_table(booster: &BoosterDef, ctx: &CompileContext) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&booster.key)));

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(booster.pos.x as i64)),
            ("y", lua_int(booster.pos.y as i64)),
        ]),
    ));

    // Config
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

    // loc_txt
    let text_entries: Vec<TableEntry> = booster
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();
    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&booster.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ]),
    ));

    entries.push(kv("atlas", lua_str(&booster.atlas)));

    if let Some(cost) = booster.cost {
        entries.push(kv("cost", lua_int(cost as i64)));
    }
    if let Some(weight) = booster.weight {
        entries.push(kv("weight", lua_num(weight)));
    }
    if let Some(kind) = &booster.kind {
        entries.push(kv("kind", lua_str(kind)));
    }
    if let Some(draw) = booster.draw {
        entries.push(kv("draw", lua_int(draw as i64)));
    }
    if let Some(extra) = booster.extra {
        entries.push(kv("extra", lua_int(extra as i64)));
    }
    if let Some(discovered) = booster.discovered {
        entries.push(kv("discovered", lua_bool(discovered)));
    }

    lua_table_raw(entries)
}

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}
