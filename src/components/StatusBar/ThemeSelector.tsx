import { useState, useRef, useEffect } from "react";
import { useTheme } from "../../state/ThemeContext";
import "./ThemeSelector.css";

const BUILT_IN_THEMES = [
    { id: "midnight", name: "Midnight", color: "#0a0d12" },
    { id: "dawn", name: "Dawn", color: "#f9fafb" },
    { id: "forest", name: "Forest", color: "#09120c" },
];

export function ThemeSelector() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedTheme = BUILT_IN_THEMES.find(t => t.id === theme) || BUILT_IN_THEMES[0];

    return (
        <div className="theme-selector-container" ref={containerRef}>
            <button
                className="theme-selector-btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Change Theme"
            >
                <div
                    className="theme-swatch"
                    style={{ backgroundColor: selectedTheme.color }}
                />
                <span className="theme-name">{selectedTheme.name}</span>
            </button>

            {isOpen && (
                <div className="theme-dropdown">
                    <div className="theme-dropdown-header">Select Theme</div>
                    {BUILT_IN_THEMES.map((t) => (
                        <button
                            key={t.id}
                            className={`theme-option ${theme === t.id ? 'active' : ''}`}
                            onClick={() => {
                                setTheme(t.id);
                                setIsOpen(false);
                            }}
                        >
                            <div
                                className="theme-swatch"
                                style={{ backgroundColor: t.color, border: t.id === 'dawn' ? '1px solid #ccc' : 'none' }}
                            />
                            {t.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
