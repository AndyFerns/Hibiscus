interface TopicMap {
  [topic: string]: string[]
}

interface TopicsDropdownProps {
  topics: TopicMap
  selectedTopic: string | null
  onTopicSelect: (topic: string | null) => void
}

export function TopicsDropdown({ topics, selectedTopic, onTopicSelect }: TopicsDropdownProps) {
  const topicList = Object.entries(topics)
    .map(([name, chunks]) => ({ name, count: chunks.length }))
    .sort((a, b) => b.count - a.count)

  const handleTopicClick = (topic: string | null) => {
    onTopicSelect(topic)
  }

  return (
    <div className="topics-dropdown">
      <button 
        className={`topics-item ${selectedTopic === null ? 'topics-item-active' : ''}`}
        onClick={() => handleTopicClick(null)}
      >
        All Topics
      </button>
      
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
  )
}
