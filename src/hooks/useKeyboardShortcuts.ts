import { useEffect } from "react";

interface ShortcutHandlers {
    onSave?: () => void;
    onSaveAll?: () => void;
    onOpenFolder?: () => void;
    onToggleLeftPanel?: () => void;
    onToggleRightPanel?: () => void;
    onToggleShortcutOverlay?: () => void;
    onOpenPomodoro?: () => void;
    onToggleFocusMode?: () => void;
    onOpenSettings?: () => void;
    onOpenSearch?: () => void;
    onToggleMarkdownPreview?: () => void;
    onToggleGraphView?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
    useEffect(() => {
        let focusModeChordActive = false;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            // Note: Ctrl+S and Ctrl+Shift+S are already handled in useEditorController
            // but we can add them here if we want a global fallback or let editor handle them.
            // For now, let's keep Editor shortcuts in useEditorController for active file specificity.

            if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                handlers.onOpenFolder?.();
            }

            if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                handlers.onToggleLeftPanel?.();
            }

            if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                handlers.onToggleRightPanel?.();
            }

            if (isCtrl && (e.key === '?' || e.key === '/')) {
                e.preventDefault();
                handlers.onToggleShortcutOverlay?.();
            }

            // Ctrl+Alt+P -> Pomodoro
            if (isCtrl && e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                handlers.onOpenPomodoro?.();
            }

            // Ctrl+F -> Start focus mode chord
            if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                focusModeChordActive = true;
                return;
            }

            // M key after Ctrl+F -> Focus Mode
            if (focusModeChordActive && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                focusModeChordActive = false;
                handlers.onToggleFocusMode?.();
                return;
            }

            // Any other key after Ctrl+F -> Cancel chord
            if (focusModeChordActive) {
                focusModeChordActive = false;
            }

            // Ctrl+Shift+F -> Open Search
            if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                handlers.onOpenSearch?.();
            }

            // Ctrl+, -> Settings
            if (isCtrl && !e.shiftKey && e.key === ',') {
                e.preventDefault();
                handlers.onOpenSettings?.();
            }

            // Ctrl+M -> Toggle Markdown Preview
            if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                handlers.onToggleMarkdownPreview?.();
            }

            // Ctrl+G -> Toggle Knowledge Graph view
            if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                handlers.onToggleGraphView?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers]);
}
