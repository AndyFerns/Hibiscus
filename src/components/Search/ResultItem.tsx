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
}

export function ResultItem({ result }: ResultItemProps) {
  const fileName = result.file.split(/[/\\]/).pop() || result.file
  const preview = result.content.length > 150 
    ? result.content.substring(0, 150) + "..."
    : result.content

  return (
    <div className="search-item">
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
