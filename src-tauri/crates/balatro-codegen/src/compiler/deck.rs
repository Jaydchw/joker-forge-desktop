use super::context::CompileContext;
use super::{build_shared_calculate_function, build_shared_loc_vars, compile_rules, RuleOutput};
use crate::lua_ast::*;
use crate::types::*;

/// Compile a deck definition into a Lua chunk.
pub fn compile_deck(deck: &DeckDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Deck,
        mod_prefix.to_string(),
        deck.key.clone(),
        false,
    );
    ctx.set_user_vars(deck.user_variables.clone());

    let rule_outputs = compile_rules(&deck.rules, &mut ctx);
    let table = build_deck_table(deck, &ctx, &rule_outputs);

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Back"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    Chunk {
        stmts: vec![lua_comment(format!(" {}", deck.name)), smods_call],
    }
}

fn build_deck_table(deck: &DeckDef, ctx: &CompileContext, rule_outputs: &[RuleOutput]) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&deck.key)));

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(deck.pos.x as i64)),
            ("y", lua_int(deck.pos.y as i64)),
        ]),
    ));

    // Config block, includes extra, vouchers, consumables, and deck flags
    let config_extra = ctx.build_config_extra_table();
    let vouchers: Vec<&String> = deck
        .config_vouchers
        .iter()
        .filter(|v| v.starts_with("v_"))
        .collect();
    let consumables: Vec<&String> = deck
        .config_consumables
        .iter()
        .filter(|c| c.starts_with("c_"))
        .collect();

    let has_config = !config_extra.is_empty()
        || !vouchers.is_empty()
        || !consumables.is_empty()
        || deck.no_interest
        || deck.no_faces
        || deck.erratic_deck;

    if has_config {
        let mut config_entries: Vec<TableEntry> = Vec::new();

        if !config_extra.is_empty() {
            config_entries.push(TableEntry::KeyValue(
                "extra".to_string(),
                lua_table_raw(config_extra),
            ));
        }
        if !vouchers.is_empty() {
            let voucher_entries: Vec<TableEntry> = vouchers
                .iter()
                .map(|v| TableEntry::Value(lua_str(v.as_str())))
                .collect();
            config_entries.push(TableEntry::KeyValue(
                "vouchers".to_string(),
                lua_table_raw(voucher_entries),
            ));
        }
        if !consumables.is_empty() {
            let consumable_entries: Vec<TableEntry> = consumables
                .iter()
                .map(|c| TableEntry::Value(lua_str(c.as_str())))
                .collect();
            config_entries.push(TableEntry::KeyValue(
                "consumables".to_string(),
                lua_table_raw(consumable_entries),
            ));
        }
        if deck.no_interest {
            config_entries.push(kv("no_interest", lua_bool(true)));
        }
        if deck.no_faces {
            config_entries.push(kv("remove_faces", lua_bool(true)));
        }
        if deck.erratic_deck {
            config_entries.push(kv("randomize_rank_suit", lua_bool(true)));
        }

        entries.push(TableEntry::KeyValue(
            "config".to_string(),
            lua_table_raw(config_entries),
        ));
    }

    // loc_txt
    let text_entries: Vec<TableEntry> = deck
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();
    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(vec![
            TableEntry::IndexValue(lua_str("name"), lua_str(&deck.name)),
            TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
        ]),
    ));

    if let Some(v) = deck.unlocked {
        entries.push(kv("unlocked", lua_bool(v)));
    }
    if let Some(v) = deck.discovered {
        entries.push(kv("discovered", lua_bool(v)));
    }
    if let Some(v) = deck.no_collection {
        entries.push(kv("no_collection", lua_bool(v)));
    }

    entries.push(kv("atlas", lua_str(&deck.atlas)));

    // loc_vars
    if let Some(f) = build_shared_loc_vars(ctx, rule_outputs) {
        entries.push(TableEntry::KeyValue("loc_vars".to_string(), f));
    }

    // calculate function (non-card_used triggers)
    if let Some(f) = build_shared_calculate_function(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    // apply function (card_used triggers, deck run-start hook)
    if let Some(f) = build_apply_function(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue("apply".to_string(), f));
    }

    lua_table_raw(entries)
}

/// Build the `apply` function for decks.
/// Decks use apply(self: back) for run-start effects.
fn build_apply_function(rule_outputs: &[RuleOutput], _ctx: &CompileContext) -> Option<Expr> {
    let apply_rules: Vec<&RuleOutput> = rule_outputs
        .iter()
        .filter(|r| r.trigger == "card_used" && !r.effect_stmts.is_empty())
        .collect();

    if apply_rules.is_empty() {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();
    super::append_rule_chain_with_fallback(&mut body, &apply_rules, |ro| ro.effect_stmts.clone());

    Some(Expr::Function {
        params: vec!["self".into(), "back".into()],
        body,
    })
}

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}
