# Knowledge Pipeline (Phase 1)

Hibiscus features a local-first, incremental knowledge indexing system designed to make your workspace deeply searchable without compromising performance or privacy.

The knowledge pipeline processes raw text and markdown files, chunks them intelligently, and maintains a highly optimized inverted keyword index entirely on your local machine.

## Design Constraints

The indexing system adheres strictly to the following architectural constraints:
- **Local-First**: All data processing and storage happens on-device.
- **Derived & Rebuildable**: The knowledge layer acts as a read-only cache. It is entirely derived from your workspace files and can be rebuilt at any time.
- **Immutable Source**: The pipeline will **never** mutate user files.
- **Memory Efficiency**: Chunks are streamed via buffered disk I/O, preventing bulk memory loading.
- **Non-Blocking**: All processing is relegated to an asynchronous background worker pool, maintaining a smooth UI thread.

## Pipeline Architecture

The pipeline processes files in a structured, step-by-step flow:

`Watcher -> Debounced Queue -> Worker Pool -> Parser -> Chunker -> Indexer -> Storage -> Query API`

### 1. Watcher
The filesystem watcher monitors your workspace root for any `Create`, `Modify`, or `Delete` events affecting `.md` and `.txt` files. These events are immediately forwarded to the knowledge queue.

### 2. Debounced Queue
To prevent redundant processing (e.g., rapid consecutive saves), events are debounced and deduplicated inside a queue. A batch is formed over a small time window and dispatched as a single unit to the worker pool.

### 3. Worker Pool
An asynchronous Tokio-based worker pool processes the batched events. Concurrency is bounded by the available CPU cores to prevent system starvation. Each file is processed entirely independently of others.

### 4. Parser System
A trait-based parser system extracts structured sections from the raw files:
- **Markdown Parser**: Splits documents based on ATX-style headings (`#`, `##`), capturing the heading context for each section.
- **Text Parser**: Splits plain text files intelligently based on paragraph breaks.

### 5. Chunker
The chunking engine splits the parsed sections into size-bounded chunks (typically 200-500 words). It guarantees:
- **Heading Preservation**: Every chunk retains the context of its parent heading.
- **Boundary Enforcement**: Chunks never cross file boundaries.
- **Deterministic Hashing**: Each chunk receives a deterministic, content-addressable ID to easily track changes.

### 6. Incremental Indexer
An inverted keyword index (`keyword -> [chunk_ids]`) is maintained. During processing, the indexer applies strict normalization:
- Keywords are lowercased and stripped of alphanumeric padding.
- Common English stopwords are filtered out.
- Unchanged files are aggressively skipped using SHA-256 content hashes, ensuring only the delta is processed.

### 7. Storage Layer
Derived data is serialized to JSON and stored locally within `.hibiscus/knowledge/`.
- `manifest.json`: Tracks indexing metadata.
- `index/keyword_index.json`: The core inverted keyword mapping.
- `files/file_map.json`: Tracks the relationship between source files and derived chunk IDs.
- `chunks/<chunk_id>.json`: Individual chunk files, written atomically.

### 8. Query API
The frontend interacts with the knowledge system via Tauri commands (`search_knowledge`, `get_chunk`). Query results are aggressively cached for instant retrieval during continuous typing, and invalidation occurs automatically when the underlying index is modified.
