import { useState, useCallback, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { SearchInput } from "./SearchInput"
import { ResultsList } from "./ResultsList"
import { TopicsDropdown } from "./TopicsDropdown"
import "./search.css"

interface SearchResult {
  chunk_id: string
  file: string
  heading: string
  content: string
  word_count: number
  score: number
}

interface TopicMap {
  [topic: string]: string[]
}

interface SearchPanelProps {
  open: boolean
  onClose: () => void
  workspaceRoot: string | null
  onOpenFile?: (path: string, line?: number) => void
}

export function SearchPanel({ open, onClose, workspaceRoot, onOpenFile }: SearchPanelProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [topics, setTopics] = useState<TopicMap>({})
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultCount, setResultCount] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)

  // Debounced search
  const debouncedSearch = useCallback(
    async (searchQuery: string) => {
      if (!workspaceRoot || !searchQuery.trim()) {
        setResults([])
        setResultCount(0)
        return
      }

      setHasSearched(true)
      setLoading(true)
      try {
        const searchResults = await invoke<SearchResult[]>("search_chunks", {
          query: searchQuery,
          offset: 0,
          limit: 20
        })
        setResults(searchResults)
        setResultCount(searchResults.length)
      } catch (error) {
        console.error("Search failed:", error)
        setResults([])
        setResultCount(0)
      } finally {
        setLoading(false)
      }
    },
    [workspaceRoot]
  )

  // Load topics
  const loadTopics = useCallback(async () => {
    if (!workspaceRoot) return
    try {
      const topicData = await invoke<TopicMap>("get_topics")
      setTopics(topicData)
    } catch (error) {
      console.error("Failed to load topics:", error)
    }
  }, [workspaceRoot])

  // Initialize topics on mount and reset search state
  useEffect(() => {
    if (open) {
      loadTopics()
      setHasSearched(false)
    }
  }, [open, loadTopics])

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedSearch(query)
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [query, debouncedSearch])

  const handleTopicSelect = useCallback((topic: string | null) => {
    setSelectedTopic(topic)
    // Could filter results by topic in future iteration
  }, [])

  if (!open) return null

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-header-left">
          <span>Search Knowledge Base</span>
          {loading && <span className="search-loading">(Loading...)</span>}
        </div>
        <button className="search-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="search-input-row">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search your knowledge base..."
        />
        <TopicsDropdown
          topics={topics}
          selectedTopic={selectedTopic}
          onTopicSelect={handleTopicSelect}
        />
      </div>

      <div className="search-body">
        <ResultsList results={results} hasSearched={hasSearched} onOpenFile={onOpenFile} />
      </div>

      <div className="search-footer">
        {hasSearched && resultCount > 0 && (
          <span>{Math.min(resultCount, 20)} of {resultCount} results</span>
        )}
      </div>
    </div>
  )
}
