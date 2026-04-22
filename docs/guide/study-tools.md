# Study Tools System

Hibiscus isn't just an editor; it's a complete workspace for deep work and productivity. To support this, Hibiscus includes a suite of integrated Study Tools designed to keep you focused and organized without ever leaving your application.

All study tools live in the **Right Panel**, which can seamlessly toggle between the Calendar Planner and your chosen study view using the tab bar at the top or via keyboard shortcuts.

---

## 🎯 Focus Mode

**Shortcut**: `Ctrl+Shift+F` (or `View > Tools > Focus Mode`)

Focus Mode is a global state that helps eliminate distractions. When activated, Hibiscus automatically collapses the Explorer (left panel) and expands the main editor area to consume more screen real estate, letting you hone in on your active markdown or code.

- Focus Mode pairs perfectly with the Pomodoro Timer, and can be configured to activate automatically when a timer starts (via Settings).
- A **"🔍 Focus"** indicator will appear in the bottom-left status bar when active.

---

## ⏱️ Pomodoro Timer

**Shortcut**: `Ctrl+Alt+P`

The Pomodoro technique is built natively into Hibiscus to help you pace your study sessions (Work → Break → Work → Long Break).

### Features

- **Right Panel View**: Provides a large, clean SVG arc visualizing the timer, the current phase, session counts, and full controls (Start, Pause, Reset, Skip).
- **Status Bar Mini Timer**: When the timer is running, a compact progress ring and countdown automatically appear in the bottom-right status bar. You can click this widget to instantly open the Pomodoro Panel.
- **Desktop Notifications**: Hibiscus sends native desktop notifications when phases end (e.g., "Break Time! ☕" or "Back to Work! 📚").

### Configuration

You can configure interval durations (Work, Short Break, Long Break) and behaviors inside the Settings menu (`Ctrl+,`).

---

## 📊 Study Statistics

**Shortcut**: `View > Tools > Study Statistics`

Every Pomodoro cycle you complete is logged natively by the Rust backend into `.hibiscus/study/stats.json`. The Statistics dashboard helps you track your progress over time without relying on external bloat.

### Metrics Tracked

- **Total Time**: Sum of all recorded sessions.
- **Sessions**: The total count of completed work intervals.
- **Streak**: Your current run of consecutive days with at least one logged session.
- **Avg/Day**: Your average daily study time across active days in the last month.

The dashboard includes a beautiful, native SVG bar chart illustrating your activity over the past 7 days, as well as a list of your most recent sessions.

---

## 🃏 Flashcards Deck

**Shortcut**: `Ctrl+Alt+F`

The Flashcards tool provides a minimalist, interactive way to review definitions, code snippets, or notes.

- **Card Input**: Supports any plaintext or markdown.
- **Interaction**: Features a smooth 3D CSS flip animation. Click the card, use the arrow keys to navigate, or press `Space` to flip.
- **Management**: You can add new cards manually and shuffle the active deck. Data is persisted to `.hibiscus/study/flashcards.json`.

---

## 📝 Notes Synthesis

**Shortcut**: `Ctrl+Alt+N`

Notes Synthesis is a local document combination utility. It solves the common problem of having scattered knowledge across multiple markdown and text files.

### How it works

1. **Select Files**: Add `.txt` or `.md` files from your workspace by browsing or dragging them.
2. **Synthesize**: Hibiscus reads the files natively, strips out redundant H1 headings, and merges the text under a cohesive master document.
3. **Save Output**: Instantly save the parsed preview as a new markdown document into your workspace root.

*(Note: `.pdf` and `.docx` parsing are stubbed for future deep native integrations.)*

---

## ⚙️ Settings

**Shortcut**: `Ctrl+,` (or `View > Tools > Settings`)

Hibiscus handles preferences instantly via a dual-persistence strategy (updating the UI via instant local caching, while safely storing state to the backend `settings.json`).

Inside the Settings Modal you can customize:

- `General`: Toggling behavior such as Focus Mode hiding the Explorer.
- `Pomodoro`: Custom interval lengths and auto-start behaviors.
