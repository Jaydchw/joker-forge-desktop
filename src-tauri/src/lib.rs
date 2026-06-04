mod cli_codegen_item;
mod mod_engine;

use mod_engine::{commands, state::AppState};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process,
    sync::Mutex,
};
use tauri::{Emitter, Manager, State};

const FILE_OPEN_EVENT: &str = "jokerforge-file-open";
const ASSOCIATED_EXTENSIONS: [&str; 3] = ["jokerforge", "jftemplate", "jftheme"];

struct PendingFileOpenPaths(Mutex<Vec<String>>);

fn is_associated_file_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            ASSOCIATED_EXTENSIONS
                .iter()
                .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
        .unwrap_or(false)
}

fn file_url_to_path(value: &str) -> Option<PathBuf> {
    let url = tauri::Url::parse(value).ok()?;
    if url.scheme() != "file" {
        return None;
    }
    url.to_file_path().ok()
}

fn resolve_file_open_arg(value: &str, cwd: Option<&str>) -> Option<String> {
    let path = if value.starts_with("file://") {
        file_url_to_path(value)?
    } else {
        let candidate = PathBuf::from(value);
        if candidate.is_absolute() {
            candidate
        } else {
            PathBuf::from(cwd?).join(candidate)
        }
    };

    if !is_associated_file_path(&path) {
        return None;
    }

    Some(path.to_string_lossy().to_string())
}

fn associated_file_paths_from_args(args: &[String], cwd: Option<&str>) -> Vec<String> {
    args.iter()
        .filter_map(|arg| resolve_file_open_arg(arg, cwd))
        .collect()
}

fn emit_file_open_paths(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let _ = app.emit(FILE_OPEN_EVENT, paths);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn take_pending_file_open_paths(state: State<'_, PendingFileOpenPaths>) -> Vec<String> {
    match state.0.lock() {
        Ok(mut pending) => std::mem::take(&mut *pending),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
fn read_associated_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !is_associated_file_path(&path) {
        return Err("Unsupported Joker Forge file type.".to_string());
    }
    fs::read_to_string(&path).map_err(|error| {
        format!(
            "Failed to read associated file {}: {}",
            path.display(),
            error
        )
    })
}

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
    let cwd = env::current_dir()
        .ok()
        .map(|path| path.to_string_lossy().to_string());
    let initial_file_open_paths = associated_file_paths_from_args(&args, cwd.as_deref());

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = associated_file_paths_from_args(&args, Some(&cwd));
            emit_file_open_paths(app, paths);
        }));
    }

    builder
        .manage(PendingFileOpenPaths(Mutex::new(initial_file_open_paths)))
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
            take_pending_file_open_paths,
            read_associated_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {});
}
