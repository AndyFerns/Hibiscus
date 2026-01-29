//! ============================================================================
//! Hibiscus Tree Module
//! ============================================================================
//!
//! Recursive directory tree builder for workspace file navigation.
//!
//! FEATURES:
//! - Recursive directory traversal with depth limits
//! - Alphabetical sorting (folders first, then files)
//! - Hidden file filtering (.hibiscus, dotfiles)
//! - Robust error handling (no panics)
//!
//! DESIGN DECISIONS:
//! - Uses iterative approach with controlled recursion depth
//! - Silently skips unreadable files/directories instead of failing
//! - Represents tree structure as nested Nodes for frontend consumption
//! ============================================================================

use std::fs;
use std::path::Path;

use crate::workspace::{Node, NodeType};

/// Default maximum recursion depth for directory traversal.
/// This prevents infinite recursion and excessive memory usage
/// for very deeply nested directory structures.
#[allow(dead_code)]
pub const DEFAULT_MAX_DEPTH: usize = 20;

/// Recursively reads a directory and builds a tree of Nodes.
///
/// This function traverses the filesystem starting from `root`, building
/// a hierarchical tree structure suitable for display in a file explorer.
///
/// # Arguments
/// * `root` - The directory to read
/// * `base` - The base path for computing relative paths (typically workspace root)
/// * `max_depth` - Maximum recursion depth (use DEFAULT_MAX_DEPTH for normal usage)
///
/// # Returns
/// A vector of Nodes representing the directory contents.
/// Empty vector if the directory cannot be read.
///
/// # Error Handling
/// - Directories that can't be read are silently skipped
/// - Files that can't be processed are silently skipped
/// - No panics - all error cases return gracefully
///
/// # Sorting
/// Results are sorted with folders first, then files.
/// Both groups are sorted alphabetically (case-insensitive).
pub fn read_dir_recursive(root: &Path, base: &Path, max_depth: usize) -> Vec<Node> {
    // Prevent infinite recursion
    if max_depth == 0 {
        return Vec::new();
    }

    // Separate containers for folders and files to enable sorted output
    let mut folders: Vec<Node> = Vec::new();
    let mut files: Vec<Node> = Vec::new();

    // Attempt to read directory, return empty on failure
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(e) => {
            // Log error but don't fail - just return empty
            eprintln!(
                "[Hibiscus] Warning: Failed to read directory '{}': {}",
                root.display(),
                e
            );
            return Vec::new();
        }
    };

    // Process each directory entry
    for entry_result in entries {
        // Skip entries that can't be read
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[Hibiscus] Warning: Failed to read entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        // Get the file name, skip if it can't be determined
        let file_name = match path.file_name() {
            Some(name) => match name.to_str() {
                Some(s) => s.to_string(),
                None => {
                    eprintln!(
                        "[Hibiscus] Warning: Non-UTF8 filename at '{}'",
                        path.display()
                    );
                    continue;
                }
            },
            None => {
                // Path ends with ".." or similar - skip
                continue;
            }
        };

        // Skip hidden files and directories (starting with .)
        // This includes .hibiscus, .git, .vscode, etc.
        if file_name.starts_with('.') {
            continue;
        }

        // Compute relative path from base
        let rel_path = match path.strip_prefix(base) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => {
                // Path is outside base - use full path as fallback
                path.to_string_lossy().to_string()
            }
        };

        // Use relative path as ID for consistency
        let id = rel_path.clone();

        // Determine if this is a file or directory
        let is_dir = path.is_dir();

        // Build the node
        let node = Node {
            id,
            name: file_name,
            node_type: if is_dir {
                NodeType::Folder
            } else {
                NodeType::File
            },
            // Files get a path for opening, folders don't need one
            path: if is_dir { None } else { Some(rel_path) },
            // Recursively process subdirectories (with decremented depth)
            children: if is_dir {
                Some(read_dir_recursive(&path, base, max_depth - 1))
            } else {
                None
            },
            // Meta is reserved for future use (file size, modified time, etc.)
            meta: None,
        };

        // Add to appropriate collection
        if is_dir {
            folders.push(node);
        } else {
            files.push(node);
        }
    }

    // Sort folders alphabetically (case-insensitive)
    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    // Sort files alphabetically (case-insensitive)
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    // Combine: folders first, then files
    folders.extend(files);

    folders
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[test]
    fn test_empty_directory() {
        let dir = tempdir().unwrap();
        let result = read_dir_recursive(dir.path(), dir.path(), DEFAULT_MAX_DEPTH);
        assert!(result.is_empty());
    }

    #[test]
    fn test_depth_limit() {
        let dir = tempdir().unwrap();
        // With depth 0, should return empty immediately
        let result = read_dir_recursive(dir.path(), dir.path(), 0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_hidden_files_skipped() {
        let dir = tempdir().unwrap();
        File::create(dir.path().join(".hidden")).unwrap();
        File::create(dir.path().join("visible.txt")).unwrap();

        let result = read_dir_recursive(dir.path(), dir.path(), DEFAULT_MAX_DEPTH);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "visible.txt");
    }

    #[test]
    fn test_folders_sorted_before_files() {
        let dir = tempdir().unwrap();
        File::create(dir.path().join("aaa.txt")).unwrap();
        std::fs::create_dir(dir.path().join("zzz_folder")).unwrap();

        let result = read_dir_recursive(dir.path(), dir.path(), DEFAULT_MAX_DEPTH);
        assert_eq!(result.len(), 2);
        // Folder should come first even though 'z' > 'a'
        assert_eq!(result[0].name, "zzz_folder");
        assert_eq!(result[1].name, "aaa.txt");
    }
}
