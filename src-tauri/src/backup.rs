use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;

use crate::error::HibiscusError;

const MAX_BACKUPS: usize = 10;

/// Creates a backup of the source file in the .hibiscus/backups directory.
/// Keeps only the most recent MAX_BACKUPS files.
pub async fn create_backup(source_path: &Path, root: &Path) -> Result<PathBuf, HibiscusError> {
    if !source_path.exists() {
        return Ok(source_path.to_path_buf());
    }

    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
        
    let backup_dir = root.join(".hibiscus").join("backups").join(file_name);
    
    // Create backup directory if it doesn't exist
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .await
            .map_err(|e| HibiscusError::Io(format!("Failed to create backup dir: {}", e)))?;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
        
    let backup_name = format!("{}_{}.bak", file_name, timestamp);
    let backup_path = backup_dir.join(&backup_name);

    fs::copy(source_path, &backup_path)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to create backup: {}", e)))?;

    // Prune old backups
    prune_backups(&backup_dir).await?;

    Ok(backup_path)
}

async fn prune_backups(backup_dir: &Path) -> Result<(), HibiscusError> {
    let mut entries = fs::read_dir(backup_dir)
        .await
        .map_err(|e| HibiscusError::Io(format!("Failed to read backup dir: {}", e)))?;

    let mut backups: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();

    while let Some(entry) = entries.next_entry().await.unwrap_or(None) {
        if let Ok(metadata) = entry.metadata().await {
            if let Ok(modified) = metadata.modified() {
                 backups.push((entry.path(), modified));
            }
        }
    }

    // Sort by modification time (newest first)
    backups.sort_by(|a, b| b.1.cmp(&a.1));

    // Delete older backups exceeding MAX_BACKUPS
    if backups.len() > MAX_BACKUPS {
        for (path, _) in backups.into_iter().skip(MAX_BACKUPS) {
            let _ = fs::remove_file(path).await; // Ignore errors during cleanup
        }
    }

    Ok(())
}
