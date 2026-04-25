import { ResultItem } from "./ResultItem"

interface SearchResult {
  chunk_id: string
  file: string
  heading: string
  content: string
  word_count: number
  score: number
}

interface ResultsListProps {
  results: SearchResult[]
  hasSearched: boolean
}

export function ResultsList({ results, hasSearched }: ResultsListProps) {
  if (!hasSearched) {
    return (
      <div className="search-idle">
        <span className="search-idle-text">Start typing to search your knowledge base</span>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="search-empty">
        <span className="search-empty-text">No results found</span>
      </div>
    )
  }

  return (
    <div className="search-results">
      {results.map((result) => (
        <ResultItem key={result.chunk_id} result={result} />
      ))}
    </div>
  )
}
