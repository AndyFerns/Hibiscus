interface SearchResult {
  chunk_id: string
  file: string
  heading: string
  content: string
  word_count: number
  score: number
}

interface ResultItemProps {
  result: SearchResult
  onOpenFile?: (path: string, line?: number) => void
  onNavigate?: (direction: 'next' | 'previous') => void
  isSelected?: boolean
}

export function ResultItem({ result, onOpenFile, onNavigate, isSelected }: ResultItemProps) {
  // Normalize file path - replace double backslashes with single backslashes
  const normalizedFile = result.file.replace(/\\\\/g, '\\')
  const fileName = normalizedFile.split(/[/\\]/).pop() || normalizedFile
  const preview = result.content.length > 150 
    ? result.content.substring(0, 150) + "..."
    : result.content

  // Extract line number from chunk_id if available (format: "file:line" or similar)
  const extractLineNumber = (chunkId: string): number | undefined => {
    // Try different patterns for line number extraction
    const patterns = [
      /:(\d+)$/,           // "file:123"
      /#(\d+)$/,           // "file#123" 
      /@(\d+)$/,           // "file@123"
      /_(\d+)$/,           // "file_123"
    ];
    
    for (const pattern of patterns) {
      const match = chunkId.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return undefined;
  };

  const handleClick = () => {
    console.log('ResultItem clicked:', { file: normalizedFile, chunkId: result.chunk_id });
    if (onOpenFile) {
      const lineNumber = extractLineNumber(result.chunk_id);
      console.log('Calling onOpenFile with:', { file: normalizedFile, lineNumber });
      onOpenFile(normalizedFile, lineNumber);
    } else {
      console.log('onOpenFile callback not available');
    }
  };

  return (
    <div 
      className={`search-item ${onOpenFile ? 'clickable' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      role={onOpenFile ? "button" : undefined}
      tabIndex={onOpenFile ? 0 : undefined}
      onKeyDown={onOpenFile ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          // Navigate to next/previous result
          const direction = e.shiftKey ? 'previous' : 'next';
          onNavigate?.(direction);
        }
      } : undefined}
    >
      <div className="search-item-header">
        <span className="search-item-file">{fileName}</span>
        {result.score > 0 && (
          <span className="search-item-score">Score: {result.score.toFixed(2)}</span>
        )}
      </div>
      
      {result.heading && (
        <div className="search-item-heading">{result.heading}</div>
      )}
      
      <div className="search-item-content">{preview}</div>
      
      <div className="search-item-meta">
        <span className="search-item-words">{result.word_count} words</span>
      </div>
    </div>
  )
}
