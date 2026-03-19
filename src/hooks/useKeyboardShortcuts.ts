import { useEffect } from "react";

interface ShortcutHandlers {
    onSave?: () => void;
    onSaveAll?: () => void;
    onOpenFolder?: () => void;
    onToggleLeftPanel?: () => void;
    onToggleRightPanel?: () => void;
    onToggleShortcutOverlay?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
    useEffect(() => {
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
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers]);
}
