use serde::{Deserialize, Serialize};

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
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub name: String,

    #[serde(rename = "type")]
    pub node_type: Option<String>,

    pub path: Option<String>,
    pub children: Option<Vec<Node>>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionState {
    pub open_nodes: Option<Vec<String>>,
    pub active_node: Option<String>,
    pub cursor: Option<serde_json::Value>,
}
