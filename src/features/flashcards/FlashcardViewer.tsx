/**
 * ============================================================================
 * FlashcardViewer — 3D Card Flip Viewer Component
 * ============================================================================
 *
 * Displays a single flashcard with CSS 3D flip animation.
 * Shows question on front, answer on back.
 *
 * KEYBOARD SHORTCUTS:
 * - Space: Flip card
 * - → or D: Next card
 * - ← or A: Previous card
 * - S: Shuffle deck
 * ============================================================================
 */

import type { Flashcard } from "./flashcardTypes"
import "./FlashcardViewer.css"

interface FlashcardViewerProps {
  card: Flashcard | null
  isFlipped: boolean
  currentIndex: number
  totalCards: number
  onFlip: () => void
  onNext: () => void
  onPrev: () => void
  onShuffle: () => void
}

export function FlashcardViewer({
  card,
  isFlipped,
  currentIndex,
  totalCards,
  onFlip,
  onNext,
  onPrev,
  onShuffle,
}: FlashcardViewerProps) {
  // Empty state
  if (!card) {
    return (
      <div className="fc-viewer-empty">
        <span className="fc-viewer-empty-icon">🃏</span>
        <span className="fc-viewer-empty-text">
          No cards in this deck. Add some or generate from notes!
        </span>
      </div>
    )
  }

  return (
    <div className="fc-viewer">
      {/* Topic tag */}
      {card.topic && (
        <span className="fc-viewer-topic">{card.topic}</span>
      )}

      {/* Card with flip animation */}
      <div
        className={`fc-card ${isFlipped ? "fc-card--flipped" : ""}`}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? "Answer side" : "Question side"}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            onFlip()
          }
        }}
      >
        <div className="fc-card-inner">
          {/* Front (Question) */}
          <div className="fc-card-face fc-card-front">
            <span className="fc-card-side-label">Q</span>
            <p className="fc-card-text">{card.question}</p>
            <span className="fc-card-hint">Click to flip</span>
          </div>

          {/* Back (Answer) */}
          <div className="fc-card-face fc-card-back">
            <span className="fc-card-side-label">A</span>
            <p className="fc-card-text">{card.answer}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="fc-viewer-controls">
        <button className="fc-btn" onClick={onPrev} title="Previous (←)">
          ← Prev
        </button>
        <span className="fc-viewer-progress">
          {currentIndex + 1} / {totalCards}
        </span>
        <button className="fc-btn" onClick={onNext} title="Next (→)">
          Next →
        </button>
      </div>

      <button className="fc-btn fc-btn-shuffle" onClick={onShuffle} title="Shuffle (S)">
        🔀 Shuffle
      </button>
    </div>
  )
}
