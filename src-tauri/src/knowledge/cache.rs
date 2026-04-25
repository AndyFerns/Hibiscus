//! ============================================================================
//! In-Memory LRU Cache (Phase 2)
//! ============================================================================
//!
//! A bounded, thread-safe LRU cache for query results and chunk retrieval.
//!
//! DESIGN DECISIONS:
//! - Implemented without external crates. Uses a Vec of (key, value) pairs
//!   with move-to-front semantics. For the expected cache sizes (64-256
//!   entries), linear scan is faster than a HashMap+LinkedList due to cache
//!   locality.
//! - The cache is wrapped in `tokio::sync::Mutex` for async-safe access.
//!   Contention is minimal because cache operations are O(n) with small n.
//! - Cache invalidation is all-or-nothing: any file change clears the entire
//!   cache. This is correct because a file change may affect any keyword's
//!   results, and selective invalidation would require tracking which
//!   keywords are affected by which files (complex, not worth it for Phase 2).
//!
//! MEMORY: Each cache entry stores a key (String) and a value (Vec of results).
//! With a max size of 128 entries and ~20 results per entry, worst-case memory
//! is approximately 128 * 20 * 200 bytes = ~500 KB. Well within bounds.
//! ============================================================================

use std::collections::VecDeque;

/// Maximum number of entries in the query results cache.
const MAX_QUERY_CACHE: usize = 128;

/// Maximum number of entries in the chunk retrieval cache.
const MAX_CHUNK_CACHE: usize = 256;

/// A generic bounded LRU cache.
///
/// Entries are stored in a VecDeque with most-recently-used at the front.
/// On insertion, if the cache is full, the least-recently-used entry (back)
/// is evicted.
///
/// PERFORMANCE: All operations are O(n) where n = cache capacity. For our
/// use case (n <= 256), this is faster than a HashMap+LinkedList approach
/// due to better CPU cache utilization.
pub struct LruCache<V: Clone> {
    entries: VecDeque<(String, V)>,
    capacity: usize,
}

impl<V: Clone> LruCache<V> {
    /// Create a new LRU cache with the given capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    /// Look up a key in the cache. If found, moves the entry to the front
    /// (most recently used) and returns a clone of the value.
    pub fn get(&mut self, key: &str) -> Option<V> {
        if let Some(pos) = self.entries.iter().position(|(k, _)| k == key) {
            // Move to front (MRU position).
            let entry = self.entries.remove(pos).unwrap();
            let value = entry.1.clone();
            self.entries.push_front(entry);
            Some(value)
        } else {
            None
        }
    }

    /// Insert a key-value pair into the cache. If the key already exists,
    /// its value is updated and it is moved to the front. If the cache is
    /// full, the least-recently-used entry is evicted.
    pub fn insert(&mut self, key: String, value: V) {
        // Remove existing entry for this key, if any.
        if let Some(pos) = self.entries.iter().position(|(k, _)| k == &key) {
            self.entries.remove(pos);
        }

        // Evict LRU entry if at capacity.
        if self.entries.len() >= self.capacity {
            self.entries.pop_back();
        }

        self.entries.push_front((key, value));
    }

    /// Clear all entries from the cache.
    /// Called on file change events to invalidate stale results.
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Returns the number of entries currently in the cache.
    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

/// The application-level cache container, holding separate LRU caches for
/// query results and individual chunk lookups.
///
/// This struct is stored inside `KnowledgeState` behind a `tokio::sync::Mutex`
/// so it can be accessed from async Tauri command handlers.
pub struct KnowledgeCache {
    /// Cache for search query results: query string -> list of (chunk_id, score) pairs.
    pub query_cache: LruCache<Vec<(String, f64)>>,
    /// Cache for individual chunk reads: chunk_id -> serialized chunk JSON.
    pub chunk_cache: LruCache<String>,
}

impl KnowledgeCache {
    pub fn new() -> Self {
        Self {
            query_cache: LruCache::new(MAX_QUERY_CACHE),
            chunk_cache: LruCache::new(MAX_CHUNK_CACHE),
        }
    }

    /// Invalidate all caches. Called whenever a file change is processed.
    pub fn invalidate_all(&mut self) {
        self.query_cache.clear();
        self.chunk_cache.clear();
    }
}

impl Default for KnowledgeCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lru_basic() {
        let mut cache: LruCache<String> = LruCache::new(2);
        cache.insert("a".into(), "val_a".into());
        cache.insert("b".into(), "val_b".into());
        assert_eq!(cache.get("a"), Some("val_a".into()));
        assert_eq!(cache.get("b"), Some("val_b".into()));
    }

    #[test]
    fn test_lru_eviction() {
        let mut cache: LruCache<String> = LruCache::new(2);
        cache.insert("a".into(), "1".into());
        cache.insert("b".into(), "2".into());
        cache.insert("c".into(), "3".into()); // Should evict "a"
        assert_eq!(cache.get("a"), None);
        assert_eq!(cache.get("b"), Some("2".into()));
        assert_eq!(cache.get("c"), Some("3".into()));
    }

    #[test]
    fn test_lru_access_promotes() {
        let mut cache: LruCache<String> = LruCache::new(2);
        cache.insert("a".into(), "1".into());
        cache.insert("b".into(), "2".into());
        // Access "a" to promote it
        let _ = cache.get("a");
        // Insert "c" -- should evict "b" (LRU), not "a" (MRU)
        cache.insert("c".into(), "3".into());
        assert_eq!(cache.get("a"), Some("1".into()));
        assert_eq!(cache.get("b"), None);
    }

    #[test]
    fn test_cache_invalidation() {
        let mut cache = KnowledgeCache::new();
        cache.query_cache.insert("test".into(), vec![("c1".into(), 1.0)]);
        cache.chunk_cache.insert("c1".into(), "data".into());
        cache.invalidate_all();
        assert_eq!(cache.query_cache.len(), 0);
        assert_eq!(cache.chunk_cache.len(), 0);
    }
}
