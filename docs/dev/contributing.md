# Contributing to Hibiscus

First off, thank you for considering contributing to Hibiscus! It's people like you that make Hibiscus such a great study planner and editor.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** it to your local machine.
3. Install frontend dependencies `npm install`.
4. Run the development server: `node scripts/hibiscus.cjs dev`.

## How to Contribute

### 1. Reporting Bugs
- Ensure the bug was not already reported by searching on GitHub under Issues.
- If you're unable to find an open issue addressing the problem, open a new one. Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### 2. Suggesting Enhancements
- Open a new issue with a clear description of the enhancement.
- Explain why this enhancement would be useful to most users.

### 3. Pull Requests
- Create a new branch for your feature/fix from `main`: `git checkout -b feature/my-new-feature` or `git checkout -b fix/issue-name`.
- Make your changes in the codebase.
- **Run Tests**: Ensure your changes don't break existing functionality. Run `node scripts/hibiscus.cjs test`.
- Submissions must adhere to our [Architecture Guidelines](architecture.md).
- Push your branch to GitHub and submit a Pull Request.

## Code Style Guide

- **TypeScript / React**:
  - We use standard ES6 syntax and React Hooks natively (no Class components).
  - Use `React.memo` where appropriate for heavy renders (e.g., `TreeView`).
  - Favor functional logic and explicitly declare return types.
- **Rust (Tauri Backend)**:
  - Format using `cargo fmt`.
  - Use standard `Result<T, HibiscusError>` for any custom commands passed to `--invoke`.

Thank you for your contributions!
