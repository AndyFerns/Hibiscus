// ============================================================================
// TREE OPERATIONS
// ============================================================================

use std::path::PathBuf;

use crate::error::HibiscusError;
use crate::tree::read_dir_recursive;
use crate::workspace::Node;
use super::path::validate_path;

/// Maximum depth for recursive directory traversal
const MAX_TREE_DEPTH: usize = 20;

/// Builds the file tree for a workspace directory.
///
/// # Arguments
/// * `root` - The root directory to build the tree from
///
/// # Returns
/// * `Ok(Vec<Node>)` - The file tree as a list of nodes
/// * `Err(HibiscusError)` - If tree building fails
///
/// # Features
/// - Respects depth limits to prevent infinite recursion
/// - Sorts folders first, then files, both alphabetically
/// - Ignores hidden files and .hibiscus folder
#[tauri::command]
pub fn build_tree(root: String) -> Result<Vec<Node>, HibiscusError> {
    let root = PathBuf::from(&root);

    // Validate path
    validate_path(&root)?;

    if !root.is_dir() {
        return Err(HibiscusError::InvalidPathType {
            path: root.to_string_lossy().into(),
            expected: "directory".into(),
            actual: "file".into(),
        });
    }

    Ok(read_dir_recursive(&root, &root, MAX_TREE_DEPTH))
}