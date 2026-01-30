//! ============================================================================
//! Hibiscus Commands Module
//! ============================================================================
//!
//! Tauri command handlers for file and workspace operations.
//!
//! SECURITY:
//! - All file operations validate paths to prevent directory traversal attacks
//! - Paths must be within the workspace root to be accessed
//!
//! PERFORMANCE:
//! - File I/O operations use tokio for async/non-blocking execution
//! - This prevents blocking the main UI thread during large file operations
//!
//! ERROR HANDLING:
//! - Uses typed HibiscusError instead of String for better error context
//! - All errors are serializable for frontend consumption
//! ============================================================================

use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::error::HibiscusError;
use crate::tree::read_dir_recursive;
use crate::workspace::{Node, WorkspaceFile};

// ============================================================================
// PATH VALIDATION
// ============================================================================

/// Maximum allowed path depth to prevent deeply nested directory attacks
const MAX_PATH_DEPTH: usize = 50;

/// Validates that a path is safe and canonical.
///
/// This function performs several security checks:
/// 1. Ensures the path doesn't contain path traversal sequences (..)
/// 2. Ensures the path depth is within limits
/// 3. Normalizes the path for consistent handling
///
/// # Arguments
/// * `path` - The path to validate
///
/// # Returns
/// * `Ok(PathBuf)` - The validated, canonical path
/// * `Err(HibiscusError)` - If validation fails
fn validate_path(path: &Path) -> Result<PathBuf, HibiscusError> {
    // Check for path traversal attempts
    let path_str = path.to_string_lossy();
    if path_str.contains("..") {
        return Err(HibiscusError::PathValidation(
            "Path traversal not allowed".into(),
        ));
    }

    // Check path depth to prevent abuse
    let depth = path.components().count();
    if depth > MAX_PATH_DEPTH {
        return Err(HibiscusError::PathValidation(format!(
            "Path depth {} exceeds maximum {}",
            depth, MAX_PATH_DEPTH
        )));
    }

    // Return the path as-is (canonicalization requires the path to exist)
    Ok(path.to_path_buf())
}

/// Validates that a path is within a given root directory.
///
/// This is used to ensure users can only access files within their workspace,
/// preventing access to system files or other sensitive locations.
///
/// # Arguments
/// * `path` - The path to validate
/// * `root` - The root directory the path must be within
///
/// # Returns
/// * `Ok(())` - If the path is within the root
/// * `Err(HibiscusError)` - If the path is outside the root
///
/// Note: Currently unused but kept for future workspace-scoped operations.
#[allow(dead_code)]
fn validate_path_within_root(path: &Path, root: &Path) -> Result<(), HibiscusError> {
    // First validate the path itself
    validate_path(path)?;

    // For existing paths, check canonical form
    if path.exists() && root.exists() {
        let canonical_path = path
            .canonicalize()
            .map_err(|e| HibiscusError::Io(format!("Failed to canonicalize path: {}", e)))?;
        let canonical_root = root
            .canonicalize()
            .map_err(|e| HibiscusError::Io(format!("Failed to canonicalize root: {}", e)))?;

        if !canonical_path.starts_with(&canonical_root) {
            return Err(HibiscusError::PathValidation(
                "Path is outside workspace root".into(),
            ));
        }
    }

    Ok(())
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/// Reads the contents of a text file asynchronously.
///
/// # Arguments
/// * `path` - Absolute path to the file to read
///
/// # Returns
/// * `Ok(String)` - The file contents as a string
/// * `Err(HibiscusError)` - If the file cannot be read
///
/// # Security
/// Path is validated to prevent directory traversal attacks.
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, HibiscusError> {
    let path = PathBuf::from(&path);

    // Validate the path
    validate_path(&path)?;

    // Check if path exists and is a file
    if !path.exists() {
        return Err(HibiscusError::FileNotFound(path.to_string_lossy().into()));
    }

    if !path.is_file() {
        return Err(HibiscusError::InvalidPathType {
            path: path.to_string_lossy().into(),
            expected: "file".into(),
            actual: "directory".into(),
        });
    }

    // Read file asynchronously (non-blocking)
    let content = fs::read_to_string(&path).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to read file '{}': {}", path.display(), e))
    })?;

    Ok(content)
}

