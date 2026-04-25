import { useState, useEffect } from "react"
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
  onOpenFile?: (path: string, line?: number) => void
}

export function ResultsList({ results, hasSearched, onOpenFile }: ResultsListProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(null)
  }, [results])

  const handleNavigate = (direction: 'next' | 'previous') => {
    if (results.length === 0) return
    
    let newIndex: number
    if (selectedIndex === null) {
      // Start with first item
      newIndex = direction === 'next' ? 0 : results.length - 1
    } else {
      // Navigate from current selection
      if (direction === 'next') {
        newIndex = selectedIndex < results.length - 1 ? selectedIndex + 1 : 0
      } else {
        newIndex = selectedIndex > 0 ? selectedIndex - 1 : results.length - 1
      }
    }
    
    setSelectedIndex(newIndex)
    
    // Auto-open the selected file
    const selectedResult = results[newIndex]
    if (selectedResult && onOpenFile) {
      const extractLineNumber = (chunkId: string): number | undefined => {
        const match = chunkId.match(/:(\d+)$/);
        return match ? parseInt(match[1], 10) : undefined;
      };
      const lineNumber = extractLineNumber(selectedResult.chunk_id);
      onOpenFile(selectedResult.file, lineNumber);
    }
  }

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
      {results.map((result, index) => (
        <ResultItem 
          key={result.chunk_id} 
          result={result} 
          onOpenFile={onOpenFile}
          onNavigate={handleNavigate}
          isSelected={selectedIndex === index}
        />
      ))}
    </div>
  )
}
