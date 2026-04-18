// ============================================================================
// THEME PERSISTENCE COMMANDS
// ============================================================================
//
// Minimal Tauri commands for theme file I/O.
// Stores user themes as individual JSON files in .hibiscus/themes/.
//
// DESIGN:
// - NO business logic — validation and merging happen in the frontend
// - Safe file writes with parent directory creation
// - Uses the same error handling patterns as workspace.rs
// ============================================================================

use std::path::PathBuf;
use tokio::fs;

use crate::error::HibiscusError;
use super::path::validate_path;

/// Saves a theme JSON file to disk.
///
/// Writes the provided JSON string to `.hibiscus/themes/<name>.json`
/// within the given workspace root. Creates the themes directory if
/// it doesn't exist.
///
/// # Arguments
/// * `root` - Workspace root directory path
/// * `name` - Theme name (used as filename, e.g. "my-theme" → "my-theme.json")
/// * `theme_json` - The raw JSON string to write
///
/// # Returns
/// * `Ok(())` - If the save was successful
/// * `Err(HibiscusError)` - If the save failed
#[tauri::command]
pub async fn save_theme(root: String, name: String, theme_json: String) -> Result<(), HibiscusError> {
    let themes_dir = PathBuf::from(&root).join(".hibiscus").join("themes");
    let file_path = themes_dir.join(format!("{}.json", name));

    // Validate path safety
    validate_path(&file_path)?;

    // Ensure themes directory exists
    fs::create_dir_all(&themes_dir).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to create themes directory: {}", e))
    })?;

    // Write theme file (atomic: write to temp, then rename)
    let temp_path = file_path.with_extension("json.tmp");

    fs::write(&temp_path, &theme_json).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to write theme file '{}': {}", name, e))
    })?;

    // On Windows, we need to remove existing file before rename
    #[cfg(target_os = "windows")]
    if file_path.exists() {
        if let Err(e) = fs::remove_file(&file_path).await {
            let _ = fs::remove_file(&temp_path).await;
            return Err(HibiscusError::Io(format!(
                "Failed to remove existing theme file '{}': {}",
                name, e
            )));
        }
    }

    fs::rename(&temp_path, &file_path).await.map_err(|e| {
        let _ = std::fs::remove_file(&temp_path); // Sync cleanup as last resort
        HibiscusError::Io(format!("Failed to finalize theme file '{}': {}", name, e))
    })?;

    Ok(())
}

/// Loads all theme JSON files from the workspace's themes directory.
///
/// Reads every `.json` file in `.hibiscus/themes/` and returns their
/// contents as a vector of raw JSON strings. The frontend is responsible
/// for parsing and validating these.
///
/// Files that can't be read are silently skipped (logged to stderr).
///
/// # Arguments
/// * `root` - Workspace root directory path
///
/// # Returns
/// * `Ok(Vec<String>)` - Vector of JSON strings, one per theme file
/// * `Err(HibiscusError)` - If the directory can't be read
#[tauri::command]
pub async fn load_themes(root: String) -> Result<Vec<String>, HibiscusError> {
    let themes_dir = PathBuf::from(&root).join(".hibiscus").join("themes");

    // If the themes directory doesn't exist, return empty (not an error)
    if !themes_dir.exists() {
        return Ok(vec![]);
    }

    validate_path(&themes_dir)?;

    let mut themes = Vec::new();
    let mut entries = fs::read_dir(&themes_dir).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to read themes directory: {}", e))
    })?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        HibiscusError::Io(format!("Failed to read theme directory entry: {}", e))
    })? {
        let path = entry.path();

        // Only process .json files
        if path.extension().map_or(false, |ext| ext == "json") {
            match fs::read_to_string(&path).await {
                Ok(content) => themes.push(content),
                Err(e) => {
                    eprintln!(
                        "[Hibiscus] Warning: Could not read theme file '{}': {}",
                        path.display(),
                        e
                    );
                }
            }
        }
    }

    Ok(themes)
}

/// Deletes a user theme file from disk.
///
/// Removes `.hibiscus/themes/<name>.json` from the workspace.
/// Does NOT delete preset themes (that's enforced by the frontend).
///
/// # Arguments
/// * `root` - Workspace root directory path
/// * `name` - Name of the theme to delete
///
/// # Returns
/// * `Ok(())` - If the deletion was successful (or file didn't exist)
/// * `Err(HibiscusError)` - If the deletion failed
#[tauri::command]
pub async fn delete_theme(root: String, name: String) -> Result<(), HibiscusError> {
    let file_path = PathBuf::from(&root)
        .join(".hibiscus")
        .join("themes")
        .join(format!("{}.json", name));

    // Validate path safety
    validate_path(&file_path)?;

    // If file doesn't exist, that's fine — idempotent delete
    if !file_path.exists() {
        return Ok(());
    }

    fs::remove_file(&file_path).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to delete theme '{}': {}", name, e))
    })?;

    Ok(())
}

// =============================================================================
// UNIT TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_save_and_load_theme() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        // Save a theme
        let json = r##"{"name":"test-theme","tokens":{"--bg":"#112233"}}"##.to_string();
        let result = save_theme(root.clone(), "test-theme".to_string(), json.clone()).await;
        assert!(result.is_ok());

        // Verify file exists
        let theme_file = dir.path().join(".hibiscus").join("themes").join("test-theme.json");
        assert!(theme_file.exists());

        // Load themes
        let themes = load_themes(root.clone()).await.unwrap();
        assert_eq!(themes.len(), 1);
        assert!(themes[0].contains("test-theme"));
    }

    #[tokio::test]
    async fn test_delete_theme() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        // Save then delete
        let json = r##"{"name":"to-delete","tokens":{}}"##.to_string();
        save_theme(root.clone(), "to-delete".to_string(), json).await.unwrap();
        delete_theme(root.clone(), "to-delete".to_string()).await.unwrap();

        // Verify it's gone
        let themes = load_themes(root).await.unwrap();
        assert!(themes.is_empty());
    }

    #[tokio::test]
    async fn test_load_empty_themes() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        // No themes dir → empty result
        let themes = load_themes(root).await.unwrap();
        assert!(themes.is_empty());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_theme() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        // Deleting a theme that doesn't exist should succeed (idempotent)
        let result = delete_theme(root, "nonexistent".to_string()).await;
        assert!(result.is_ok());
    }
}
