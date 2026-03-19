
// ============================================================================
// CALENDAR OPERATIONS
// ============================================================================

use std::path::PathBuf;
use tokio::fs;

use crate::error::HibiscusError;
use super::path::validate_path;

/// Reads the calendar data from .hibiscus/calendar.json
#[tauri::command]
pub async fn read_calendar_data(root: String) -> Result<serde_json::Value, HibiscusError> {
    let root = PathBuf::from(&root);
    let path = root.join(".hibiscus").join("calendar.json");

    // Validate path (paranoia check)
    validate_path(&path)?;

    if !path.exists() {
        // Return default empty calendar if not found
        return Ok(serde_json::json!({
            "events": [],
            "tasks": [],
            "settings": {
                "view": "month",
                "startOfWeek": "monday"
            }
        }));
    }

    let content = fs::read_to_string(&path)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to read calendar.json: {}", e)))?;

    let data: serde_json::Value = serde_json::from_str(&content)?;
    Ok(data)
}

/// Saves the calendar data to .hibiscus/calendar.json
#[tauri::command]
pub async fn save_calendar_data(root: String, data: serde_json::Value) -> Result<(), HibiscusError> {
    let root = PathBuf::from(&root);
    let path = root.join(".hibiscus").join("calendar.json");

    // Validate path
    validate_path(&path)?;

    // Create parent directories (.hibiscus) if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|e| {
            HibiscusError::Io(format!("Failed to create directory: {}", e))
        })?;
    }

    let json = serde_json::to_string_pretty(&data)?;

    // Atomic write strategy
    let temp_path = path.with_extension("json.tmp");
    
    fs::write(&temp_path, &json)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to write temp calendar file: {}", e)))?;

    fs::rename(&temp_path, &path)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to save calendar.json: {}", e)))?;

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
    async fn test_read_calendar_returns_defaults_when_no_file() {
        let dir = tempdir().unwrap();
        let result = read_calendar_data(dir.path().to_string_lossy().to_string()).await;

        assert!(result.is_ok());
        let data = result.unwrap();
        // Should return default structure with empty events/tasks
        assert!(data["events"].is_array());
        assert!(data["tasks"].is_array());
        assert_eq!(data["events"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_save_and_read_calendar_roundtrip() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();

        let data = serde_json::json!({
            "events": [
                { "id": "evt-1", "title": "Midterm Exam", "date": "2026-03-20", "type": "exam" }
            ],
            "tasks": [],
            "settings": { "view": "month" }
        });

        // Save
        let save_result = save_calendar_data(root.clone(), data.clone()).await;
        assert!(save_result.is_ok());

        // Verify the file was actually created
        let cal_path = dir.path().join(".hibiscus").join("calendar.json");
        assert!(cal_path.exists());

        // Read back
        let read_result = read_calendar_data(root).await;
        assert!(read_result.is_ok());

        let loaded = read_result.unwrap();
        assert_eq!(loaded["events"][0]["title"], "Midterm Exam");
    }

    #[tokio::test]
    async fn test_save_calendar_creates_hibiscus_dir() {
        let dir = tempdir().unwrap();
        let hibiscus_dir = dir.path().join(".hibiscus");
        assert!(!hibiscus_dir.exists());

        let data = serde_json::json!({ "events": [], "tasks": [] });
        let result = save_calendar_data(dir.path().to_string_lossy().to_string(), data).await;
        assert!(result.is_ok());
        assert!(hibiscus_dir.exists());
    }
}