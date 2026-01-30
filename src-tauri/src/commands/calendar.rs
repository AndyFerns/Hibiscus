
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