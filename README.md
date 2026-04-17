# ClodCount

<div align="center">

**Real-time Claude token usage estimator — know your context window before you send.**

[![Version](https://img.shields.io/badge/version-1.0.0-d97757?style=flat-square)](https://github.com/yourusername/ClodCount/releases)
[![License](https://img.shields.io/badge/license-MIT-d97757?style=flat-square)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-d97757?style=flat-square)](manifest.json)
[![Browser](https://img.shields.io/badge/Chrome-Extension-d97757?style=flat-square)](https://chrome.google.com/webstore)

</div>

---

ClodCount is a lightweight Chrome Extension that injects a floating token-counter widget into [claude.ai](https://claude.ai). It estimates token usage in real-time as you type — showing input tokens, total context consumption, and remaining budget — all client-side, zero servers.

---

## Features

- **Real-time token estimation** — updates as you type, paste, or undo/redo (debounced 320ms)
- **Two-section display** — INPUT TOKENS and CONTEXT USED, each with a progress bar and sub-text
- **Color-coded status** — green (safe) → amber (≥75%) → red (≥90%)
- **Smart tokenizer** — separate multipliers for Latin, CJK, code blocks, and emoji
- **History-aware** — estimates include the last 20 messages from your conversation history
- **Model selector** — Opus, Sonnet, Haiku (all 200k context) via the popup
- **Custom context limit** — override the default with any value you choose
- **Auto light/dark mode** — reads claude.ai's native `.dark` class on `<html>`
- **Draggable & collapsible** — position persisted across sessions via `chrome.storage.sync`
- **SPA resilient** — `MutationObserver` re-attaches on every navigation

---

## Design

ClodCount matches **claude.ai's exact design language** — the same warm earthy palette, Inter font, 16px border-radius, and card shadow used natively. Both light and dark modes are supported automatically.

| Token | Light Mode | Dark Mode |
|---|---|---|
| Card background | `#ffffff` | `#2a2826` |
| Accent (progress bar) | `#d97757` | `#d97757` |
| Text primary | `#1a1a18` | `#f0ece6` |

---

## Token Estimation Algorithm

```
Latin / English  →  characters ÷ 4
CJK              →  characters ÷ 2
Code blocks      →  characters ÷ 3.5  (extracted first via regex)
Emoji            →  1 token per emoji  (Unicode property escapes)
System buffer    →  +1,000 tokens      (always added to total)
History          →  last 20 human-turn messages, summed
```

> Accuracy: approximately **±15–25%**. Displayed disclaimer keeps expectations honest.

---

## Installation (Developer Mode)

1. **Download or clone** this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `ClodCount` folder
5. Navigate to `https://claude.ai` — the widget appears bottom-right

---

## File Structure

```
ClodCount/
├── manifest.json          # MV3 — permissions, scripts, popup
├── src/
│   ├── tokenizer.js       # Token estimation engine (pure, zero DOM)
│   ├── content.js         # Widget injection, events, MutationObserver
│   ├── background.js      # Service worker — chrome.storage.sync
│   ├── widget.css         # Floating widget styles
│   ├── popup.html         # Settings popup markup
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── scripts/
    ├── generate_icons.js  # Node.js zero-dep PNG generator
    └── generate_icons.html # Browser canvas icon downloader
```

---

## Privacy

- **All processing is local** — no data leaves your browser
- **No external servers** — zero network requests
- **No tracking, no analytics**
- Only permissions used: `storage` (save preferences), `activeTab`, `tabs` (notify tab on settings change)

---

## Roadmap

### v1.5
- [ ] Prompt optimization hints (repetition detection, length warnings)
- [ ] Token breakdown: input vs. conversation history

### v2.0
- [ ] Cross-platform support (ChatGPT, Gemini)
- [ ] Advanced prompt compression suggestions

### v3.0
- [ ] AI-assisted prompt rewriting
- [ ] Real token count via API (when/if available)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, branch conventions, and how to submit a pull request.

---

## License

[MIT](LICENSE) © 2026 ClodCount Contributors
