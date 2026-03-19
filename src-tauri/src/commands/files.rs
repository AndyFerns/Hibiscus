
// ============================================================================
// FILE OPERATIONS
// ============================================================================

use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::error::HibiscusError;
use super::path::validate_path;

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