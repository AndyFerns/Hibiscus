# Search & Knowledge Retrieval Guide

Hibiscus features an intelligent search system that goes beyond simple file name matching. It understands the content of your documents and provides ranked, context-aware results that help you find exactly what you're looking for.

## How Search Works

When you search in Hibiscus, you're not just searching file names - you're searching the actual content of your documents, including PDFs, DOCX files, Markdown, and plain text files. The system uses advanced TF-IDF scoring to rank results by relevance.

### Search Features

#### Ranked Results

Search results are automatically ranked by relevance using TF-IDF (Term Frequency-Inverse Document Frequency) scoring. This means:

- Documents that use your search term more frequently rank higher
- Common words that appear in many documents are weighted less heavily
- Results are scored during indexing for instant query-time performance

#### Fuzzy Matching

The search system is forgiving of typos. If you type "recusion" but meant "recursion", Hibiscus will still find relevant results by matching terms within an edit distance of 1.

#### Prefix Matching

Partial searches work as expected. Searching for "react" will match "react", "reaction", "reactive", etc., though with slightly lower relevance scores than exact matches.

#### Multi-Word Queries

You can search for phrases and multiple words. The system accumulates scores across all terms, so documents that match more of your query terms will rank higher.

## Using Search

### Basic Search

Simply type your query into the search bar and press Enter. Results appear instantly, ranked by relevance.

### Advanced Techniques

**Use specific terminology**: Since the search understands content, using technical terms from your field will yield more precise results than general terms.

**Combine concepts**: Search for multiple related concepts to find documents that discuss them together.

**Leverage fuzzy matching**: Don't worry about perfect spelling - the system handles minor typos automatically.

## Search Navigation

### Interactive Results

Search results are now fully interactive with multiple navigation options:

#### Click Navigation

- **Click any result** → File opens at exact location
- **Line highlighting** → Automatically highlights relevant section
- **Smooth transitions** → Visual feedback for better UX

#### Keyboard Navigation

- **Tab** → Navigate to next result (auto-opens file)
- **Shift+Tab** → Navigate to previous result (auto-opens file)
- **Enter/Space** → Open selected result
- **Circular navigation** → Wraps around seamlessly

#### Visual Feedback

- **Selection highlighting** → Selected result highlighted with accent color
- **Hover effects** → Interactive feedback on mouse over
- **Focus indicators** → Clear visual focus management

### Topics Navigation

The topics dropdown is now expandable/collapsible:

#### Click Interaction

- **Click "All Topics"** → Toggle expand/collapse
- **Smooth animations** → Arrow indicator rotates
- **Topic selection** → Click to filter by specific topic

#### Organization

- **Smart grouping** → Related topics automatically grouped
- **Deterministic ordering** → Consistent topic arrangement
- **Visual hierarchy** → Clean, organized presentation

## Integration

### Right Panel Integration

Search is now fully integrated into the right panel structure:

#### Access Methods

- **Ctrl+Shift+F** → Opens right panel + switches to search tab
- **Panel toggle** → Opens panel if collapsed
- **Seamless switching** → Maintains panel state

#### Architecture

- **Unified state management** → Consistent with other study tools
- **Theme integration** → Uses existing design tokens
- **Responsive layout** → Adapts to panel size

## File Handling

### Path Normalization

- **Double backslash handling** → Fixes Windows path issues
- **Cross-platform compatibility** → Works on all operating systems
- **Error prevention** → Robust path validation

### Line Number Extraction

- **Multiple format support** → Handles various chunk_id patterns:
  - `file:123` (colon format)
  - `file#123` (hash format)  
  - `file@123` (at format)
  - `file_123` (underscore format)
- **Graceful fallback** → Works when line numbers unavailable

## Developer Features

### Debug Support

Comprehensive logging for troubleshooting:

```javascript
// Debug logging tracks:
console.log('ResultItem clicked:', { file: normalizedFile, chunkId: result.chunk_id });
console.log('Calling onOpenFile with:', { file: normalizedFile, lineNumber });
```

### Performance Optimizations

- **State management** → Efficient selection updates
- **Event handling** → Proper cleanup and delegation
- **Navigation caching** → Fast result cycling

## Understanding Results

### Result Cards

Each search result shows:

- **Relevance Score**: Higher scores indicate better matches
- **Content Preview**: The actual text chunk that matched your query
- **Source File**: Which file the content came from
- **Topic Context**: Which topic the chunk belongs to (if applicable)

### Topic-Based Navigation

Search results are grouped by topics when relevant. This helps you:

- Find all content related to a specific subject
- Discover connections across different files
- Navigate systematically through related material

## Performance & Caching

Search results are cached for instant responsiveness. When you type, you're seeing cached results that update as files change. The cache automatically invalidates when you modify files, ensuring you always see current data.

## File Support

Hibiscus searches across multiple file formats:

- **Markdown (.md)**: Full content indexing with heading context
- **Plain Text (.txt)**: Paragraph-based indexing
- **PDF (.pdf)**: Text extraction with paragraph heuristics
- **DOCX (.docx)**: XML-based text extraction

**Note**: Very large files (>10MB) are automatically skipped to maintain performance.

## Search Tips

1. **Be specific**: Use domain-specific terminology for better results
2. **Try variations**: If you don't find what you want, try related terms or spellings
3. **Use context**: Search for concepts rather than just keywords
4. **Explore topics**: Use the topic navigation to discover related content
5. **Trust the ranking**: Higher-ranked results are typically more relevant

## Technical Details (For Curious Users)

The search system uses a sophisticated pipeline:

1. **Indexing**: Documents are parsed, chunked, and indexed in the background
2. **TF-IDF Scoring**: Each keyword receives a precomputed relevance score
3. **Query Processing**: Your search is processed with exact, prefix, and fuzzy matching
4. **Result Ranking**: Multiple scoring factors combine to rank results
5. **Caching**: Results are cached for instant subsequent access

All processing happens locally on your machine - no data ever leaves your workspace.

## Troubleshooting

**No results found?**

- Try different search terms or spellings
- Check if the file type is supported
- Verify the file isn't larger than 10MB

**Unexpected results?**

- The system ranks by statistical relevance, not semantic meaning
- Try more specific terms for better precision
- Use topic navigation to explore related content

**Slow performance?**

- Large workspaces may take time to index initially
- Search is instant once indexing is complete
- Cache ensures responsive typing during searches
