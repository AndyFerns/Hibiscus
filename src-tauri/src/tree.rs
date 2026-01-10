use std::fs;
use std::path::{Path, PathBuf};
use crate::workspace::{Node, NodeType};

fn read_dir_recursive(root: &Path, base: &Path) -> Vec<Node> {
    let mut nodes = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();

            // ❗ Ignore .hibiscus folder
            if path.file_name().and_then(|n| n.to_str()) == Some(".hibiscus") {
                continue;
            }

            let rel_path = path.strip_prefix(base).unwrap().to_string_lossy().to_string();
            let id = rel_path.clone();

            if path.is_dir() {
                nodes.push(Node {
                    id,
                    name: path.file_name().unwrap().to_string_lossy().to_string(),
                    node_type: NodeType::Folder,
                    path: None,
                    children: Some(read_dir_recursive(&path, base)),
                    meta: None,
                });
            } else {
                nodes.push(Node {
                    id,
                    name: path.file_name().unwrap().to_string_lossy().to_string(),
                    node_type: NodeType::File,
                    path: Some(rel_path),
                    children: None,
                    meta: None,
                });
            }
        }
    }

    nodes
}
