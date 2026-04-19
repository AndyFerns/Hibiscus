/**
 * ============================================================================
 * useFlashcards — Flashcard Deck Management Hook
 * ============================================================================
 *
 * Manages flashcard decks: CRUD operations, navigation, and persistence.
 *
 * FEATURES:
 * - Create, rename, delete decks
 * - Add/remove cards within a deck
 * - Card navigation (next, prev, shuffle)
 * - Stubbed `generateFlashcardsFromNotes()` for future AI integration
 * - Persists to .hibiscus/study/flashcards.json
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { FlashcardDeck, FlashcardData, Flashcard } from "./flashcardTypes"

// =============================================================================
// HELPERS
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Sample flashcards for the stub generator */
const SAMPLE_CARDS: Flashcard[] = [
  { id: "sample-1", question: "What is Big-O notation?", answer: "A mathematical notation describing the limiting behavior of a function, used to classify algorithm efficiency.", topic: "Algorithms" },
  { id: "sample-2", question: "What is a hash table?", answer: "A data structure that maps keys to values using a hash function for O(1) average-case lookups.", topic: "Data Structures" },
  { id: "sample-3", question: "What is recursion?", answer: "A function that calls itself to solve a problem by breaking it into smaller subproblems with a base case.", topic: "Programming" },
  { id: "sample-4", question: "Explain the CAP theorem.", answer: "A distributed system can only guarantee two of: Consistency, Availability, and Partition tolerance.", topic: "Systems" },
  { id: "sample-5", question: "What is memoization?", answer: "An optimization technique that stores results of expensive function calls and returns cached results for repeated inputs.", topic: "Optimization" },
]

// =============================================================================
// HOOK
// =============================================================================

export function useFlashcards(workspaceRoot: string | null) {
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // ---- Derived state ----
  const activeDeck = decks.find((d) => d.id === activeDeckId) || null
  const currentCard = activeDeck?.cards[currentCardIndex] || null

  // ---- Load on mount ----
  useEffect(() => {
    if (!workspaceRoot) {
      setIsLoaded(true)
      return
    }

    invoke<string>("read_study_data", {
      root: workspaceRoot,
      filename: "flashcards.json",
    })
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as FlashcardData
            setDecks(parsed.decks || [])
            if (parsed.decks.length > 0) {
              setActiveDeckId(parsed.decks[0].id)
            }
          } catch (e) {
            console.warn("[Flashcards] Invalid JSON:", e)
          }
        }
      })
      .catch((err) => console.warn("[Flashcards] Load error:", err))
      .finally(() => setIsLoaded(true))
  }, [workspaceRoot])

  // ---- Persist ----
  const persist = useCallback(
    (updated: FlashcardDeck[]) => {
      if (!workspaceRoot) return
      const data: FlashcardData = { decks: updated }
      invoke("save_study_data", {
        root: workspaceRoot,
        filename: "flashcards.json",
        data: JSON.stringify(data, null, 2),
      }).catch((err) => console.warn("[Flashcards] Save error:", err))
    },
    [workspaceRoot]
  )

  // ---- Deck CRUD ----

  const createDeck = useCallback(
    (name: string) => {
      const newDeck: FlashcardDeck = {
        id: generateId("deck"),
        name,
        cards: [],
        createdAt: new Date().toISOString(),
      }
      setDecks((prev) => {
        const updated = [...prev, newDeck]
        persist(updated)
        return updated
      })
      setActiveDeckId(newDeck.id)
      setCurrentCardIndex(0)
      setIsFlipped(false)
    },
    [persist]
  )

  const deleteDeck = useCallback(
    (deckId: string) => {
      setDecks((prev) => {
        const updated = prev.filter((d) => d.id !== deckId)
        persist(updated)
        return updated
      })
      if (activeDeckId === deckId) {
        setActiveDeckId(null)
        setCurrentCardIndex(0)
      }
    },
    [activeDeckId, persist]
  )

  const addCard = useCallback(
    (deckId: string, card: Omit<Flashcard, "id">) => {
      setDecks((prev) => {
        const updated = prev.map((d) =>
          d.id === deckId
            ? { ...d, cards: [...d.cards, { ...card, id: generateId("card") }] }
            : d
        )
        persist(updated)
        return updated
      })
    },
    [persist]
  )

  // ---- Navigation ----

  const nextCard = useCallback(() => {
    if (!activeDeck) return
    setCurrentCardIndex((prev) =>
      prev < activeDeck.cards.length - 1 ? prev + 1 : 0
    )
    setIsFlipped(false)
  }, [activeDeck])

  const prevCard = useCallback(() => {
    if (!activeDeck) return
    setCurrentCardIndex((prev) =>
      prev > 0 ? prev - 1 : activeDeck.cards.length - 1
    )
    setIsFlipped(false)
  }, [activeDeck])

  const flipCard = useCallback(() => {
    setIsFlipped((prev) => !prev)
  }, [])

  const shuffleDeck = useCallback(() => {
    if (!activeDeck || activeDeck.cards.length === 0) return
    setDecks((prev) => {
      const updated = prev.map((d) => {
        if (d.id !== activeDeck.id) return d
        const shuffled = [...d.cards]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return { ...d, cards: shuffled }
      })
      return updated
    })
    setCurrentCardIndex(0)
    setIsFlipped(false)
  }, [activeDeck])

  // ---- Stub: Generate flashcards from notes ----
  /**
   * STUBBED: In the future, this will use AI/NLP to extract
   * question-answer pairs from note files. Currently returns sample data.
   */
  const generateFlashcardsFromNotes = useCallback(
    (_files: string[]): FlashcardDeck => {
      console.info("[Flashcards] generateFlashcardsFromNotes() is stubbed — returning sample data")
      const deck: FlashcardDeck = {
        id: generateId("deck"),
        name: "Generated Deck",
        cards: SAMPLE_CARDS.map((c) => ({ ...c, id: generateId("card") })),
        createdAt: new Date().toISOString(),
      }
      setDecks((prev) => {
        const updated = [...prev, deck]
        persist(updated)
        return updated
      })
      setActiveDeckId(deck.id)
      setCurrentCardIndex(0)
      setIsFlipped(false)
      return deck
    },
    [persist]
  )

  const selectDeck = useCallback((deckId: string) => {
    setActiveDeckId(deckId)
    setCurrentCardIndex(0)
    setIsFlipped(false)
  }, [])

  return {
    decks,
    activeDeck,
    activeDeckId,
    currentCard,
    currentCardIndex,
    isFlipped,
    isLoaded,
    selectDeck,
    createDeck,
    deleteDeck,
    addCard,
    nextCard,
    prevCard,
    flipCard,
    shuffleDeck,
    generateFlashcardsFromNotes,
  }
}
