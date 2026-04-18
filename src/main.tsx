/**
 * ============================================================================
 * Main Entry Point
 * ============================================================================
 * 
 * Application bootstrap file that mounts the React app to the DOM.
 * 
 * IMPORT ORDER MATTERS:
 * 1. theme.css - Design tokens (must be first for CSS variable availability)
 * 2. React and core libraries
 * 3. App component
 *
 * NOTE: ThemeProvider has been moved inside App.tsx (v0.5.0) so it can
 * receive workspaceRoot for backend theme persistence. This file only
 * handles the initial mount.
 * ============================================================================
 */

// Global design system - must be imported first
import "./styles/theme.css";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Mount the React application
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
