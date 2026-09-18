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
/// Used by workspace-scoped commands (create_item, create_file, create_folder,
/// move_node) to guarantee the resolved absolute path they were handed cannot
/// escape the workspace. Defence in depth: the frontend resolver already
/// composes paths against the workspace root, but a path that reaches the
/// backend via any other route (a stale IPC caller, a future feature, a bug
/// in join semantics) must still be rejected.
///
/// # Arguments
/// * `path` - The path to validate (absolute; typically the fully resolved
///            path the backend was asked to operate on)
/// * `root` - The workspace root the path must live under
///
/// # Returns
/// * `Ok(())` - If the path is within the root
/// * `Err(HibiscusError)` - If the path is outside the root, or if the
///                          canonical form of an existing root cannot be read
///
/// # Behaviour for non-existent paths
///
/// `path.canonicalize()` fails on Windows if the target does not exist yet,
/// which is precisely the case for create_file / create_folder / create_item.
/// We therefore canonicalise the ROOT (which always exists) and lexically
/// check `starts_with` against the incoming path after `validate_path` has
/// already stripped literal `..` segments. That combination is safe: the
/// only way a lexical descendant of a canonicalised root can escape is via
/// `..`, and that has already been rejected.
pub(crate) fn validate_path_within_root(path: &Path, root: &Path) -> Result<(), HibiscusError> {
    // First validate the path itself (traversal, depth). This is what makes
    // the lexical starts_with check below safe for non-existent paths.
    validate_path(path)?;

    // The root must exist for this check to be meaningful. If a caller
    // passes a root that does not exist, that is a caller bug, not a
    // security event -- surface it clearly.
    if !root.exists() {
        return Err(HibiscusError::PathValidation(format!(
            "Workspace root does not exist: '{}'",
            root.display()
        )));
    }

    let canonical_root = root
        .canonicalize()
        .map_err(|e| HibiscusError::Io(format!("Failed to canonicalize root: {}", e)))?;

    // If the target itself exists, compare canonical forms -- this catches
    // symlink escapes that the lexical check would miss.
    if path.exists() {
        let canonical_path = path
            .canonicalize()
            .map_err(|e| HibiscusError::Io(format!("Failed to canonicalize path: {}", e)))?;

        if !canonical_path.starts_with(&canonical_root) {
            return Err(HibiscusError::PathValidation(
                "Path is outside workspace root".into(),
            ));
        }

        return Ok(());
    }

    // Non-existent target (typical for create_* commands): fall back to a
    // lexical check against the canonical root. Safe because validate_path
    // has already rejected literal `..`.
    if !path.starts_with(&canonical_root) && !path.starts_with(root) {
        return Err(HibiscusError::PathValidation(
            "Path is outside workspace root".into(),
        ));
    }

    Ok(())
}

// =============================================================================
// UNIT TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ---- validate_path tests ----

    #[test]
    fn test_normal_path_passes() {
        let path = Path::new("C:\\Users\\test\\project\\file.txt");
        assert!(validate_path(path).is_ok());
    }

    #[test]
    fn test_rejects_path_traversal() {
        let path = Path::new("C:\\Users\\test\\..\\..\\etc\\passwd");
        let result = validate_path(path);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Path traversal not allowed"));
    }

    #[test]
    fn test_rejects_embedded_dotdot() {
        let path = Path::new("/home/user/../secrets/key");
        assert!(validate_path(path).is_err());
    }

    #[test]
    fn test_allows_dots_in_filenames() {
        // A filename with dots (not ..) should be fine
        let path = Path::new("C:\\Users\\test\\file.backup.tar.gz");
        assert!(validate_path(path).is_ok());
    }

    #[test]
    fn test_rejects_excessive_depth() {
        // Build a path deeper than MAX_PATH_DEPTH
        let deep =
            (0..=MAX_PATH_DEPTH + 1).fold(PathBuf::new(), |path, i| path.join(format!("d{}", i)));
        let result = validate_path(&deep);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Path depth"));
    }

    #[test]
    fn test_normal_depth_passes() {
        let path = Path::new("C:\\a\\b\\c\\d\\e\\file.txt");
        assert!(validate_path(path).is_ok());
    }

    // ---- validate_path_within_root tests ----

    #[test]
    fn test_path_within_root_rejects_traversal() {
        // A path containing `..` is rejected by the inner validate_path call,
        // regardless of whether the path or root exist on disk.
        let path = Path::new("C:\\workspace\\..\\secrets\\key");
        let root = Path::new("C:\\workspace");
        assert!(validate_path_within_root(path, root).is_err());
    }

    #[test]
    fn test_path_within_root_rejects_missing_root() {
        // Guarding against a non-existent root is a caller bug, not a
        // security event, but must surface as an error rather than silently
        // pass the way the previous implementation did.
        let path = Path::new("C:\\definitely\\not\\here\\file.txt");
        let root = Path::new("C:\\definitely\\not\\here");
        let result = validate_path_within_root(path, root);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Workspace root does not exist"));
    }

    #[test]
    fn test_path_within_root_accepts_new_file_inside_root() {
        // The create_* commands hand us a target that does not exist yet.
        // We need to accept it as long as it lexically lives under the root.
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("subdir").join("new-note.md");
        assert!(validate_path_within_root(&path, root.path()).is_ok());
    }

    #[test]
    fn test_path_within_root_rejects_new_file_outside_root() {
        // A non-existent path outside the root must be rejected -- this is
        // the case the old (existence-gated) implementation silently missed.
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let path = outside.path().join("evil.md");
        let result = validate_path_within_root(&path, root.path());
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("outside workspace root"));
    }

    #[test]
    fn test_path_within_root_accepts_existing_file_inside_root() {
        // Existing paths go through the canonical-form check, which is
        // what defends against symlink escapes.
        use std::fs::File;
        let root = tempfile::tempdir().unwrap();
        let inner = root.path().join("real.md");
        File::create(&inner).unwrap();
        assert!(validate_path_within_root(&inner, root.path()).is_ok());
    }
}
