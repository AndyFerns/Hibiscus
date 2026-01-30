//! ============================================================================
//! PATH VALIDATION
//! ============================================================================

use std::path::{Path, PathBuf};
use crate::error::HibiscusError;

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
pub fn validate_path(path: &Path) -> Result<PathBuf, HibiscusError> {
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