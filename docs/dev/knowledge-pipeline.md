# Knowledge Pipeline (Phase 2)

Hibiscus features a local-first, incremental knowledge indexing system designed to make your workspace deeply searchable without compromising performance or privacy.

The knowledge pipeline processes raw text, markdown, PDF, and DOCX files. It chunks them intelligently, extracts topics, and maintains a highly optimized inverted keyword index with advanced TF-IDF scoring entirely on your local machine.

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

The filesystem watcher monitors your workspace root for any `Create`, `Modify`, or `Delete` events affecting `.md`, `.txt`, `.pdf`, and `.docx` files. These events are immediately forwarded to the knowledge queue.

### 2. Debounced Queue

To prevent redundant processing (e.g., rapid consecutive saves), events are debounced and deduplicated inside a queue. A batch is formed over a small time window and dispatched as a single unit to the worker pool.

### 3. Worker Pool

An asynchronous Tokio-based worker pool processes the batched events. Concurrency is bounded by the available CPU cores to prevent system starvation. Each file is processed entirely independently of others. 
**Ingestion Priorities**: Extremely large files (e.g., > 10MB) are efficiently bypassed to avoid unexpected memory spikes, ensuring background processing remains lightweight.

### 4. Parser System

A trait-based parser system extracts structured sections from the raw files:

- **Markdown Parser**: Splits documents based on ATX-style headings (`#`, `##`), capturing the heading context for each section.
- **Text Parser**: Splits plain text files intelligently based on paragraph breaks.
- **PDF Parser**: Uses text extraction to strip plain text from PDFs, falling back to basic paragraph heuristics.
- **DOCX Parser**: Employs streaming XML parsing of `word/document.xml` for highly efficient text retrieval without loading the entire DOM.

### 5. Chunker

The chunking engine splits the parsed sections into size-bounded chunks (typically 200-500 words). It guarantees:

- **Heading Preservation**: Every chunk retains the context of its parent heading.
- **Boundary Enforcement**: Chunks never cross file boundaries.
- **Deterministic Hashing**: Each chunk receives a deterministic, content-addressable ID to easily track changes.

### 6. Incremental Indexer & Topic Extraction

An inverted keyword index (`keyword -> [chunk_ids]`) is maintained. During processing, the indexer applies strict normalization:

- Keywords are lowercased and stripped of alphanumeric padding.
- Common English stopwords are filtered out.
- Unchanged files are aggressively skipped using SHA-256 content hashes, ensuring only the delta is processed.

**TF-IDF Scored Index (Phase 2)**: 
After indexing, a lightweight TF-IDF score is precomputed for each keyword. This produces a `ScoredKeywordIndex` where `score = ln(1 + term_frequency) * ln(total_chunks / doc_frequency)`. This ensures that query-time ranking requires zero calculation.

**Topic Grouping**: 
In parallel, a lightweight heuristic topic grouping runs, clustering chunks into topics based on heading text overlap deterministically (without relying on ML or external clustering libraries).

### 7. Storage Layer

Derived data is serialized to JSON and stored locally within `.hibiscus/knowledge/`.

- `manifest.json`: Tracks indexing metadata.
- `topics.json`: Maps topic names to chunk IDs.
- `index/keyword_index.json`: The core inverted keyword mapping (legacy Phase 1 compatibility).
- `index/scored_index.json`: The active TF-IDF scored inverted keyword mapping.
- `files/file_map.json`: Tracks the relationship between source files and derived chunk IDs.
- `chunks/<chunk_id>.json`: Individual chunk files, written atomically.

### 8. Query API & Caching Layer

The frontend interacts with the knowledge system via robust Tauri commands (`search_chunks`, `get_topics`, `get_chunk`). 

**Query Engine**:

- **Ranked Search**: Retrieves results using the precomputed TF-IDF scores.
- **Prefix Matching**: Keywords starting with a query term receive a slight relevance boost.
- **Fuzzy Matching**: Query terms within an edit distance of 1 receive a fuzzy boost, improving typo resilience.
- **Pagination**: Supports top-K limiting and offsets to handle large result sets elegantly.

**Caching**:
A custom in-memory LRU cache stores recent query results and retrieved chunks. This guarantees instant responses while typing. The cache implements an all-or-nothing invalidation strategy, seamlessly flushing stale results anytime a source file changes.
