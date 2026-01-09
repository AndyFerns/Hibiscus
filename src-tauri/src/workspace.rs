use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceFile {
    pub schema_version: String,
    pub workspace: WorkspaceInfo,
    pub settings: Option<serde_json::Value>,
    pub tree: Vec<Node>,
    pub session: Option<SessionState>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub name: String,
    pub root: String,
    // pub created_at: Option<chrono::DateTime<chrono::Utc>>, TODO Future implementation
    // pub updated_at: Option<chrono::DateTime<chrono::Utc>>, TODO Future implementation
    pub created_at: Option<String>,
    pub updated_at: Option<String>
}

/**
 * Helper Enum for all valid NodeTypes
 * 
 * TODO Add extra Node Types as the project deepens and grows
 */
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    File,
    Folder,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub name: String,

    #[serde(rename = "type")]
    pub node_type: NodeType,

    pub path: Option<String>,
    pub children: Option<Vec<Node>>,
    pub meta: Option<serde_json::Value>,
}

/**
 * Helper struct to get optional cursor position based on schema
 */
#[derive(Debug, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct SessionState {
    pub open_nodes: Option<Vec<String>>,
    pub active_node: Option<String>,
    pub cursor: Option<HashMap<String, CursorPosition>>,
}
