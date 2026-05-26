mod cli_codegen_item;
mod mod_engine;

use mod_engine::{commands, state::AppState};
use std::{env, process};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = env::args().collect();
    if let Some(command) = args.get(1) {
        if command == "codegen-item" {
            if let Err(error) = cli_codegen_item::run_codegen_item_command(&args[2..]) {
                eprintln!("codegen-item error: {}", error);
                cli_codegen_item::print_codegen_item_usage();
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
