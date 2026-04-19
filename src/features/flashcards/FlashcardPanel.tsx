/**
 * ============================================================================
 * FlashcardPanel — Full Flashcards View (Right Panel)
 * ============================================================================
 *
 * Wrapper panel with deck selector sidebar + FlashcardViewer.
 * Keyboard events are captured at panel level for card navigation.
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react"
import { FlashcardViewer } from "./FlashcardViewer"
import type { useFlashcards } from "./useFlashcards"
import "./FlashcardPanel.css"

type FlashcardsHook = ReturnType<typeof useFlashcards>

interface FlashcardPanelProps {
  flashcards: FlashcardsHook
}

export function FlashcardPanel({ flashcards }: FlashcardPanelProps) {
  const {
    decks,
    activeDeck,
    activeDeckId,
    currentCard,
    currentCardIndex,
    isFlipped,
    selectDeck,
    createDeck,
    deleteDeck,
    nextCard,
    prevCard,
    flipCard,
    shuffleDeck,
    generateFlashcardsFromNotes,
  } = flashcards

  const [newDeckName, setNewDeckName] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Only handle if flashcard panel is focused
      if (!panelRef.current?.contains(document.activeElement) &&
          document.activeElement !== document.body) return

      switch (e.key) {
        case " ":
          e.preventDefault()
          flipCard()
          break
        case "ArrowRight":
        case "d":
          nextCard()
          break
        case "ArrowLeft":
        case "a":
          prevCard()
          break
        case "s":
          shuffleDeck()
          break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [flipCard, nextCard, prevCard, shuffleDeck])

  const handleCreateDeck = () => {
    const name = newDeckName.trim()
    if (!name) return
    createDeck(name)
    setNewDeckName("")
  }

  return (
    <div className="fc-panel" ref={panelRef}>
      {/* Header */}
      <div className="fc-panel-header">
        <span className="fc-panel-emoji">🃏</span>
        <span className="fc-panel-title">Flashcards</span>
      </div>

      {/* Deck selector */}
      <div className="fc-deck-list">
        {decks.map((d) => (
          <div
            key={d.id}
            className={`fc-deck-item ${d.id === activeDeckId ? "active" : ""}`}
          >
            <button
              className="fc-deck-btn"
              onClick={() => selectDeck(d.id)}
            >
              📚 {d.name}
              <span className="fc-deck-count">{d.cards.length}</span>
            </button>
            <button
              className="fc-deck-delete"
              onClick={() => deleteDeck(d.id)}
              title="Delete deck"
            >
              ×
            </button>
          </div>
        ))}

        {/* New deck input */}
        <div className="fc-deck-new">
          <input
            className="fc-deck-input"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="New deck name..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateDeck()}
          />
          <button className="fc-btn" onClick={handleCreateDeck}>+</button>
        </div>

        {/* Generate stub */}
        <button
          className="fc-btn fc-btn-generate"
          onClick={() => generateFlashcardsFromNotes([])}
          title="Generate sample flashcards (stub)"
        >
          ✨ Generate from Notes
        </button>
      </div>

      {/* Card viewer */}
      <div className="fc-panel-viewer">
        <FlashcardViewer
          card={currentCard}
          isFlipped={isFlipped}
          currentIndex={currentCardIndex}
          totalCards={activeDeck?.cards.length || 0}
          onFlip={flipCard}
          onNext={nextCard}
          onPrev={prevCard}
          onShuffle={shuffleDeck}
        />
      </div>
    </div>
  )
}
