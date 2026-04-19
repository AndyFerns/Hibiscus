// ============================================================================
// STUDY DATA PERSISTENCE COMMANDS
// ============================================================================
//
// Generic Tauri commands for study feature file I/O.
// All study data is stored as individual JSON files in .hibiscus/study/.
//
// DESIGN:
// - Two generic commands serve ALL study features (stats, flashcards, settings)
// - NO business logic — validation and structuring happen in the frontend
// - Uses the same atomic write pattern as themes.rs and calendar.rs
// - Filename is parameterized so features can store their own data files
//
// FILES MANAGED:
// - .hibiscus/study/stats.json      (study session statistics)
// - .hibiscus/study/flashcards.json (flashcard decks)
// - .hibiscus/study/settings.json   (user preferences)
// ============================================================================

use std::path::PathBuf;
use tokio::fs;

use crate::error::HibiscusError;
use super::path::validate_path;

/// Reads a study data JSON file from disk.
///
/// Reads `.hibiscus/study/<filename>` from the given workspace root.
/// Returns the raw JSON string for the frontend to parse and validate.
///
/// If the file doesn't exist, returns an empty string (not an error),
/// allowing the frontend to initialize with defaults.
///
/// # Arguments
/// * `root` - Workspace root directory path
/// * `filename` - Name of the data file (e.g. "stats.json", "flashcards.json")
///
/// # Returns
/// * `Ok(String)` - Raw JSON string, or empty string if file doesn't exist
/// * `Err(HibiscusError)` - If the read fails
#[tauri::command]
pub async fn read_study_data(root: String, filename: String) -> Result<String, HibiscusError> {
    let study_dir = PathBuf::from(&root).join(".hibiscus").join("study");
    let file_path = study_dir.join(&filename);

    // Validate path safety (prevents path traversal attacks)
    validate_path(&file_path)?;

    // If the file doesn't exist, return empty string (frontend handles defaults)
    if !file_path.exists() {
        return Ok(String::new());
    }

    let content = fs::read_to_string(&file_path).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to read study data '{}': {}", filename, e))
    })?;

    Ok(content)
}

/// Saves study data to a JSON file on disk.
///
/// Writes the provided JSON string to `.hibiscus/study/<filename>`
/// within the given workspace root. Creates the study directory if
/// it doesn't exist. Uses atomic write (temp file + rename) for safety.
///
/// # Arguments
/// * `root` - Workspace root directory path
/// * `filename` - Name of the data file (e.g. "stats.json")
/// * `data` - The raw JSON string to write
///
/// # Returns
/// * `Ok(())` - If the save was successful
/// * `Err(HibiscusError)` - If the save failed
#[tauri::command]
pub async fn save_study_data(root: String, filename: String, data: String) -> Result<(), HibiscusError> {
    let study_dir = PathBuf::from(&root).join(".hibiscus").join("study");
    let file_path = study_dir.join(&filename);

    // Validate path safety
    validate_path(&file_path)?;

    // Ensure study directory exists
    fs::create_dir_all(&study_dir).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to create study directory: {}", e))
    })?;

    // Atomic write: write to temp file, then rename
    let temp_path = file_path.with_extension("json.tmp");

    fs::write(&temp_path, &data).await.map_err(|e| {
        HibiscusError::Io(format!("Failed to write study data '{}': {}", filename, e))
    })?;

    // On Windows, remove existing file before rename (required by the OS)
    #[cfg(target_os = "windows")]
    if file_path.exists() {
        if let Err(e) = fs::remove_file(&file_path).await {
            let _ = fs::remove_file(&temp_path).await;
            return Err(HibiscusError::Io(format!(
                "Failed to remove existing study file '{}': {}",
                filename, e
            )));
        }
    }

    fs::rename(&temp_path, &file_path).await.map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        HibiscusError::Io(format!("Failed to finalize study data '{}': {}", filename, e))
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
    async fn test_read_missing_file_returns_empty() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        let result = read_study_data(root, "stats.json".to_string()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");
    }

    #[tokio::test]
    async fn test_save_and_read_roundtrip() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        let data = r##"{"sessions":[],"totalMinutes":0}"##.to_string();
        let save = save_study_data(root.clone(), "stats.json".to_string(), data.clone()).await;
        assert!(save.is_ok());

        // Verify file exists
        let file = dir.path().join(".hibiscus").join("study").join("stats.json");
        assert!(file.exists());

        // Read back
        let loaded = read_study_data(root, "stats.json".to_string()).await.unwrap();
        assert_eq!(loaded, data);
    }

    #[tokio::test]
    async fn test_save_creates_study_dir() {
        let dir = tempdir().unwrap();
        let study_dir = dir.path().join(".hibiscus").join("study");
        assert!(!study_dir.exists());

        let result = save_study_data(
            dir.path().to_string_lossy().to_string(),
            "test.json".to_string(),
            "{}".to_string(),
        ).await;
        assert!(result.is_ok());
        assert!(study_dir.exists());
    }

    #[tokio::test]
    async fn test_overwrite_existing_data() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        // Write initial
        save_study_data(root.clone(), "data.json".to_string(), r##"{"v":1}"##.to_string()).await.unwrap();

        // Overwrite
        save_study_data(root.clone(), "data.json".to_string(), r##"{"v":2}"##.to_string()).await.unwrap();

        let loaded = read_study_data(root, "data.json".to_string()).await.unwrap();
        assert!(loaded.contains(r##""v":2"##));
    }
}
