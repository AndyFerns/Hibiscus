// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

use std::path::PathBuf;
use tokio::fs;

use crate::error::HibiscusError;
use crate::workspace::WorkspaceFile;
use super::path::validate_path;


/// Loads a workspace.json file from the specified path.
///
/// # Arguments
/// * `path` - Path to the workspace.json file
///
/// # Returns
/// * `Ok(WorkspaceFile)` - The parsed workspace file
/// * `Err(HibiscusError)` - If loading or parsing fails
#[tauri::command]
pub async fn load_workspace(path: String) -> Result<WorkspaceFile, HibiscusError> {
    let path = PathBuf::from(&path);

    // Validate path
    validate_path(&path)?;

    if !path.exists() {
        return Err(HibiscusError::FileNotFound(
            "workspace.json not found".into(),
        ));
    }

    if !path.is_file() {
        return Err(HibiscusError::InvalidPathType {
            path: path.to_string_lossy().into(),
            expected: "file".into(),
            actual: "directory".into(),
        });
    }

    // Read file asynchronously
    let content = fs::read_to_string(&path)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to read workspace.json: {}", e)))?;

    // Parse JSON
    let workspace: WorkspaceFile = serde_json::from_str(&content)?;

    Ok(workspace)
}

/// Saves a workspace file to disk.
///
/// Uses atomic write to prevent corruption.
///
/// # Arguments
/// * `path` - Path where to save the workspace.json
/// * `workspace` - The workspace data to save
///
/// # Returns
/// * `Ok(())` - If save was successful
/// * `Err(HibiscusError)` - If save failed
#[tauri::command]
pub async fn save_workspace(path: String, workspace: WorkspaceFile) -> Result<(), HibiscusError> {
    let path = PathBuf::from(&path);

    // Validate path
    validate_path(&path)?;

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|e| {
            HibiscusError::Io(format!("Failed to create workspace directory: {}", e))
        })?;
    }

    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(&workspace)?;

    // Atomic write: write to temp file, then rename
    let temp_path = path.with_extension("json.tmp");

    fs::write(&temp_path, &json)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to write temp workspace file: {}", e)))?;

    fs::rename(&temp_path, &path)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to finalize workspace.json: {}", e)))?;

    Ok(())
}

/// Response type for workspace discovery.
#[derive(Debug, serde::Serialize)]
pub struct WorkspaceDiscovery {
    /// Whether a workspace.json was found
    pub found: bool,
    /// Path to the workspace.json if found
    pub path: Option<String>,
}

/// Discovers if a workspace.json exists in the .hibiscus folder of the given root.
///
/// # Arguments
/// * `root` - The root directory to check for a workspace
///
/// # Returns
/// * `WorkspaceDiscovery` - Discovery result with found status and path
#[tauri::command]
pub fn discover_workspace(root: String) -> WorkspaceDiscovery {
    let root = PathBuf::from(root);
    let candidate = root.join(".hibiscus").join("workspace.json");

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