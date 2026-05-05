use crate::lua_ast::*;
use crate::types::*;
use super::context::CompileContext;
use super::{compile_rules, build_shared_calculate_function, build_shared_loc_vars, RuleOutput};

/// Compile a voucher definition into a Lua chunk.
pub fn compile_voucher(voucher: &VoucherDef, mod_prefix: &str) -> Chunk {
    let mut ctx = CompileContext::new(
        ObjectType::Voucher,
        mod_prefix.to_string(),
        voucher.key.clone(),
        false,
    );
    ctx.set_user_vars(voucher.user_variables.clone());

    let rule_outputs = compile_rules(&voucher.rules, &mut ctx);
    let table = build_voucher_table(voucher, &ctx, &rule_outputs, mod_prefix);

    let smods_call = Stmt::ExprStmt(lua_table_call(
        lua_path(&["SMODS", "Voucher"]),
        match table {
            Expr::Table(entries) => entries,
            _ => vec![],
        },
    ));

    Chunk {
        stmts: vec![lua_comment(format!(" {}", voucher.name)), smods_call],
    }
}

fn build_voucher_table(
    voucher: &VoucherDef,
    ctx: &CompileContext,
    rule_outputs: &[RuleOutput],
    _mod_prefix: &str,
) -> Expr {
    let mut entries: Vec<TableEntry> = Vec::new();

    entries.push(kv("key", lua_str(&voucher.key)));

    // Position
    entries.push(TableEntry::KeyValue(
        "pos".to_string(),
        lua_table(vec![
            ("x", lua_int(voucher.pos.x as i64)),
            ("y", lua_int(voucher.pos.y as i64)),
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

    // loc_txt with unlock description
    let text_entries: Vec<TableEntry> = voucher
        .description
        .iter()
        .enumerate()
        .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
        .collect();

    let mut loc_txt_entries = vec![
        TableEntry::IndexValue(lua_str("name"), lua_str(&voucher.name)),
        TableEntry::IndexValue(lua_str("text"), lua_table_raw(text_entries)),
    ];

    if !voucher.unlock_description.is_empty() {
        let unlock_entries: Vec<TableEntry> = voucher
            .unlock_description
            .iter()
            .enumerate()
            .map(|(i, d)| TableEntry::IndexValue(lua_int(i as i64 + 1), lua_str(d)))
            .collect();
        loc_txt_entries.push(TableEntry::IndexValue(
            lua_str("unlock"),
            lua_table_raw(unlock_entries),
        ));
    }

    entries.push(TableEntry::KeyValue(
        "loc_txt".to_string(),
        lua_table_raw(loc_txt_entries),
    ));

    // Optional properties
    if let Some(cost) = voucher.cost {
        entries.push(kv("cost", lua_int(cost as i64)));
    }
    if let Some(v) = voucher.unlocked {
        entries.push(kv("unlocked", lua_bool(v)));
    }
    if let Some(v) = voucher.discovered {
        entries.push(kv("discovered", lua_bool(v)));
    }
    if let Some(v) = voucher.no_collection {
        entries.push(kv("no_collection", lua_bool(v)));
    }
    if let Some(v) = voucher.can_repeat_soul {
        entries.push(kv("can_repeat_soul", lua_bool(v)));
    }

    // Requires (prerequisite voucher)
    if let Some(requires) = &voucher.requires {
        entries.push(TableEntry::KeyValue(
            "requires".to_string(),
            lua_table_raw(vec![TableEntry::Value(lua_str(requires))]),
        ));
    }

    entries.push(kv("atlas", lua_str(&voucher.atlas)));

    if let Some(soul) = &voucher.soul_pos {
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

    // calculate function (non-card_used triggers)
    if let Some(f) = build_shared_calculate_function(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue("calculate".to_string(), f));
    }

    // redeem function (card_used triggers, voucher-specific hook)
    if let Some(f) = build_redeem_function(rule_outputs, ctx) {
        entries.push(TableEntry::KeyValue("redeem".to_string(), f));
    }

    // draw function for shader
    if let Some(shader) = &voucher.draw_shader_sprite {
        if shader != "false" {
            if let Some(f) = build_draw_function(shader) {
                entries.push(TableEntry::KeyValue("draw".to_string(), f));
            }
        }
    }

    lua_table_raw(entries)
}

/// Build the `redeem` function for vouchers.
/// Vouchers use redeem(self: card) instead of use().
fn build_redeem_function(rule_outputs: &[RuleOutput], ctx: &CompileContext) -> Option<Expr> {
    let redeem_rules: Vec<&RuleOutput> = rule_outputs
        .iter()
        .filter(|r| r.trigger == "card_used" && !r.effect_stmts.is_empty())
        .collect();

    if redeem_rules.is_empty() {
        return None;
    }

    let mut body: Vec<Stmt> = Vec::new();
    if let Some(init_block) = ctx.run_scoped_global_init_block() {
        body.push(lua_raw_stmt(init_block));
    }
    super::append_rule_chain_with_fallback(&mut body, &redeem_rules, |ro| ro.effect_stmts.clone());

    Some(Expr::Function {
        params: vec!["self".into(), "card".into()],
        body,
    })
}

/// Build a draw function for shader rendering.
fn build_draw_function(shader: &str) -> Option<Expr> {
    let shader_code = if shader == "negative" {
        "if (layer == 'card' or layer == 'both') and card.sprite_facing == 'front' and (card.config.center.discovered or card.bypass_discovery_center) then\n            card.children.center:draw_shader('negative', nil, card.ARGS.send_to_shader)\n            card.children.center:draw_shader('negative_shine', nil, card.ARGS.send_to_shader)\n        end".to_string()
    } else {
        format!(
            "if (layer == 'card' or layer == 'both') and card.sprite_facing == 'front' and (card.config.center.discovered or card.bypass_discovery_center) then\n            card.children.center:draw_shader('{}', nil, card.ARGS.send_to_shader)\n        end",
            shader
        )
    };

    Some(Expr::Function {
        params: vec!["self".into(), "card".into(), "layer".into()],
        body: vec![lua_raw_stmt(shader_code)],
    })
}

fn kv(key: &str, val: Expr) -> TableEntry {
    TableEntry::KeyValue(key.to_string(), val)
}

