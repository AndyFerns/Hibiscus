//! ============================================================================
//! Hibiscus Error Types
//! ============================================================================
//!
//! Centralized error handling for all Hibiscus backend operations.
//! Uses thiserror for ergonomic error definition and automatic
//! From implementations.
//!
//! DESIGN DECISIONS:
//! - All errors implement Serialize so they can be sent to the frontend
//! - Each error variant includes context about what went wrong
//! - IO errors preserve the original error message
//! ============================================================================

use serde::Serialize;
use thiserror::Error;

/// Main error type for Hibiscus operations.
///
/// This enum covers all possible error cases in the application,
/// providing typed errors instead of stringly-typed error propagation.
#[derive(Debug, Error)]
pub enum HibiscusError {
    /// File or directory was not found at the specified path
    #[error("File not found: {0}")]
    FileNotFound(String),

    /// Path exists but is not the expected type (file vs directory)
    #[error("Invalid path type: expected {expected}, got {actual} at {path}")]
    InvalidPathType {
        path: String,
        expected: String,
        actual: String,
    },

    /// Path validation failed (e.g., path traversal attempt)
    #[error("Path validation failed: {0}")]
    PathValidation(String),

    /// Filesystem I/O operation failed
    #[error("IO error: {0}")]
    Io(String),

    /// JSON serialization/deserialization failed
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// Workspace-specific errors
    #[error("Workspace error: {0}")]
    Workspace(String),

    /// File watcher errors
    #[error("Watcher error: {0}")]
    Watcher(String),
}

/// Implement From<std::io::Error> for convenient error propagation
impl From<std::io::Error> for HibiscusError {
    fn from(err: std::io::Error) -> Self {
        HibiscusError::Io(err.to_string())
    }
}

/// Implement From<serde_json::Error> for JSON operations
impl From<serde_json::Error> for HibiscusError {
    fn from(err: serde_json::Error) -> Self {
        HibiscusError::Serialization(err.to_string())
    }
}

/// Implement Serialize so errors can be sent to the frontend.
/// Tauri requires command errors to implement Serialize.
impl Serialize for HibiscusError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // Serialize as the error message string for frontend consumption
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = HibiscusError::FileNotFound("/path/to/file".into());
        assert_eq!(err.to_string(), "File not found: /path/to/file");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "test");
        let err: HibiscusError = io_err.into();
        assert!(err.to_string().contains("test"));
    }
}
