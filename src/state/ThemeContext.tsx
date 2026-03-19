import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

export type ThemeType = "midnight" | "dawn" | "forest" | string;

interface CustomTheme {
    name: string;
    vars: Record<string, string>;
}

interface ThemeContextType {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
    customThemes: CustomTheme[];
    applyCustomTheme: (theme: CustomTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeType>(() => {
        return localStorage.getItem("hibiscus:theme") || "midnight";
    });

    const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

    useEffect(() => {
        // Apply theme to document element
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("hibiscus:theme", theme);
    }, [theme]);

    useEffect(() => {
        // Stub for loading custom themes from .hibiscus/themes.json
        // Future Custom Theme Loader implementation
    }, []);

    const setTheme = (newTheme: ThemeType) => {
        // Clear previously applied custom inline variables if any
        document.documentElement.style.cssText = '';
        setThemeState(newTheme);
    };

    const applyCustomTheme = (themeData: CustomTheme) => {
        setTheme(themeData.name);
        Object.entries(themeData.vars).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, customThemes, applyCustomTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
