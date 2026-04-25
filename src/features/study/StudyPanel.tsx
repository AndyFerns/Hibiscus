import { useState } from "react"
import { FlashcardPanel } from "../flashcards/FlashcardPanel"
import { NotesSynthesizer } from "../notes/NotesSynthesizer"
import type { useFlashcards } from "../flashcards/useFlashcards"
import type { useNotesSynthesis } from "../notes/useNotesSynthesis"
import "./StudyPanel.css"

interface StudyPanelProps {
    flashcards: ReturnType<typeof useFlashcards>
    notes: ReturnType<typeof useNotesSynthesis>
}

export function StudyPanel({ flashcards, notes }: StudyPanelProps) {
    const [activeTab, setActiveTab] = useState<"notes" | "flashcards">("notes")

    return (
        <div className="study-panel">
            {/* Tab navigation */}
            <div className="study-panel-tabs">
                <button
                    className={`study-tab ${activeTab === "notes" ? "active" : ""}`}
                    onClick={() => setActiveTab("notes")}
                >
                    Notes
                </button>
                <button
                    className={`study-tab ${activeTab === "flashcards" ? "active" : ""}`}
                    onClick={() => setActiveTab("flashcards")}
                >
                    Flashcards
                </button>
            </div>

            {/* Content */}
            <div className="study-panel-content">
                {activeTab === "notes" && <NotesSynthesizer notes={notes} />}
                {activeTab === "flashcards" && <FlashcardPanel flashcards={flashcards} />}
            </div>
        </div>
    )
}
