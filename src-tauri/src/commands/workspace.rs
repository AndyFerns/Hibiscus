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
    let workspace: WorkspaceFile = serde_json::from_str(&content)
        .map_err(|e| HibiscusError::Workspace(format!("Invalid workspace format: {}", e)))?;

    // Validate schema version
    if workspace.schema_version != "1.0" {
        return Err(HibiscusError::Workspace(format!(
            "Unsupported workspace version: {}", 
            workspace.schema_version
        )));
    }

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

// =============================================================================
// UNIT TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[test]
    fn test_discover_workspace_found() {
        let dir = tempdir().unwrap();
        let hibiscus_dir = dir.path().join(".hibiscus");
        fs::create_dir_all(&hibiscus_dir).unwrap();
        fs::write(hibiscus_dir.join("workspace.json"), "{}").unwrap();

        let result = discover_workspace(dir.path().to_string_lossy().to_string());
        assert!(result.found);
        assert!(result.path.is_some());
        assert!(result.path.unwrap().contains("workspace.json"));
    }

    #[test]
    fn test_discover_workspace_not_found() {
        let dir = tempdir().unwrap();
        let result = discover_workspace(dir.path().to_string_lossy().to_string());
        assert!(!result.found);
        assert!(result.path.is_none());
    }

    #[test]
    fn test_discover_workspace_empty_hibiscus_dir() {
        let dir = tempdir().unwrap();
        let hibiscus_dir = dir.path().join(".hibiscus");
        fs::create_dir_all(&hibiscus_dir).unwrap();
        // .hibiscus exists but workspace.json doesn't

        let result = discover_workspace(dir.path().to_string_lossy().to_string());
        assert!(!result.found);
    }

    #[tokio::test]
    async fn test_save_and_load_workspace_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join(".hibiscus").join("workspace.json");

        let workspace = WorkspaceFile {
            schema_version: "1.0".to_string(),
            workspace: crate::workspace::WorkspaceInfo {
                id: "test-id".to_string(),
                name: "Test Workspace".to_string(),
                root: dir.path().to_string_lossy().to_string(),
                created_at: None,
                updated_at: None,
            },
            settings: None,
            tree: vec![],
            session: None,
        };

        // Save
        let save_result = save_workspace(
            path.to_string_lossy().to_string(),
            workspace,
        ).await;
        assert!(save_result.is_ok());

        // Load
        let load_result = load_workspace(path.to_string_lossy().to_string()).await;
        assert!(load_result.is_ok());

        let loaded = load_result.unwrap();
        assert_eq!(loaded.schema_version, "1.0");
        assert_eq!(loaded.workspace.name, "Test Workspace");
    }

    #[tokio::test]
    async fn test_load_workspace_file_not_found() {
        let result = load_workspace("C:\\nonexistent\\workspace.json".to_string()).await;
        assert!(result.is_err());
    }
}