mod mod_engine;

use mod_engine::{commands, state::AppState};
use mod_engine::export::{AtlasPosInput, UserVariableInput};
use serde::Deserialize;
use serde_json::Value;
use std::{env, fs, process};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliCodegenItemRequest {
    item_type: String,
    item_data: Value,
    #[serde(default)]
    pos: Option<AtlasPosInput>,
    #[serde(default)]
    soul_pos: Option<AtlasPosInput>,
    #[serde(default = "default_mod_prefix")]
    mod_prefix: String,
    #[serde(default = "default_include_loc_txt")]
    include_loc_txt: bool,
    #[serde(default)]
    global_user_variables: Option<Vec<UserVariableInput>>,
}

fn default_mod_prefix() -> String {
    "mod".to_string()
}

fn default_include_loc_txt() -> bool {
    true
}

fn print_codegen_item_usage() {
    eprintln!(
        "Usage:\n  joker-forge-desktop codegen-item --json '<payload>'\n  joker-forge-desktop codegen-item --json-file <path>"
    );
}

fn run_codegen_item_command(args: &[String]) -> Result<(), String> {
    let mut json_payload: Option<String> = None;
    let mut json_file: Option<String> = None;

    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value for --json".to_string())?;
                json_payload = Some(value.clone());
            }
            "--json-file" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value for --json-file".to_string())?;
                json_file = Some(value.clone());
            }
            unknown => {
                return Err(format!("Unknown argument: {}", unknown));
            }
        }
        index += 1;
    }

    if json_payload.is_some() == json_file.is_some() {
        return Err("Provide exactly one of --json or --json-file".to_string());
    }

    let raw_json = if let Some(path) = json_file {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read JSON file '{}': {}", path, e))?
    } else {
        json_payload.expect("checked above")
    };

    let request: CliCodegenItemRequest = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Invalid JSON payload: {}", e))?;

    let lua = commands::compile_item_from_data(
        request.item_type,
        request.item_data,
        request.pos,
        request.soul_pos,
        request.mod_prefix,
        request.include_loc_txt,
        request.global_user_variables,
    )?;

    println!("{}", lua);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = env::args().collect();
    if let Some(command) = args.get(1) {
        if command == "codegen-item" {
            if let Err(error) = run_codegen_item_command(&args[2..]) {
                eprintln!("codegen-item error: {}", error);
                print_codegen_item_usage();
                process::exit(1);
            }
            process::exit(0);
        }
    }

    let app_state = AppState::new().expect("failed to initialize mod engine state");

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_rulebuilder_catalog,
            commands::init_entity,
            commands::add_node,
            commands::remove_node,
            commands::connect_nodes,
            commands::disconnect_nodes,
            commands::update_node_value,
            commands::get_node_snippet,
            // Legacy compilation commands (kept for backward compatibility)
            commands::compile_joker_lua,
            commands::compile_joker_lua_with_options,
            commands::compile_rulebuilder_node_snippet,
            commands::compile_item_from_data,
            commands::compile_item_from_data_with_segments,
            // Unified export commands, accept raw JokerData, eliminate TS mapping
            commands::compile_joker_from_data,
            commands::batch_export_jokers,
            commands::export_mod_package,
            commands::auto_find_balatro_paths,
            commands::ensure_balatro_mod_setup,
            commands::download_release_asset,
            commands::install_update_and_restart,
            commands::open_devtools,
            commands::open_folder_in_file_manager,
            commands::can_launch_balatro,
            commands::launch_or_relaunch_balatro,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
