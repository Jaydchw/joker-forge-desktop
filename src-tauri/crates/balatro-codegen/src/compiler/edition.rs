use crate::lua_ast::*;
use crate::types::*;
use super::context::CompileContext;
use super::colors::normalize_hex_colour;
use super::{compile_rules, build_shared_loc_vars, RuleOutput};
use super::enhancement::build_card_calculate_function;

/// Known vanilla shaders that don't need SMODS.Shader registration.
const VANILLA_SHADERS: &[&str] = &[
    "foil", "holo", "polychrome", "negative", "negative_shine",
    "voucher", "booster", "dissolve", "played", "unplayed",
];

fn is_custom_shader(shader: &str) -> bool {
    !shader.is_empty() && shader != "false" && !VANILLA_SHADERS.contains(&shader)
}

fn is_vanilla_shader(shader: &str) -> bool {
    VANILLA_SHADERS.contains(&shader)
}

/// Compile an edition definition into a Lua chunk.
pub fn compile_edition(edition: &EditionDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Edition,
        mod_prefix.to_string(),
        edition.key.clone(),
        false,
    );
    ctx.set_user_vars(edition.user_variables.clone());

    let rule_outputs = compile_rules(&edition.rules, &mut ctx);
    let table = build_edition_table(edition, &ctx, &rule_outputs, mod_prefix);

    let mut stmts = Vec::new();
    stmts.push(lua_comment(format!(" {}", edition.name)));

    // If custom shader, register it before the edition
    if let Some(shader) = &edition.shader {
        if is_custom_shader(shader) {
            stmts.push(Stmt::ExprStmt(lua_table_call(
                lua_path(&["SMODS", "Shader"]),
                vec![
                    kv("key", lua_str(shader)),
                    kv("path", lua_str(&format!("{}.fs", shader))),
                ],
            )));
        }
    }

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Edition"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));
    stmts.push(smods_call);

    Chunk { stmts }
}

fn build_edition_table(
    edition: &EditionDef,
    ctx: &CompileContext,
    rule_outputs: &[RuleOutput],
    _mod_prefix: &str,
) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&edition.key)));

    // Shader
    if let Some(shader) = &edition.shader {
        if shader == "false" {
            entries.push(kv("shader", lua_bool(false)));
        } else {
            entries.push(kv("shader", lua_str(shader)));

            // Vanilla shaders need prefix_config to disable prefixing
            if is_vanilla_shader(shader) {
                entries.push(TableEntry::KeyValue(
                    "prefix_config".to_string(),
                    lua_table_raw(vec![TableEntry::KeyValue(
                        "shader".to_string(),
                        lua_bool(false),
                    )]),
                ));
            }
        }
    }

    // Config extra
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

    // Optional properties
    if let Some(v) = edition.in_shop {
        entries.push(kv("in_shop", lua_bool(v)));
    }
    if let Some(v) = edition.weight {
        if v > 0.0 {
            entries.push(kv("weight", lua_num(v)));
        }
    }
    if let Some(v) = edition.extra_cost {
        if v > 0 {
            entries.push(kv("extra_cost", lua_int(v as i64)));
        }
    }
    if let Some(v) = edition.apply_to_float {
        entries.push(kv("apply_to_float", lua_bool(v)));
    }
    if let Some(colour) = &edition.badge_colour {
        if let Some(hex) = normalize_hex_colour(colour) {
            if hex != "FFAA00" {
                entries.push(kv("badge_colour", lua_call("HEX", vec![lua_str(hex)])));
            }
        }
    }
    if let Some(sound) = &edition.sound {
        if sound != "foil1" {
            entries.push(TableEntry::KeyValue(
                "sound".to_string(),
                lua_table(vec![
                    ("sound", lua_str(sound)),
                    ("per", lua_num(edition.pitch.unwrap_or(1.2))),
                    ("vol", lua_num(edition.volume.unwrap_or(0.4))),
                ]),
            ));
        }
    }
    if let Some(v) = edition.disable_shadow {
        entries.push(kv("disable_shadow", lua_bool(v)));
    }
    if let Some(v) = edition.disable_base_shader {
        entries.push(kv("disable_base_shader", lua_bool(v)));
    }

    // loc_txt with label
    let text_entries: Vec<TableEntry> = edition
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();
    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&edition.name)),
            TableEntry::IndexValue(lua_str("label"), lua_str(&edition.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ]),
    ));

    if let Some(v) = edition.unlocked {
        entries.push(kv("unlocked", lua_bool(v)));
    }
    if let Some(v) = edition.discovered {
        entries.push(kv("discovered", lua_bool(v)));
    }
    if let Some(v) = edition.no_collection {
        entries.push(kv("no_collection", lua_bool(v)));
    }

    // loc_vars
    if let Some(f) = build_shared_loc_vars(ctx, rule_outputs) {
        entries.push(TableEntry::KeyValue("loc_vars".to_string(), f));
    }

    // get_weight function (always present for editions)
    entries.push(TableEntry::KeyValue(
        "get_weight".to_string(),
        Expr::Function {
            params: vec!["self".into()],
            body: vec![lua_return(lua_mul(
                lua_path(&["G", "GAME", "edition_rate"]),
                lua_field(lua_ident("self"), "weight"),
            ))],
        },
    ));

    // calculate function
    if let Some(f) = build_card_calculate_function(rule_outputs, ctx, false, false, "edition") {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    lua_table_raw(entries)
}

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}
