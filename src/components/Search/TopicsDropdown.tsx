import { useState } from "react"

interface TopicMap {
  [topic: string]: string[]
}

interface TopicsDropdownProps {
  topics: TopicMap
  selectedTopic: string | null
  onTopicSelect: (topic: string | null) => void
}

export function TopicsDropdown({ topics, selectedTopic, onTopicSelect }: TopicsDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const topicList = Object.entries(topics)
    .map(([name, chunks]) => ({ name, count: chunks.length }))
    .sort((a, b) => b.count - a.count)

  const handleTopicClick = (topic: string | null) => {
    onTopicSelect(topic)
  }

  return (
    <div className="topics-dropdown">
      <button 
        className={`topics-item topics-header ${selectedTopic === null ? 'topics-item-active' : ''}`}
        onClick={() => {
          handleTopicClick(null)
          setIsExpanded(!isExpanded)
        }}
      >
        <span>All Topics</span>
        <span className={`topics-expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </button>
      
      {isExpanded && (
        <div className="topics-list">
          {topicList.map((topic) => (
            <button
              key={topic.name}
              className={`topics-item ${selectedTopic === topic.name ? 'topics-item-active' : ''}`}
              onClick={() => handleTopicClick(topic.name)}
            >
              <span className="topics-name">{topic.name}</span>
              <span className="topics-count">({topic.count})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
