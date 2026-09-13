# Privacy Policy

**Effective date:** September 13, 2026
**Last updated:** September 13, 2026
**Applies to:** Hibiscus desktop application (all versions)
**Maintainer:** Andrew Fernandes (<write2andrew.fernandes@gmail.com>)
**Source:** <https://github.com/AndyFerns/Hibiscus>

---

## Summary

Hibiscus is a **local-first** application. Everything you do inside Hibiscus - your notes, files, calendar events, tasks, flashcards, study statistics, indexed knowledge, workspace layout, and theme preferences - is stored **only on your own device**, inside your workspace folder and its `.hibiscus/` subdirectory.

We do not run servers for Hibiscus. We do not have accounts. We do not have telemetry, analytics, crash reporting, ads, tracking pixels, or any background phone-home. If Hibiscus disappears tomorrow, **your data and notes stay exactly where they are** - plain files on your disk, readable and editable with any text editor.

If a sentence in this policy ever conflicts with that principle, the principle wins and the sentence is a bug - please open an issue.

---

## 1. What data Hibiscus handles

Hibiscus reads and writes the following kinds of data, **all locally**:

| Category | Where it lives | What it is |
|---|---|---|
| Your documents | The workspace folder you opened | Every `.md`, `.txt`, `.pdf`, `.docx`, image, or other file you create or edit. |
| Workspace state | `<workspace>/.hibiscus/workspace.json` | Which files/tabs were open, pane sizes, active file. |
| Calendar & tasks | `<workspace>/.hibiscus/calendar.json` | Events, tasks, reminders, exam schedule entries. |
| Knowledge index | `<workspace>/.hibiscus/knowledge/` | Derived TF-IDF index, chunks, topic map, graph edges, note metadata. Fully rebuildable from your source files. |
| Backups | `<workspace>/.hibiscus/backups/` | Local backups Hibiscus creates before destructive operations. |
| Study tools | `<workspace>/.hibiscus/` (per-tool JSON) | Pomodoro history, flashcard decks, study statistics. |
| Ignore rules | `<workspace>/.hibiscusignore` | Optional file *you* create to exclude paths from indexing. |
| App preferences | OS-standard app-data directory (Tauri default) | Theme choice, custom themes, recent workspaces list. |

Everything under `.hibiscus/` is derived from or associated with the workspace you opened. Delete the workspace folder and every trace of that workspace's Hibiscus data goes with it. Delete just `.hibiscus/` and Hibiscus will rebuild what it can from your source files on next open.

---

## 2. What Hibiscus does **not** do

- **No accounts.** Hibiscus has no sign-up, no login, no user profile.
- **No servers.** Hibiscus does not run, connect to, or depend on any backend service operated by the maintainers.
- **No telemetry or analytics.** Hibiscus does not send usage statistics, feature-hit counts, session information, error reports, or crash dumps to anyone.
- **No cloud sync.** Hibiscus does not upload your notes, files, calendar, index, or preferences anywhere.
- **No advertising or tracking.** Hibiscus contains no ads, ad SDKs, tracking pixels, fingerprinting, or third-party analytics.
- **No AI upload.** Hibiscus does not send the contents of your files to any language model, embedding API, or third-party service. All indexing, parsing, and search happen locally in the Rust backend.
- **No background network activity.** Hibiscus does not open network connections on its own during normal operation.

If a future feature would require any of the above, it will be **opt-in**, clearly labelled in the UI, and documented in this policy before shipping.

---

## 3. Network activity

The Hibiscus application itself does not make outbound network requests. There are two narrow cases where a network request may occur, and both are triggered by you explicitly:

1. **Opening an external link.** If you click a hyperlink inside a rendered Markdown or DOCX document, the link is handed to your operating system's default handler (browser, mail client, etc.). That handler makes the request, not Hibiscus. Hibiscus does not follow, prefetch, or preview link targets.
2. **Update checks (if enabled).** Some Tauri-packaged builds may check GitHub Releases for a new version when you explicitly ask for an update. This is the standard Tauri updater; the request contains only what is required to fetch a release manifest (Hibiscus version, platform). It contains no document content, no workspace paths, and no identifiers about you. If this ever becomes automatic, it will be opt-in.

Development builds may load resources from `localhost` (the Vite dev server); this is not present in packaged releases.

---

## 4. Third-party components

Hibiscus is built on open-source software. The relevant runtime components are:

- **Tauri v2 / Rust backend** - desktop shell and file system access.
- **React + Monaco Editor** - UI and code editor (frontend).
- **mammoth.js, react-pdf, react-markdown** - client-side document rendering.
- **notify, tokio, pdf-extract, quick-xml, serde** - Rust libraries for file watching, async I/O, parsing.

None of these components are configured to phone home from within Hibiscus. Their behaviour is bounded by the sandbox and by Hibiscus's Tauri capability configuration (`src-tauri/capabilities/`), which restricts what the frontend is allowed to ask the backend to do.

---

## 5. Permissions Hibiscus requests

Hibiscus needs local operating-system permissions to function as a desktop editor:

- **File system access** to the workspace folder you open (read, write, watch for changes).
- **Window management** for the frameless custom window.
- **Clipboard access** for copy/paste in the editor.
- **Open-with / shell** for launching external links via your OS default handler when you click one.

Hibiscus does not request microphone, camera, contacts, location, notifications, or background-execution permissions.

---

## 6. Children's privacy

Hibiscus does not knowingly collect any personal information from anyone, including children. Because Hibiscus stores everything locally and has no accounts, telemetry, or servers, there is no personal information for it to collect or transmit in the first place.

---

## 7. Security

Because your data lives on your device, its security is primarily the security of your device: disk encryption, OS user account, backups. Hibiscus does not encrypt the `.hibiscus/` directory or your workspace files on your behalf - they are stored as ordinary files, deliberately, so that you can read, back up, and recover them without needing Hibiscus.

DOCX documents rendered inside Hibiscus are sanitised (`src/components/Editor/docxSanitizer.ts`) to strip `<script>`, event handlers, and unsafe URI schemes before display. See the changelog for v0.13.2 and the DOCX viewer guide for details.

If you discover a security issue, please report it privately to the maintainer at <write2andrew.fernandes@gmail.com> rather than filing a public issue.

---

## 8. Your data, your control

Because Hibiscus is local-first, the standard "data subject rights" (access, portability, deletion) are things you already have without needing to ask us:

- **Access & portability:** every note is a plain file. Copy the folder.
- **Deletion:** delete the workspace folder, or delete `.hibiscus/` to remove derived data only.
- **Export:** there is nothing proprietary to export from - your notes are already Markdown, your calendar is JSON.

We (the maintainers) do not hold a copy of your data, so we cannot delete, export, or produce it on your behalf. There is nothing for us to hold.

---

## 9. Changes to this policy

If this policy changes, the new version will be committed to this repository with an updated **Last updated** date at the top, and the change will be summarised in the [Changelog](docs/changelog.md). Because there are no accounts and no servers, there is no notification channel other than the repository itself - the file you are reading is the policy.

---

## 10. Contact

Questions, corrections, or concerns about this policy:

- **Maintainer:** Andrew Fernandes - <write2andrew.fernandes@gmail.com>
- **Issues:** <https://github.com/AndyFerns/Hibiscus/issues>

---

*Hibiscus is licensed under the [Mozilla Public License 2.0](LICENSE).*
