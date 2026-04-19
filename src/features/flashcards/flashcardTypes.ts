/**
 * ============================================================================
 * Flashcard Types
 * ============================================================================
 */

/** A single flashcard with a question/answer pair */
export interface Flashcard {
  /** Unique card ID */
  id: string
  /** The question or front side of the card */
  question: string
  /** The answer or back side of the card */
  answer: string
  /** Topic or category for organization */
  topic: string
}

/** A deck is a named collection of flashcards */
export interface FlashcardDeck {
  /** Unique deck ID */
  id: string
  /** Human-readable deck name */
  name: string
  /** The cards in this deck */
  cards: Flashcard[]
  /** ISO timestamp when the deck was created */
  createdAt: string
}

/** On-disk storage format for all flashcard data */
export interface FlashcardData {
  /** All decks */
  decks: FlashcardDeck[]
}
