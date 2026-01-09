use std::fs;
use std::path::PathBuf;

use crate::workspace::WorkspaceFile;

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(PathBuf::from(path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), contents)
        .map_err(|e| e.to_string())
}


/**
 * Function to load a workspace.json file from directory 
 */
#[tauri::command]
pub fn load_workspace(path: String) -> Result<WorkspaceFile, String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| e.to_string())?;

    let workspace: WorkspaceFile =
        serde_json::from_str(&content)
            .map_err(|e| e.to_string())?;

    Ok(workspace)
}

/**
 * Function to save workspace incase workspace.json doesnt exist
 */
#[tauri::command]
pub fn save_workspace(path: String, workspace: WorkspaceFile) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&workspace)
        .map_err(|e| e.to_string())?;

    fs::write(path, json)
        .map_err(|e| e.to_string())
}

