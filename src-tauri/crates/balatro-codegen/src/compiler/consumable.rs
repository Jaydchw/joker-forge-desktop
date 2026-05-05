use super::colors::normalize_hex_colour;
use super::context::CompileContext;
use super::{build_shared_calculate_function, build_shared_loc_vars, compile_rules};
use crate::lua_ast::*;
use crate::types::*;

/// Compile a consumable definition into a Lua chunk.
pub fn compile_consumable(consumable: &ConsumableDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Consumable,
        mod_prefix.to_string(),
        consumable.key.clone(),
        false,
    );
    ctx.set_user_vars(consumable.user_variables.clone());

    let rule_outputs = compile_rules(&consumable.rules, &mut ctx);
    let table = build_consumable_table(consumable, &ctx, &rule_outputs);

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Consumable"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    Chunk {
        stmts: vec![lua_comment(format!(" {}", consumable.name)), smods_call],
    }
}

/// Compile a ConsumableType definition into a Lua chunk.
pub fn compile_consumable_type(ct: &ConsumableTypeDef, mod_prefix: &str) -> Chunk {
    let primary = normalize_hex_colour(&ct.primary_colour).unwrap_or_else(|| "666666".to_string());
    let secondary =
        normalize_hex_colour(&ct.secondary_colour).unwrap_or_else(|| "666666".to_string());

    let mut entries: Vec<TableEntry> = Vec::new();
    entries.push(kv("key", lua_str(&ct.key)));
    entries.push(kv(
        "primary_colour",
        lua_call("HEX", vec![lua_str(&primary)]),
    ));
    entries.push(kv(
        "secondary_colour",
        lua_call("HEX", vec![lua_str(&secondary)]),
    ));
    entries.push(kv(
        "collection_rows",
        lua_table_raw(vec![
            TableEntry::Value(lua_int(ct.collection_rows.0 as i64)),
            TableEntry::Value(lua_int(ct.collection_rows.1 as i64)),
        ]),
    ));

    if let Some(default) = &ct.default_card {
        entries.push(kv("default", lua_str(default)));
    }
    if let Some(rate) = ct.shop_rate {
        entries.push(kv("shop_rate", lua_num(rate)));
    }

    // loc_txt
    let collection_name = ct
        .collection_name
        .clone()
        .unwrap_or_else(|| format!("{} Cards", ct.name));
    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table(vec![
            ("name", lua_str(&ct.name)),
            ("collection", lua_str(&collection_name)),
        ]),
    ));

    // cards table, populated by consumables referencing this set
    let cards_key = format!("c_{}_{}", mod_prefix, ct.key);
    let _ = cards_key; // Will be linked externally
    entries.push(kv("cards", lua_table_raw(vec![])));

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "ConsumableType"]),
        entries,
    ));

    Chunk {
        stmts: vec![
            lua_comment(format!(" Consumable Set: {}", ct.name)),
            smods_call,
        ],
    }
}

fn build_consumable_table(
    consumable: &ConsumableDef,
    ctx: &CompileContext,
    rule_outputs: &[super::RuleOutput],
) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&consumable.key)));
    entries.push(kv("set", lua_str(&consumable.set)));

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(consumable.pos.x as i64)),
            ("y", lua_int(consumable.pos.y as i64)),
        ]),
    ));

    // Config table
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
    let text_entries: Vec<TableEntry> = consumable
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();

    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&consumable.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ]),
    ));

    // Optional properties
    if let Some(cost) = consumable.cost {
        entries.push(kv("cost", lua_int(cost as i64)));
    }
    if let Some(unlocked) = consumable.unlocked {
        entries.push(kv("unlocked", lua_bool(unlocked)));
    }
    if let Some(discovered) = consumable.discovered {
        entries.push(kv("discovered", lua_bool(discovered)));
    }
    if let Some(hidden) = consumable.hidden {
        entries.push(kv("hidden", lua_bool(hidden)));
    }
    if let Some(can_repeat_soul) = consumable.can_repeat_soul {
        entries.push(kv("can_repeat_soul", lua_bool(can_repeat_soul)));
    }

    entries.push(kv("atlas", lua_str(&consumable.atlas)));

    if let Some(soul) = &consumable.soul_pos {
        entries.push(TableEntry::KeyValue(
            "soul_pos".to_string(),
            lua_table(vec![
                ("x", lua_int(soul.x as i64)),
                ("y", lua_int(soul.y as i64)),
            ]),
        ));
    }

    // loc_vars
    if let Some(f) = build_shared_loc_vars(ctx, rule_outputs) {
        entries.push(TableEntry::KeyValue("loc_vars".to_string(), f));
    }

    // calculate function (non-"card_used" triggers)
    if let Some(f) = build_shared_calculate_function(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    // use function (card_used triggers)
    if let Some(f) = build_use_function(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue("use".to_string(), f));
    }

    // can_use function
    let can_use_fn = build_can_use_function(rule_outputs, ctx);
    entries.push(TableEntry::KeyValue("can_use".to_string(), can_use_fn));

    lua_table_raw(entries)
}

/// Build the `use` function for consumables.
/// Compiles rules with trigger == "card_used".
fn build_use_function(rule_outputs: &[super::RuleOutput], _ctx: &CompileContext) -> Option<Expr> {
    let use_rules: Vec<&super::RuleOutput> = rule_outputs
        .iter()
        .filter(|r| r.trigger == "card_used" && !r.effect_stmts.is_empty())
        .collect();

    if use_rules.is_empty() {
        return None;
    }

    let mut body: Vec<Stmt> = vec![Stmt::Local(
        "used_card".to_string(),
        Some(lua_or(lua_ident("copier"), lua_ident("card"))),
    )];

    super::append_rule_chain_with_fallback(&mut body, &use_rules, |ro| ro.effect_stmts.clone());

    Some(Expr::Function {
        params: vec!["self".into(), "card".into(), "area".into(), "copier".into()],
        body,
    })
}

/// Build the `can_use` function for consumables.
fn build_can_use_function(rule_outputs: &[super::RuleOutput], _ctx: &CompileContext) -> Expr {
    let use_rules: Vec<&super::RuleOutput> = rule_outputs
        .iter()
        .filter(|r| r.trigger == "card_used")
        .collect();

    // Collect conditions from use rules
    let conditions: Vec<Expr> = use_rules
        .iter()
        .filter_map(|ro| ro.condition_expr.clone())
        .collect();

    let body = if conditions.is_empty() {
        vec![lua_return(lua_bool(true))]
    } else {
        let combined = lua_or_chain(conditions);
        vec![lua_return(combined)]
    };

    Expr::Function {
        params: vec!["self".into(), "card".into()],
        body,
    }
}

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}
