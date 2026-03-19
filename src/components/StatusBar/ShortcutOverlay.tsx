import { useEffect } from 'react';
import './ShortcutOverlay.css';

interface ShortcutOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ShortcutOverlay({ isOpen, onClose }: ShortcutOverlayProps) {
    // Close on escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const shortcuts = [
        { key: 'Ctrl + S', description: 'Save current file' },
        { key: 'Ctrl + Shift + S', description: 'Save all files' },
        { key: 'Ctrl + O', description: 'Open workspace folder' },
        { key: 'Ctrl + B', description: 'Toggle Explorer panel' },
        { key: 'Ctrl + J', description: 'Toggle Calendar panel' },
        { key: 'Ctrl + ?', description: 'Show this shortcuts overlay' },
    ];

    return (
        <div className="shortcut-overlay-backdrop" onClick={onClose}>
            <div className="shortcut-overlay-modal" onClick={e => e.stopPropagation()}>
                <div className="shortcut-overlay-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button className="shortcut-overlay-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="shortcut-overlay-grid">
                    {shortcuts.map(s => (
                        <div key={s.key} className="shortcut-item">
                            <span className="shortcut-desc">{s.description}</span>
                            <kbd className="shortcut-key">{s.key}</kbd>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
