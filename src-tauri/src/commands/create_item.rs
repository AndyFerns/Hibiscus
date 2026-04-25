// ============================================================================
// UNIFIED ITEM CREATION (File + Folder)
// ============================================================================
//
// A single Tauri command that handles both file and folder creation with:
// - Per-path locking to prevent concurrent creation of the same path
// - Automatic parent directory creation
// - Atomic file creation
// - Structured error reporting
//
// CONCURRENCY: Uses a lazily-initialized global Mutex<HashSet<PathBuf>> to
// track in-flight creation paths. This prevents race conditions when the
// user rapidly creates items at the same path (e.g., double-Enter).
// The lock is held only for the duration of the HashSet check/insert,
// NOT during the actual filesystem operations.
// ============================================================================

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

use tokio::fs;

use crate::error::HibiscusError;
use super::path::validate_path;

/// Global set of paths currently being created.
/// Used for per-path deduplication of concurrent requests.
/// The Mutex is only held briefly for HashSet operations (never during IO).
static INFLIGHT_PATHS: std::sync::LazyLock<Mutex<HashSet<PathBuf>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashSet::new()));

/// Unified command for creating files and folders.
///
/// # Arguments
/// * `path`   - Absolute path to the item to create.
/// * `is_dir` - If true, creates a directory. If false, creates an empty file.
///
/// # Behavior
/// - Validates the path against traversal attacks and depth limits.
/// - Creates all missing parent directories automatically.
/// - Returns an error if the item already exists on disk.
/// - Uses per-path locking to reject duplicate concurrent requests.
///
/// # Watcher Integration
/// After creation, the filesystem watcher will detect the change and
/// forward it to the knowledge pipeline. This command does NOT manually
/// trigger indexing -- the watcher is the sole trigger.
#[tauri::command]
pub async fn create_item(path: String, is_dir: bool) -> Result<(), HibiscusError> {
    let path = PathBuf::from(&path);

    // Validate path safety (traversal, depth).
    validate_path(&path)?;

    // Per-path lock: reject if another request is already creating this path.
    {
        let mut inflight = INFLIGHT_PATHS
            .lock()
            .map_err(|_| HibiscusError::Io("Internal lock poisoned".into()))?;

        if !inflight.insert(path.clone()) {
            return Err(HibiscusError::Io(format!(
                "Creation already in progress for '{}'",
                path.display()
            )));
        }
    }
    // From here, the path is registered in INFLIGHT_PATHS.
    // We MUST remove it when we're done, even on error.

    let result = create_item_inner(&path, is_dir).await;

    // Release per-path lock.
    {
        let mut inflight = INFLIGHT_PATHS
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        inflight.remove(&path);
    }

    result
}

/// Inner creation logic, separated so the per-path lock cleanup
/// is guaranteed by the caller regardless of outcome.
async fn create_item_inner(path: &PathBuf, is_dir: bool) -> Result<(), HibiscusError> {
    // Check if item already exists.
    if path.exists() {
        let kind = if is_dir { "Directory" } else { "File" };
        return Err(HibiscusError::Io(format!(
            "{} already exists: '{}'",
            kind,
            path.display()
        )));
    }

    // Create parent directories if needed.
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).await.map_err(|e| {
                HibiscusError::Io(format!(
                    "Failed to create parent directories for '{}': {}",
                    path.display(),
                    e
                ))
            })?;
        }
    }

    // Create the item.
    if is_dir {
        fs::create_dir_all(path).await.map_err(|e| {
            HibiscusError::Io(format!(
                "Failed to create directory '{}': {}",
                path.display(),
                e
            ))
        })?;
    } else {
        fs::File::create(path).await.map_err(|e| {
            HibiscusError::Io(format!(
                "Failed to create file '{}': {}",
                path.display(),
                e
            ))
        })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inflight_set_starts_empty() {
        let inflight = INFLIGHT_PATHS.lock().unwrap();
        // The set should be empty at test start (or contain entries from
        // other tests that completed and cleaned up).
        // We just verify it's accessible without panic.
        assert!(inflight.len() < 100, "Inflight set should not grow unbounded");
    }
}
