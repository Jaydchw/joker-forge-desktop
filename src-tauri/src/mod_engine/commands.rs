use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
};

use balatro_codegen::types::UserVariableDef;
use balatro_codegen::{
    compile_consumable, compile_consumable_type, compile_deck, compile_edition,
    compile_enhancement, compile_joker_with_options, compile_node_snippet, compile_rarity,
    compile_seal, compile_voucher, format_lua_source, Emitter as LuaEmitter, JokerDef, ObjectType,
};
use serde::Serialize;
use serde_json::Value;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager, State, Window};

use super::{
    compiler::Compiler,
    export::{
        AtlasPosInput, BatchConsumableEntry, BatchDeckEntry, BatchEditionEntry,
        BatchEnhancementEntry, BatchJokerEntry, BatchSealEntry, BatchVoucherEntry,
        ConsumableDataInput, ConsumableSetDataInput, DeckDataInput, EditionDataInput,
        EnhancementDataInput, JokerDataInput, ModMetadataInput, RarityDataInput, SealDataInput,
        VoucherDataInput,
    },
    state::AppState,
    types::{Edge, EntityState, Node, RuleCatalogPayload, SnippetResponse, StateSyncPayload},
};

fn emit_sync(window: &Window, compiler: &impl Compiler, state: &EntityState) -> Result<(), String> {
    let payload = StateSyncPayload::from(state);
    let code = compiler.compile_entity(state);
    window
        .emit("state_sync", payload)
        .map_err(|error| error.to_string())?;
    window
        .emit("live_code_update", code)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn init_entity(
    entity_type: String,
    app_state: State<'_, AppState>,
    window: Window,
) -> Result<StateSyncPayload, String> {
    let state_snapshot = {
        let mut state = app_state
            .entity_state
            .lock()
            .map_err(|_| "Failed to lock entity state".to_string())?;
        *state = EntityState::new(entity_type);
        state.clone()
    };

    emit_sync(&window, &app_state.compiler, &state_snapshot)?;
    Ok(StateSyncPayload::from(&state_snapshot))
}

#[tauri::command]
pub fn add_node(
    node_type: String,
    id: String,
    app_state: State<'_, AppState>,
    window: Window,
) -> Result<StateSyncPayload, String> {
    let normalized_node_type = app_state
        .registry
        .resolve_node_type(&node_type)
        .ok_or_else(|| format!("Unknown node type: {}", node_type))?;

    if !app_state.registry.has_node_type(&normalized_node_type) {
        return Err(format!("Unknown node type: {}", node_type));
    }

    let state_snapshot = {
        let mut state = app_state
            .entity_state
            .lock()
            .map_err(|_| "Failed to lock entity state".to_string())?;

        if state.nodes.contains_key(&id) {
            return Err(format!("Node already exists: {}", id));
        }

        let node = Node {
            id: id.clone(),
            node_type: normalized_node_type,
            values: HashMap::new(),
        };

        state.nodes.insert(id, node);
        state.clone()
    };

    emit_sync(&window, &app_state.compiler, &state_snapshot)?;
    Ok(StateSyncPayload::from(&state_snapshot))
}

#[tauri::command]
pub fn get_rulebuilder_catalog(
    app_state: State<'_, AppState>,
) -> Result<RuleCatalogPayload, String> {
    Ok(app_state.rule_catalog.clone())
}

#[tauri::command]
pub fn remove_node(
    id: String,
    app_state: State<'_, AppState>,
    window: Window,
) -> Result<StateSyncPayload, String> {
    let state_snapshot = {
        let mut state = app_state
            .entity_state
            .lock()
            .map_err(|_| "Failed to lock entity state".to_string())?;

        if state.nodes.remove(&id).is_none() {
            return Err(format!("Node does not exist: {}", id));
        }

        state
            .edges
            .retain(|edge| edge.source_id != id && edge.target_id != id);
        state.clone()
    };

    emit_sync(&window, &app_state.compiler, &state_snapshot)?;
    Ok(StateSyncPayload::from(&state_snapshot))
}

#[tauri::command]
pub fn connect_nodes(
    source_id: String,
    target_id: String,
    app_state: State<'_, AppState>,
    window: Window,
) -> Result<StateSyncPayload, String> {
    let state_snapshot = {
        let mut state = app_state
            .entity_state
            .lock()
            .map_err(|_| "Failed to lock entity state".to_string())?;

        let source = state
            .nodes
            .get(&source_id)
            .ok_or_else(|| format!("Source node does not exist: {}", source_id))?
            .clone();
        let target = state
            .nodes
            .get(&target_id)
            .ok_or_else(|| format!("Target node does not exist: {}", target_id))?
            .clone();

        if !app_state
            .registry
            .can_connect(&source.node_type, &target.node_type)
        {
            return Err(format!(
                "Schema validation failed for connection {} -> {}",
                source.node_type, target.node_type
            ));
        }

        let edge = Edge {
            source_id: source_id.clone(),
            target_id: target_id.clone(),
        };

        if !state.edges.contains(&edge) {
            state.edges.push(edge);
        }

        state.clone()
    };

    emit_sync(&window, &app_state.compiler, &state_snapshot)?;
    Ok(StateSyncPayload::from(&state_snapshot))
}

#[tauri::command]
pub fn disconnect_nodes(
    source_id: String,
    target_id: String,
    app_state: State<'_, AppState>,
    window: Window,
) -> Result<StateSyncPayload, String> {
    let state_snapshot = {
        let mut state = app_state
            .entity_state
            .lock()
            .map_err(|_| "Failed to lock entity state".to_string())?;

        let original_len = state.edges.len();
        state
            .edges
            .retain(|edge| !(edge.source_id == source_id && edge.target_id == target_id));

        if state.edges.len() == original_len {
            return Err(format!(
                "Connection does not exist: {} -> {}",
                source_id, target_id
            ));
        }

        state.clone()
    };

    emit_sync(&window, &app_state.compiler, &state_snapshot)?;
    Ok(StateSyncPayload::from(&state_snapshot))
}

#[tauri::command]
pub fn update_node_value(
    id: String,
    field: String,
    value: Value,
    app_state: State<'_, AppState>,
    window: Window,
) -> Result<StateSyncPayload, String> {
    let state_snapshot = {
        let mut state = app_state
            .entity_state
            .lock()
            .map_err(|_| "Failed to lock entity state".to_string())?;

        let node = state
            .nodes
            .get_mut(&id)
            .ok_or_else(|| format!("Node does not exist: {}", id))?;
        node.values.insert(field, value);

        state.clone()
    };

    emit_sync(&window, &app_state.compiler, &state_snapshot)?;
    Ok(StateSyncPayload::from(&state_snapshot))
}

#[tauri::command]
pub fn get_node_snippet(
    node_id: String,
    app_state: State<'_, AppState>,
) -> Result<SnippetResponse, String> {
    let state = app_state
        .entity_state
        .lock()
        .map_err(|_| "Failed to lock entity state".to_string())?;

    let node = state
        .nodes
        .get(&node_id)
        .ok_or_else(|| format!("Node does not exist: {}", node_id))?
        .clone();

    let dependencies = state
        .edges
        .iter()
        .filter(|edge| edge.target_id == node_id)
        .filter_map(|edge| state.nodes.get(&edge.source_id).cloned())
        .collect::<Vec<_>>();

    Ok(app_state
        .compiler
        .compile_node(&state, &node, &dependencies))
}

#[tauri::command]
pub fn compile_joker_lua(joker_def: JokerDef, mod_prefix: String) -> Result<String, String> {
    let chunk = compile_joker_with_options(&joker_def, &mod_prefix, true);
    let lua = format_lua_source(&LuaEmitter::new().emit_chunk(&chunk));
    Ok(lua)
}

#[tauri::command]
pub fn compile_joker_lua_with_options(
    joker_def: JokerDef,
    mod_prefix: String,
    include_loc_txt: bool,
) -> Result<String, String> {
    let chunk = compile_joker_with_options(&joker_def, &mod_prefix, include_loc_txt);
    let lua = format_lua_source(&LuaEmitter::new().emit_chunk(&chunk));
    Ok(lua)
}

#[tauri::command]
pub fn compile_rulebuilder_node_snippet(
    item_type: String,
    node_type: String,
    params: HashMap<String, Value>,
) -> Result<String, String> {
    let object_type = match item_type.as_str() {
        "joker" => ObjectType::Joker,
        "consumable" => ObjectType::Consumable,
        "consumable_type" => ObjectType::ConsumableType,
        "enhancement" | "card" => ObjectType::Enhancement,
        "seal" => ObjectType::Seal,
        "edition" => ObjectType::Edition,
        "rarity" => ObjectType::Rarity,
        "voucher" => ObjectType::Voucher,
        "deck" => ObjectType::Deck,
        "booster" => ObjectType::Booster,
        _ => {
            return Err(format!("Unsupported item type: {}", item_type));
        }
    };

    Ok(compile_node_snippet(
        &node_type,
        &params,
        object_type,
        "mod",
    ))
}

// ---------------------------------------------------------------------------
// Unified export commands (Issue #1 + #2)
//
// These replace the TypeScript `mapJokerToRustDef` + per-joker IPC loop.
// The frontend sends raw `JokerData` objects; Rust maps them to `JokerDef`
// (via `export::joker_data_to_def`) and either returns the Lua source or
// writes it directly to disk, both in a single round-trip.
// ---------------------------------------------------------------------------

fn compile_joker_lua_from_input(
    item: &JokerDataInput,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
    mod_prefix: &str,
    include_loc_txt: bool,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::joker_data_to_def(item, mod_prefix, pos, soul_pos);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_joker_with_options(&def, mod_prefix, include_loc_txt);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

fn compile_consumable_lua_from_input(
    item: &ConsumableDataInput,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
    mod_prefix: &str,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::consumable_data_to_def(item, pos, soul_pos);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_consumable(&def, mod_prefix);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

fn compile_voucher_lua_from_input(
    item: &VoucherDataInput,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
    mod_prefix: &str,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::voucher_data_to_def(item, pos, soul_pos);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_voucher(&def, mod_prefix);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

fn compile_deck_lua_from_input(
    item: &DeckDataInput,
    pos: AtlasPosInput,
    mod_prefix: &str,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::deck_data_to_def(item, pos);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_deck(&def, mod_prefix);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

fn compile_enhancement_lua_from_input(
    item: &EnhancementDataInput,
    pos: AtlasPosInput,
    mod_prefix: &str,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::enhancement_data_to_def(item, pos);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_enhancement(&def, mod_prefix);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

fn compile_seal_lua_from_input(
    item: &SealDataInput,
    pos: AtlasPosInput,
    mod_prefix: &str,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::seal_data_to_def(item, pos);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_seal(&def, mod_prefix);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

fn compile_edition_lua_from_input(
    item: &EditionDataInput,
    mod_prefix: &str,
    global_user_variables: &[UserVariableDef],
) -> String {
    let mut def = super::export::edition_data_to_def(item);
    merge_global_user_vars(&mut def.user_variables, global_user_variables);
    let chunk = compile_edition(&def, mod_prefix);
    strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
}

/// Compile a single joker from raw frontend data.
///
/// Accepts the unmodified TypeScript `JokerData` object. The Rust `export`
/// module handles all normalisation (rarity, description splitting: display
/// size: user variables) that was previously done by the TypeScript
/// `mapJokerToRustDef` helper.
#[tauri::command]
pub fn compile_joker_from_data(
    joker_data: JokerDataInput,
    pos: AtlasPosInput,
    soul_pos: Option<AtlasPosInput>,
    mod_prefix: String,
    include_loc_txt: bool,
    global_user_variables: Option<Vec<super::export::UserVariableInput>>,
) -> Result<String, String> {
    let mapped_globals = global_user_variables
        .as_deref()
        .map(super::export::map_user_variable_inputs)
        .unwrap_or_default();
    Ok(compile_joker_lua_from_input(
        &joker_data,
        pos,
        soul_pos,
        &mod_prefix,
        include_loc_txt,
        &mapped_globals,
    ))
}

#[tauri::command]
pub fn compile_item_from_data(
    item_type: String,
    item_data: Value,
    pos: Option<AtlasPosInput>,
    soul_pos: Option<AtlasPosInput>,
    mod_prefix: String,
    include_loc_txt: bool,
    global_user_variables: Option<Vec<super::export::UserVariableInput>>,
) -> Result<String, String> {
    let base_pos = pos.unwrap_or(AtlasPosInput { x: 0, y: 0 });
    let mapped_globals = global_user_variables
        .as_deref()
        .map(super::export::map_user_variable_inputs)
        .unwrap_or_default();

    match item_type.as_str() {
        "joker" => {
            let parsed: JokerDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid joker data: {}", e))?;
            Ok(compile_joker_lua_from_input(
                &parsed,
                base_pos,
                soul_pos,
                &mod_prefix,
                include_loc_txt,
                &mapped_globals,
            ))
        }
        "consumable" => {
            let parsed: ConsumableDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid consumable data: {}", e))?;
            Ok(compile_consumable_lua_from_input(
                &parsed,
                base_pos,
                soul_pos,
                &mod_prefix,
                &mapped_globals,
            ))
        }
        "voucher" => {
            let parsed: VoucherDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid voucher data: {}", e))?;
            Ok(compile_voucher_lua_from_input(
                &parsed,
                base_pos,
                soul_pos,
                &mod_prefix,
                &mapped_globals,
            ))
        }
        "deck" => {
            let parsed: DeckDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid deck data: {}", e))?;
            Ok(compile_deck_lua_from_input(
                &parsed,
                base_pos,
                &mod_prefix,
                &mapped_globals,
            ))
        }
        "enhancement" => {
            let parsed: EnhancementDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid enhancement data: {}", e))?;
            Ok(compile_enhancement_lua_from_input(
                &parsed,
                base_pos,
                &mod_prefix,
                &mapped_globals,
            ))
        }
        "seal" => {
            let parsed: SealDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid seal data: {}", e))?;
            Ok(compile_seal_lua_from_input(
                &parsed,
                base_pos,
                &mod_prefix,
                &mapped_globals,
            ))
        }
        "edition" => {
            let parsed: EditionDataInput = serde_json::from_value(item_data)
                .map_err(|e| format!("Invalid edition data: {}", e))?;
            Ok(compile_edition_lua_from_input(
                &parsed,
                &mod_prefix,
                &mapped_globals,
            ))
        }
        _ => Err(format!("Unsupported item type: {}", item_type)),
    }
}

/// Compile and write a batch of jokers to disk in a single IPC call.
///
/// Replaces the TypeScript `for (const joker of sorted)` loop that called
/// `compile_joker_lua_with_options` then `writeTextFile` once per joker.
/// Moving both steps here eliminates N round-trips across the Tauri bridge and
/// removes `mapJokerToRustDef` / `mapRules` from the TypeScript layer entirely.
///
/// The `joker_folder_path` directory must already exist (TypeScript still owns
/// directory scaffolding via the Tauri FS plugin).
///
/// Returns the number of files written.
#[tauri::command]
pub fn batch_export_jokers(
    joker_folder_path: String,
    mod_prefix: String,
    jokers: Vec<BatchJokerEntry>,
    include_loc_txt: bool,
) -> Result<usize, String> {
    let folder = std::path::Path::new(&joker_folder_path);
    let mut count = 0;

    for entry in &jokers {
        let lua = if let Some(custom) = &entry.custom_lua {
            custom.clone()
        } else {
            let joker_def = super::export::joker_data_to_def(
                &entry.joker_data,
                &mod_prefix,
                entry.pos.clone(),
                entry.soul_pos.clone(),
            );
            let chunk = compile_joker_with_options(&joker_def, &mod_prefix, include_loc_txt);
            strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
        };

        let path = folder.join(&entry.file_name);
        std::fs::write(&path, lua.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
        count += 1;
    }

    Ok(count)
}

/// Export a full mod package (main file, metadata JSON, atlas assets, all item types)
/// in a single Rust command.
#[tauri::command]
pub fn export_mod_package(
    mod_folder_path: String,
    metadata: ModMetadataInput,
    rarities: Vec<RarityDataInput>,
    consumable_sets: Vec<ConsumableSetDataInput>,
    jokers: Vec<BatchJokerEntry>,
    consumables: Vec<BatchConsumableEntry>,
    vouchers: Vec<BatchVoucherEntry>,
    decks: Vec<BatchDeckEntry>,
    enhancements: Vec<BatchEnhancementEntry>,
    seals: Vec<BatchSealEntry>,
    editions: Vec<BatchEditionEntry>,
    include_loc_txt: bool,
    use_localization_file: bool,
    localization_locale: Option<String>,
    atlas_1x_png: Option<Vec<u8>>,
    atlas_2x_png: Option<Vec<u8>>,
    consumables_atlas_1x_png: Option<Vec<u8>>,
    consumables_atlas_2x_png: Option<Vec<u8>>,
    vouchers_atlas_1x_png: Option<Vec<u8>>,
    vouchers_atlas_2x_png: Option<Vec<u8>>,
    enhancements_atlas_1x_png: Option<Vec<u8>>,
    enhancements_atlas_2x_png: Option<Vec<u8>>,
    seals_atlas_1x_png: Option<Vec<u8>>,
    seals_atlas_2x_png: Option<Vec<u8>>,
    decks_atlas_1x_png: Option<Vec<u8>>,
    decks_atlas_2x_png: Option<Vec<u8>>,
    remove_other_managed_mods: bool,
    managed_mod_folder_names: Option<Vec<String>>,
) -> Result<usize, String> {
    let root = Path::new(&mod_folder_path);
    if remove_other_managed_mods {
        if let Some(managed_mod_folder_names) = managed_mod_folder_names {
            let current_mod_folder_name = root
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| {
                    format!(
                        "Could not resolve mod folder name from export path: {}",
                        mod_folder_path
                    )
                })?;
            remove_other_managed_mod_folders(
                root,
                current_mod_folder_name,
                &managed_mod_folder_names,
            )?;
        }
    }
    fs::create_dir_all(root)
        .map_err(|e| format!("Failed to create mod folder {}: {}", mod_folder_path, e))?;

    let mut file_count = 0;
    let all_global_vars = super::export::collect_global_user_variables(
        &jokers,
        &consumables,
        &vouchers,
        &decks,
        &enhancements,
        &seals,
        &editions,
    );
    let persistent_global_vars = super::export::collect_persistent_global_user_variables(
        &jokers,
        &consumables,
        &vouchers,
        &decks,
        &enhancements,
        &seals,
        &editions,
    );
    let run_scoped_global_vars = super::export::collect_run_scoped_global_user_variables(
        &jokers,
        &consumables,
        &vouchers,
        &decks,
        &enhancements,
        &seals,
        &editions,
    );
    let has_persistent_global_vars = !persistent_global_vars.is_empty();

    let main_path = root.join(&metadata.main_file);
    let main_lua = format_lua_source(&super::export::build_main_lua(
        &jokers,
        &consumables,
        &vouchers,
        &decks,
        &enhancements,
        &seals,
        &editions,
        !rarities.is_empty(),
        !consumable_sets.is_empty(),
        has_persistent_global_vars,
        &run_scoped_global_vars,
    ));
    fs::write(&main_path, main_lua.as_bytes())
        .map_err(|e| format!("Failed to write {}: {}", main_path.display(), e))?;
    file_count += 1;

    if has_persistent_global_vars {
        let globals_path = root.join("globals.lua");
        let globals_lua =
            format_lua_source(&super::export::build_globals_lua(&persistent_global_vars));
        fs::write(&globals_path, globals_lua.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", globals_path.display(), e))?;
        file_count += 1;
    }

    let json_path = root.join(format!("{}.json", metadata.id));
    let mod_json = super::export::build_mod_json(&metadata)?;
    fs::write(&json_path, mod_json.as_bytes())
        .map_err(|e| format!("Failed to write {}: {}", json_path.display(), e))?;
    file_count += 1;

    if !rarities.is_empty() {
        let mut sorted_rarities: Vec<&RarityDataInput> = rarities.iter().collect();
        sorted_rarities.sort_by(|a, b| {
            a.key
                .trim()
                .to_ascii_lowercase()
                .cmp(&b.key.trim().to_ascii_lowercase())
        });

        let rarity_lua = sorted_rarities
            .iter()
            .map(|item| {
                let def = super::export::rarity_data_to_def(item);
                let chunk = compile_rarity(&def, &metadata.prefix);
                strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
            })
            .collect::<Vec<String>>()
            .join("\n");

        let rarity_path = root.join("rarities.lua");
        fs::write(&rarity_path, rarity_lua.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", rarity_path.display(), e))?;
        file_count += 1;
    }

    if !consumable_sets.is_empty() {
        let consumables_dir = root.join("consumables");
        fs::create_dir_all(&consumables_dir)
            .map_err(|e| format!("Failed to create {}: {}", consumables_dir.display(), e))?;

        let mut sorted_sets: Vec<&ConsumableSetDataInput> = consumable_sets.iter().collect();
        sorted_sets.sort_by(|a, b| {
            a.key
                .trim()
                .to_ascii_lowercase()
                .cmp(&b.key.trim().to_ascii_lowercase())
        });

        let sets_lua = sorted_sets
            .iter()
            .map(|item| {
                let def = super::export::consumable_set_data_to_def(item);
                let chunk = compile_consumable_type(&def, &metadata.prefix);
                strip_export_comments(&format_lua_source(&LuaEmitter::new().emit_chunk(&chunk)))
            })
            .collect::<Vec<String>>()
            .join("\n");

        let sets_path = consumables_dir.join("sets.lua");
        fs::write(&sets_path, sets_lua.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", sets_path.display(), e))?;
        file_count += 1;
    }

    // Write atlas PNGs
    let write_atlas = |scale: &str, name: &str, bytes: Vec<u8>| -> Result<(), String> {
        let path = root.join("assets").join(scale).join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
        }
        fs::write(&path, bytes).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
    };

    if let Some(b) = atlas_1x_png {
        write_atlas("1x", "CustomJokers.png", b)?;
        file_count += 1;
    }
    if let Some(b) = atlas_2x_png {
        write_atlas("2x", "CustomJokers.png", b)?;
        file_count += 1;
    }
    if let Some(b) = consumables_atlas_1x_png {
        write_atlas("1x", "CustomConsumables.png", b)?;
        file_count += 1;
    }
    if let Some(b) = consumables_atlas_2x_png {
        write_atlas("2x", "CustomConsumables.png", b)?;
        file_count += 1;
    }
    if let Some(b) = enhancements_atlas_1x_png {
        write_atlas("1x", "CustomEnhancements.png", b)?;
        file_count += 1;
    }
    if let Some(b) = enhancements_atlas_2x_png {
        write_atlas("2x", "CustomEnhancements.png", b)?;
        file_count += 1;
    }
    if let Some(b) = seals_atlas_1x_png {
        write_atlas("1x", "CustomSeals.png", b)?;
        file_count += 1;
    }
    if let Some(b) = seals_atlas_2x_png {
        write_atlas("2x", "CustomSeals.png", b)?;
        file_count += 1;
    }
    if let Some(b) = vouchers_atlas_1x_png {
        write_atlas("1x", "CustomVouchers.png", b)?;
        file_count += 1;
    }
    if let Some(b) = vouchers_atlas_2x_png {
        write_atlas("2x", "CustomVouchers.png", b)?;
        file_count += 1;
    }
    if let Some(b) = decks_atlas_1x_png {
        write_atlas("1x", "CustomDecks.png", b)?;
        file_count += 1;
    }
    if let Some(b) = decks_atlas_2x_png {
        write_atlas("2x", "CustomDecks.png", b)?;
        file_count += 1;
    }

    // Write jokers
    if !jokers.is_empty() {
        let dir = root.join("jokers");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &jokers {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_joker_lua_from_input(
                    &entry.joker_data,
                    entry.pos.clone(),
                    entry.soul_pos.clone(),
                    &metadata.prefix,
                    include_loc_txt,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    // Write consumables
    if !consumables.is_empty() {
        let dir = root.join("consumables");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &consumables {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_consumable_lua_from_input(
                    &entry.consumable_data,
                    entry.pos.clone(),
                    entry.soul_pos.clone(),
                    &metadata.prefix,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    // Write vouchers
    if !vouchers.is_empty() {
        let dir = root.join("vouchers");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &vouchers {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_voucher_lua_from_input(
                    &entry.voucher_data,
                    entry.pos.clone(),
                    entry.soul_pos.clone(),
                    &metadata.prefix,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    // Write decks
    if !decks.is_empty() {
        let dir = root.join("decks");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &decks {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_deck_lua_from_input(
                    &entry.deck_data,
                    entry.pos.clone(),
                    &metadata.prefix,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    // Write enhancements
    if !enhancements.is_empty() {
        let dir = root.join("enhancements");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &enhancements {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_enhancement_lua_from_input(
                    &entry.enhancement_data,
                    entry.pos.clone(),
                    &metadata.prefix,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    // Write seals
    if !seals.is_empty() {
        let dir = root.join("seals");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &seals {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_seal_lua_from_input(
                    &entry.seal_data,
                    entry.pos.clone(),
                    &metadata.prefix,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    // Write editions
    if !editions.is_empty() {
        let dir = root.join("editions");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
        for entry in &editions {
            let lua = if let Some(custom) = &entry.custom_lua {
                custom.clone()
            } else {
                compile_edition_lua_from_input(
                    &entry.edition_data,
                    &metadata.prefix,
                    &all_global_vars,
                )
            };
            fs::write(dir.join(&entry.file_name), lua.as_bytes())
                .map_err(|e| format!("Failed to write {}: {}", entry.file_name, e))?;
            file_count += 1;
        }
    }

    if use_localization_file {
        let locale = localization_locale.unwrap_or_else(|| "en-us".to_string());
        let localization_dir = root.join("localization");
        fs::create_dir_all(&localization_dir)
            .map_err(|e| format!("Failed to create {}: {}", localization_dir.display(), e))?;
        let loc_path = localization_dir.join(format!("{}.lua", locale));
        let loc_lua = format_lua_source(&super::export::build_localization_lua(
            &metadata.prefix,
            &jokers,
        ));
        fs::write(&loc_path, loc_lua.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", loc_path.display(), e))?;
        file_count += 1;
    }

    Ok(file_count)
}

fn remove_other_managed_mod_folders(
    current_mod_folder_path: &Path,
    current_mod_folder_name: &str,
    managed_mod_folder_names: &[String],
) -> Result<(), String> {
    let mods_root = current_mod_folder_path.parent().ok_or_else(|| {
        format!(
            "Could not resolve parent mods folder for {}",
            current_mod_folder_path.display()
        )
    })?;

    let managed_set: HashSet<String> = managed_mod_folder_names
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .collect();

    if managed_set.is_empty() {
        return Ok(());
    }

    for entry in fs::read_dir(mods_root)
        .map_err(|e| format!("Failed to read mods folder {}: {}", mods_root.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = entry.file_name();
        let folder_name = folder_name.to_string_lossy().to_string();
        if folder_name.eq_ignore_ascii_case(current_mod_folder_name) {
            continue;
        }
        if !managed_set.contains(&folder_name.to_ascii_lowercase()) {
            continue;
        }

        fs::remove_dir_all(&path).map_err(|e| {
            format!(
                "Failed to remove managed mod folder {}: {}",
                path.display(),
                e
            )
        })?;
    }

    Ok(())
}

fn merge_global_user_vars(target: &mut Vec<UserVariableDef>, global_vars: &[UserVariableDef]) {
    let mut seen: HashSet<String> = target
        .iter()
        .map(|v| v.name.trim().to_ascii_lowercase())
        .collect();

    for global in global_vars {
        let key = global.name.trim().to_ascii_lowercase();
        if key.is_empty() || seen.contains(&key) {
            continue;
        }
        target.push(global.clone());
        seen.insert(key);
    }
}

fn strip_export_comments(lua: &str) -> String {
    let mut lines: Vec<&str> = lua
        .lines()
        .filter(|line| !line.trim_start().starts_with("--"))
        .collect();

    while lines.last().is_some_and(|line| line.trim().is_empty()) {
        lines.pop();
    }

    if lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", lines.join("\n"))
    }
}

fn join_relative_path(root: &Path, relative: &str) -> PathBuf {
    relative
        .split('/')
        .filter(|segment| !segment.is_empty())
        .fold(root.to_path_buf(), |current, segment| current.join(segment))
}

fn resolve_bundled_path(app: &AppHandle, relative: &str) -> Option<PathBuf> {
    if let Ok(resource_path) = app.path().resolve(relative, BaseDirectory::Resource) {
        if resource_path.exists() {
            return Some(resource_path);
        }
    }

    let dev_fallback_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("public");
    let dev_fallback = join_relative_path(&dev_fallback_root, relative);
    if dev_fallback.exists() {
        return Some(dev_fallback);
    }

    None
}

fn path_name_eq(path: &Path, expected: &str) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case(expected))
        .unwrap_or(false)
}

fn normalize_slashes(input: &str) -> String {
    input.replace('/', "\\")
}

fn to_existing_dir(path: &Path) -> Option<PathBuf> {
    path.exists().then(|| path.to_path_buf())
}

fn has_balatro_exe(path: &Path) -> bool {
    path.join("Balatro.exe").exists()
}

fn resolve_appdata_root_from_any_path(raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let normalized = normalize_slashes(trimmed);
    let candidate = PathBuf::from(normalized);
    if !candidate.exists() {
        return None;
    }

    if candidate.is_file() {
        return None;
    }

    if has_balatro_exe(&candidate) {
        return None;
    }

    if path_name_eq(&candidate, "Mods") || path_name_eq(&candidate, "mods") {
        if let Some(parent) = candidate.parent() {
            if path_name_eq(parent, "Balatro") {
                return to_existing_dir(parent);
            }
        }
    }

    if path_name_eq(&candidate, "Balatro") {
        return to_existing_dir(&candidate);
    }

    candidate
        .ancestors()
        .find(|ancestor| path_name_eq(ancestor, "Balatro") && !has_balatro_exe(ancestor))
        .and_then(to_existing_dir)
}

fn resolve_default_balatro_appdata_root() -> Option<PathBuf> {
    if let Some(app_data) = env::var_os("APPDATA") {
        let candidate = PathBuf::from(app_data).join("Balatro");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    if let Some(user_profile) = env::var_os("USERPROFILE") {
        let candidate = PathBuf::from(user_profile)
            .join("AppData")
            .join("Roaming")
            .join("Balatro");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn resolve_mods_dir_from_appdata(appdata_root: &Path) -> PathBuf {
    let uppercase = appdata_root.join("Mods");
    let lowercase = appdata_root.join("mods");
    if uppercase.exists() {
        return uppercase;
    }
    if lowercase.exists() {
        return lowercase;
    }
    uppercase
}

fn resolve_game_dir_from_any_path(raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let normalized = normalize_slashes(trimmed);
    let candidate = PathBuf::from(normalized);
    if !candidate.exists() {
        return None;
    }

    if candidate.is_file()
        && candidate
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("Balatro.exe"))
            .unwrap_or(false)
    {
        return candidate.parent().map(|parent| parent.to_path_buf());
    }

    if candidate.is_dir() {
        if has_balatro_exe(&candidate) {
            return Some(candidate);
        }

        let common_candidate = candidate.join("Balatro");
        if has_balatro_exe(&common_candidate) {
            return Some(common_candidate);
        }

        let steamapps_candidate = candidate.join("common").join("Balatro");
        if has_balatro_exe(&steamapps_candidate) {
            return Some(steamapps_candidate);
        }

        let library_candidate = candidate.join("steamapps").join("common").join("Balatro");
        if has_balatro_exe(&library_candidate) {
            return Some(library_candidate);
        }
    }

    None
}

fn collect_drive_roots() -> Vec<PathBuf> {
    (b'A'..=b'Z')
        .map(|letter| format!("{}:\\", letter as char))
        .map(PathBuf::from)
        .filter(|root| root.exists())
        .collect()
}

fn collect_candidate_steam_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();

    if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
        roots.push(PathBuf::from(program_files_x86).join("Steam"));
    }
    if let Some(program_files) = env::var_os("ProgramFiles") {
        roots.push(PathBuf::from(program_files).join("Steam"));
    }

    for drive_root in collect_drive_roots() {
        roots.push(drive_root.join("Steam"));
        roots.push(drive_root.join("Program Files (x86)").join("Steam"));
        roots.push(drive_root.join("Program Files").join("Steam"));
    }

    let mut deduped = HashSet::new();
    roots
        .into_iter()
        .filter(|path| deduped.insert(path.to_string_lossy().to_lowercase()))
        .filter(|path| path.exists())
        .collect()
}

fn extract_quoted_tokens(line: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut escaped = false;

    for ch in line.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '"' {
            if in_quotes {
                tokens.push(current.clone());
                current.clear();
                in_quotes = false;
            } else {
                in_quotes = true;
            }
            continue;
        }
        if in_quotes {
            current.push(ch);
        }
    }

    tokens
}

fn parse_libraryfolders_vdf(content: &str) -> Vec<PathBuf> {
    content
        .lines()
        .filter_map(|line| {
            let tokens = extract_quoted_tokens(line);
            if tokens.len() < 2 {
                return None;
            }
            if !tokens[0].eq_ignore_ascii_case("path") {
                return None;
            }
            let value = tokens[1].replace("\\\\", "\\");
            let path = PathBuf::from(value);
            path.exists().then_some(path)
        })
        .collect()
}

fn collect_library_roots_from_steam() -> Vec<PathBuf> {
    let mut library_roots: Vec<PathBuf> = Vec::new();
    let mut seen = HashSet::new();

    for steam_root in collect_candidate_steam_roots() {
        if seen.insert(steam_root.to_string_lossy().to_lowercase()) {
            library_roots.push(steam_root.clone());
        }

        let libraryfiles = [
            steam_root.join("steamapps").join("libraryfolders.vdf"),
            steam_root.join("config").join("libraryfolders.vdf"),
        ];

        for file in libraryfiles {
            if !file.exists() {
                continue;
            }
            let Ok(contents) = fs::read_to_string(&file) else {
                continue;
            };
            for root in parse_libraryfolders_vdf(&contents) {
                if seen.insert(root.to_string_lossy().to_lowercase()) {
                    library_roots.push(root);
                }
            }
        }
    }

    for drive_root in collect_drive_roots() {
        let direct_library = drive_root.join("SteamLibrary");
        if direct_library.exists() && seen.insert(direct_library.to_string_lossy().to_lowercase()) {
            library_roots.push(direct_library);
        }
    }

    library_roots
}

fn auto_find_balatro_game_dir() -> Option<PathBuf> {
    for library_root in collect_library_roots_from_steam() {
        let direct = library_root
            .join("steamapps")
            .join("common")
            .join("Balatro");
        if has_balatro_exe(&direct) {
            return Some(direct);
        }

        let common_root = library_root.join("common").join("Balatro");
        if has_balatro_exe(&common_root) {
            return Some(common_root);
        }
    }

    None
}

fn resolve_balatro_paths_internal(
    configured_appdata_path: Option<String>,
    configured_game_path: Option<String>,
    legacy_path: Option<String>,
) -> (Option<PathBuf>, Option<PathBuf>) {
    let appdata = configured_appdata_path
        .as_deref()
        .and_then(resolve_appdata_root_from_any_path)
        .or_else(|| {
            legacy_path
                .as_deref()
                .and_then(resolve_appdata_root_from_any_path)
        })
        .or_else(resolve_default_balatro_appdata_root);

    let game = configured_game_path
        .as_deref()
        .and_then(resolve_game_dir_from_any_path)
        .or_else(|| {
            legacy_path
                .as_deref()
                .and_then(resolve_game_dir_from_any_path)
        })
        .or_else(auto_find_balatro_game_dir);

    (appdata, game)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoDetectedBalatroPaths {
    pub appdata_path: Option<String>,
    pub game_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BalatroSetupResult {
    pub appdata_path: String,
    pub game_path: String,
    pub mods_path: String,
}

#[tauri::command]
pub fn auto_find_balatro_paths(
    configured_appdata_path: Option<String>,
    configured_game_path: Option<String>,
    legacy_path: Option<String>,
) -> AutoDetectedBalatroPaths {
    let (appdata, game) =
        resolve_balatro_paths_internal(configured_appdata_path, configured_game_path, legacy_path);

    AutoDetectedBalatroPaths {
        appdata_path: appdata.map(|path| path.to_string_lossy().to_string()),
        game_path: game.map(|path| path.to_string_lossy().to_string()),
    }
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|e| format!("Failed to create {}: {}", target.display(), e))?;

    for entry in fs::read_dir(source)
        .map_err(|e| format!("Failed to read directory {}: {}", source.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let metadata = entry.metadata().map_err(|e| {
            format!(
                "Failed to read metadata for {}: {}",
                source_path.display(),
                e
            )
        })?;

        if metadata.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else if metadata.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
            }
            fs::copy(&source_path, &target_path).map_err(|e| {
                format!(
                    "Failed to copy {} to {}: {}",
                    source_path.display(),
                    target_path.display(),
                    e
                )
            })?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn ensure_balatro_mod_setup(
    appdata_path: Option<String>,
    game_path: Option<String>,
    legacy_path: Option<String>,
    app: AppHandle,
) -> Result<BalatroSetupResult, String> {
    let (resolved_appdata, resolved_game) =
        resolve_balatro_paths_internal(appdata_path, game_path, legacy_path);

    let appdata_root =
        resolved_appdata.ok_or_else(|| "Unable to find Balatro AppData folder.".to_string())?;
    let game_dir =
        resolved_game.ok_or_else(|| "Unable to find Balatro game folder.".to_string())?;

    let version_dll_target = game_dir.join("version.dll");
    let version_dll_source = resolve_bundled_path(&app, "other/version.dll")
        .ok_or_else(|| "Missing bundled Lovely file: other/version.dll".to_string())?;
    if let Some(parent) = version_dll_target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
    }
    if !version_dll_target.exists() {
        fs::copy(&version_dll_source, &version_dll_target).map_err(|e| {
            format!(
                "Failed to install Lovely (copy {} to {}): {}",
                version_dll_source.display(),
                version_dll_target.display(),
                e
            )
        })?;
    }

    let mods_dir = resolve_mods_dir_from_appdata(&appdata_root);
    if mods_dir.exists() && !mods_dir.is_dir() {
        return Err(format!(
            "Balatro Mods path exists but is not a folder: {}",
            mods_dir.display()
        ));
    }
    fs::create_dir_all(&mods_dir)
        .map_err(|e| format!("Failed to create Mods folder {}: {}", mods_dir.display(), e))?;

    let smods_target = mods_dir.join("smods");
    if smods_target.exists() && !smods_target.is_dir() {
        return Err(format!(
            "Steamodded target exists but is not a folder: {}",
            smods_target.display()
        ));
    }
    let smods_manifest = smods_target.join("manifest.json");
    let smods_src_dir = smods_target.join("src");
    let should_sync_smods =
        !smods_target.exists() || !smods_manifest.exists() || !smods_src_dir.is_dir();
    if should_sync_smods {
        let smods_source = resolve_bundled_path(&app, "other/smods-main")
            .ok_or_else(|| "Missing bundled Steamodded folder: other/smods-main".to_string())?;
        copy_dir_recursive(&smods_source, &smods_target)?;
    }

    Ok(BalatroSetupResult {
        appdata_path: appdata_root.to_string_lossy().to_string(),
        game_path: game_dir.to_string_lossy().to_string(),
        mods_path: mods_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn download_release_asset(
    url: String,
    file_name: String,
    app: AppHandle,
) -> Result<String, String> {
    if !url.starts_with("https://github.com/") {
        return Err("Unsupported download host".to_string());
    }

    let sanitized_file_name = Path::new(&file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch installer: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch installer (status {})",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read installer bytes: {}", e))?;

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to resolve download directory: {}", e))?;

    let target_path = download_dir.join(sanitized_file_name);
    fs::write(&target_path, &bytes)
        .map_err(|e| format!("Failed to write installer to disk: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn install_update_and_restart(installer_path: String) -> Result<(), String> {
    install_update_and_restart_impl(installer_path)
}

#[cfg(target_os = "windows")]
fn install_update_and_restart_impl(installer_path: String) -> Result<(), String> {
    use std::env;
    use std::fs;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    let exe_path =
        env::current_exe().map_err(|e| format!("Failed to get current executable path: {}", e))?;

    let mut script_path = env::temp_dir();
    script_path.push(format!("update_{}.bat", std::process::id()));

    let script_content = format!(
        "@echo off\r\n\
         ping 127.0.0.1 -n 3 > nul\r\n\
         start /wait \"\" \"{}\" /S\r\n\
         set \"INSTALLER={}\" \r\n\
         if exist \"%INSTALLER%\" (\r\n\
           for /l %%i in (1,1,10) do (\r\n\
             del /f /q \"%INSTALLER%\" > nul 2>&1\r\n\
             if not exist \"%INSTALLER%\" goto :installer_deleted\r\n\
             ping 127.0.0.1 -n 2 > nul\r\n\
           )\r\n\
         )\r\n\
         :installer_deleted\r\n\
         start \"\" \"{}\"\r\n\
         del \"%~f0\"\r\n",
        installer_path,
        installer_path,
        exe_path.to_string_lossy()
    );

    fs::write(&script_path, script_content)
        .map_err(|e| format!("Failed to write update script: {}", e))?;

    let create_no_window = 0x08000000;
    Command::new("cmd.exe")
        .arg("/C")
        .arg(&script_path)
        .creation_flags(create_no_window)
        .spawn()
        .map_err(|e| format!("Failed to spawn update script: {}", e))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn install_update_and_restart_impl(installer_path: String) -> Result<(), String> {
    use std::process::Command;
    Command::new(&installer_path)
        .spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
pub fn launch_or_relaunch_balatro(game_path: String) -> Result<(), String> {
    use std::process::Command;

    let game_dir = resolve_game_dir_from_any_path(&game_path)
        .ok_or_else(|| "Unable to resolve Balatro game folder.".to_string())?;
    let exe_path = game_dir.join("Balatro.exe");
    if !exe_path.exists() {
        return Err(format!("Balatro.exe not found at {}", exe_path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/IM", "Balatro.exe", "/F"])
            .output();
    }

    Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Failed to launch Balatro.exe: {}", e))?;

    Ok(())
}