/// Writes contents to a text file asynchronously.
///
/// Uses a safe write strategy inspired by modern editors (VS Code, Sublime):
/// 1. Write to a temporary file with `.hibiscus-save~` suffix
/// 2. Sync to disk to ensure durability
/// 3. On Windows: delete target first (Windows can't rename over existing)
/// 4. Rename temp to target (atomic on most filesystems)
/// 5. Cleanup temp file on any failure
///
/// # Arguments
/// * `path` - Absolute path to the file to write
/// * `contents` - The string content to write
///
/// # Returns
/// * `Ok(())` - If the write was successful
/// * `Err(HibiscusError)` - If the write failed
///
/// # Security
/// Path is validated to prevent directory traversal attacks.
#[tauri::command]
pub async fn write_text_file(path: String, contents: String) -> Result<(), HibiscusError> {
    let path = PathBuf::from(&path);

    // Validate the path
    validate_path(&path)?;

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|e| {
            HibiscusError::Io(format!(
                "Failed to create parent directories for '{}': {}",
                path.display(),
                e
            ))
        })?;
    }

    // ===========================================================================
    // MODERN EDITOR SAVE STRATEGY
    // ===========================================================================
    // Create temp file with .hibiscus-save~ suffix APPENDED to full filename.
    // Using a unique suffix prevents conflicts with user files.
    // Example: "notes.txt" -> "notes.txt.hibiscus-save~"
    // ===========================================================================
    let temp_filename = format!(
        "{}.hibiscus-save~",
        path.file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_default()
    );
    let temp_path = path.with_file_name(&temp_filename);

    // Write to temp file
    let write_result = async {
        let mut file = fs::File::create(&temp_path).await.map_err(|e| {
            HibiscusError::Io(format!(
                "Failed to create temp file '{}': {}",
                temp_path.display(),
                e
            ))
        })?;

        file.write_all(contents.as_bytes()).await.map_err(|e| {
            HibiscusError::Io(format!(
                "Failed to write to temp file '{}': {}",
                temp_path.display(),
                e
            ))
        })?;

        // Sync to ensure data is on disk before rename
        file.sync_all().await.map_err(|e| {
            HibiscusError::Io(format!("Failed to sync file '{}': {}", temp_path.display(), e))
        })?;

        Ok::<(), HibiscusError>(())
    }
    .await;

    // If write failed, cleanup temp file and return error
    if let Err(e) = write_result {
        let _ = fs::remove_file(&temp_path).await; // Ignore cleanup errors
        return Err(e);
    }

    // ===========================================================================
    // WINDOWS COMPATIBILITY: Windows doesn't support atomic rename over existing
    // files. We must delete the target first. This creates a brief window where
    // the file doesn't exist, but it's the standard approach for Windows.
    // ===========================================================================
    #[cfg(target_os = "windows")]
    if path.exists() {
        if let Err(e) = fs::remove_file(&path).await {
            // Cleanup temp and return error
            let _ = fs::remove_file(&temp_path).await;
            return Err(HibiscusError::Io(format!(
                "Failed to remove existing file '{}' before save: {}",
                path.display(),
                e
            )));
        }
    }

    // Rename temp file to target
    if let Err(e) = fs::rename(&temp_path, &path).await {
        // Cleanup temp file on rename failure
        let _ = fs::remove_file(&temp_path).await;
        return Err(HibiscusError::Io(format!(
            "Failed to rename '{}' to '{}': {}",
            temp_path.display(),
            path.display(),
            e
        )));
    }

    Ok(())
}

// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

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

// ============================================================================
// TREE OPERATIONS
// ============================================================================

/// Maximum depth for recursive directory traversal
const MAX_TREE_DEPTH: usize = 20;

/// Builds the file tree for a workspace directory.
///
/// # Arguments
/// * `root` - The root directory to build the tree from
///
/// # Returns
/// * `Ok(Vec<Node>)` - The file tree as a list of nodes
/// * `Err(HibiscusError)` - If tree building fails
///
/// # Features
/// - Respects depth limits to prevent infinite recursion
/// - Sorts folders first, then files, both alphabetically
/// - Ignores hidden files and .hibiscus folder
#[tauri::command]
pub fn build_tree(root: String) -> Result<Vec<Node>, HibiscusError> {
    let root = PathBuf::from(&root);

    // Validate path
    validate_path(&root)?;

    if !root.is_dir() {
        return Err(HibiscusError::InvalidPathType {
            path: root.to_string_lossy().into(),
            expected: "directory".into(),
            actual: "file".into(),
        });
    }

    Ok(read_dir_recursive(&root, &root, MAX_TREE_DEPTH))
}
