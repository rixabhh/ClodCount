# Changelog

All notable changes to ClodCount are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-04-17

### Added
- Real-time token estimation for claude.ai input as you type, paste, or undo
- Two-section floating widget: INPUT TOKENS and CONTEXT USED with progress bars
- Color-coded status: safe (green) → warning (amber ≥75%) → danger (red ≥90%)
- Smart heuristic tokenizer with per-segment multipliers:
  - Latin/English: `chars ÷ 4`
  - CJK (Chinese/Japanese/Korean): `chars ÷ 2`
  - Code blocks (backtick-fenced): `chars ÷ 3.5`
  - Emoji: `1 token per emoji` (Unicode property escapes)
  - System buffer: constant +1,000 tokens
- Conversation history estimation (last 20 human-turn messages)
- Model selector popup: Claude Opus 4.5, Sonnet 4.5, Haiku 3.5
- Custom context limit override via popup settings
- Auto light/dark mode (reads claude.ai's native `.dark` class on `<html>`)
- Draggable widget — position persisted in `chrome.storage.sync`
- Collapsible widget — state persisted across sessions
- SPA resilience via `MutationObserver` on `document.body`
- Double-injection guard (`window.__clodCountInitialized`)
- Preference sync between popup and content script via background service worker
- Debounced updates (320ms) to avoid performance impact during rapid typing
- Manifest V3 compliant

---

## Upcoming

### [1.5.0] — Planned
- Prompt optimization hints (repetition and verbosity detection)
- Token breakdown: input vs. history split
- Per-session token usage graph

### [2.0.0] — Planned
- Cross-platform support (ChatGPT, Gemini)
- Advanced prompt compression suggestions
- Export/share optimized prompts
