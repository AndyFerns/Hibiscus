use serde_json::Value;

/// Applies sequential migrations to workspace data
pub fn migrate_workspace(value: &mut Value) {
    // Current target version for workspace schema
    const TARGET_VERSION: &str = "1.0";

    if let Some(version) = value.get("schema_version").and_then(|v| v.as_str()) {
        if version == TARGET_VERSION {
            return;
        }
        
        // Example: migrate from 1.0 to 1.1 in future:
        // if version == "1.0" {
        //     migrate_workspace_1_0_to_1_1(value);
        // }
    } else {
        // If no version is found, assume 1.0 and set it
        if let Some(obj) = value.as_object_mut() {
            obj.insert("schema_version".to_string(), Value::String(TARGET_VERSION.to_string()));
        }
    }
}

/// Applies sequential migrations to calendar data
pub fn migrate_calendar(value: &mut Value) {
    // Current target version for calendar schema
    const TARGET_VERSION: &str = "1.0.0";

    if let Some(version) = value.get("schemaVersion").and_then(|v| v.as_str()) {
        if version == TARGET_VERSION {
            return;
        }

        // Example: migrate from 1.0.0 to 1.1.0 in future:
        // if version == "1.0.0" {
        //     migrate_calendar_1_0_0_to_1_1_0(value);
        // }
    } else {
         // If no version is found, assume 1.0.0 and set it
         if let Some(obj) = value.as_object_mut() {
            obj.insert("schemaVersion".to_string(), Value::String(TARGET_VERSION.to_string()));
        }
    }
}
