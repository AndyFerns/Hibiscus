mod commands;
mod workspace;
mod tree;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Hibiscus!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // lib.rs level commands
            greet,

            // commands.rs module commands
            commands::read_text_file,
            commands::write_text_file,

            // workspace commands
            commands::load_workspace,
            commands::save_workspace,
            commands::discover_workspace,

            // Tree builder commands
            commands::build_tree,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hibiscus");
}
