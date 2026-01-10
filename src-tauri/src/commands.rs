use std::fs;
use std::path::PathBuf;

use crate::workspace::WorkspaceFile;

/**
 * Function to read a file
 * 
 * path: Path of the file passed as a parameter
 */
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    if !path.is_file() {
        return Err("Path does not point to a file".into());
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {e}"))
}

/**
 * Function to write contents to a text file
 * 
 * path: Path of the file passed as a parameter
 * contents: Contents to be written to the file
 */
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directories: {e}"))?;
    }

    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file: {e}"))
}


/**
 * Function to load a workspace.json file from directory 
 */
#[tauri::command]
pub fn load_workspace(path: String) -> Result<WorkspaceFile, String> {
    let path = PathBuf::from(path);

    if !path.is_file() {
        return Err("workspace.json not found or not a file".into());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read workspace.json: {e}"))?;

    serde_json::from_str::<WorkspaceFile>(&content)
        .map_err(|e| format!("Invalid workspace.json format: {e}"))
}

/**
 * Function to save workspace incase workspace.json doesnt exist
 */
#[tauri::command]
pub fn save_workspace(path: String, workspace: WorkspaceFile) -> Result<(), String> {
    let path = PathBuf::from(path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create workspace directory: {e}"))?;
    }

    let json = serde_json::to_string_pretty(&workspace)
        .map_err(|e| format!("Failed to serialize workspace: {e}"))?;

    // Atomic write: write → rename
    let tmp_path = path.with_extension("json.tmp");

    fs::write(&tmp_path, json)
        .map_err(|e| format!("Failed to write temp workspace file: {e}"))?;

    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to finalize workspace.json: {e}"))
}



/**
 * Workspace Return Type
 */
#[derive(Debug, serde::Serialize)]
pub struct WorkspaceDiscovery {
    pub found: bool,
    pub path: Option<String>,
}

/**
 * Function to discover the existence of a workspace.json file in the root of the folder 
 */

#[tauri::command]
pub fn discover_workspace(folder: String) -> WorkspaceDiscovery {
    let mut candidate = PathBuf::from(&folder);
    candidate.push("workspace.json");

    if candidate.is_file() {
        WorkspaceDiscovery {
            found: true,
            path: Some(candidate.to_string_lossy().to_string()),
        }
    } else {
        WorkspaceDiscovery {
            found: false,
            path: None,
        }
    }
}