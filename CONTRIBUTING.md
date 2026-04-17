# Contributing to ClodCount

Thank you for your interest in contributing! This document covers everything you need to know to submit changes efficiently.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Branch Conventions](#branch-conventions)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Areas That Need Help](#areas-that-need-help)

---

## Code of Conduct

Be respectful, constructive, and collaborative. Contributors are expected to maintain a friendly, welcoming environment for everyone.

---

## How to Contribute

1. **Fork** this repository
2. **Clone** your fork locally
3. **Create a branch** following the naming convention below
4. **Make your changes** — keep them focused and minimal
5. **Test** the extension locally in Chrome (Developer Mode)
6. **Submit a Pull Request** to the `main` branch

---

## Development Setup

### Load the extension in Chrome

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/ClodCount.git
cd ClodCount

# 2. Open Chrome and navigate to:
#    chrome://extensions
# 3. Enable "Developer mode" (top-right toggle)
# 4. Click "Load unpacked" → select the ClodCount folder
# 5. Open https://claude.ai — the widget appears bottom-right
```

### Regenerating Icons

**If Node.js is available:**
```bash
node scripts/generate_icons.js
```

**If not (PowerShell fallback):**
Open `scripts/generate_icons.html` in Chrome and download from there.

---

## Branch Conventions

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/cjk-tokenizer-improvement` |
| Bug fix | `fix/<short-description>` | `fix/spa-reinject-widget` |
| Refactor | `refactor/<description>` | `refactor/content-script-cleanup` |
| Docs | `docs/<description>` | `docs/update-readme` |
| Chore | `chore/<description>` | `chore/update-manifest-version` |

---

## Commit Message Format

Follow the **Conventional Commits** format:

```
<type>(<scope>): <short summary>

[optional body — explain the WHY, not the WHAT]

[optional footer: closes #<issue-number>]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `style`, `chore`, `test`

**Examples:**
```
feat(tokenizer): add CJK per-segment multiplier

fix(content): re-attach listeners after SPA navigation

docs(readme): add custom limit instructions

chore(manifest): bump version to 1.1.0
```

---

## Pull Request Process

1. **Target branch**: always target `main`
2. **Title**: use the same format as commit messages
3. **Description**: fill out the PR template — what, why, and how to test
4. **One concern per PR** — split unrelated changes into separate PRs
5. **Screenshots** for any UI changes — before and after
6. A maintainer will review within a few days

### PR Checklist

- [ ] Extension loads without errors in `chrome://extensions`
- [ ] Widget appears on `claude.ai` and updates on input
- [ ] No console errors in the background or content script
- [ ] Light and dark modes both work correctly
- [ ] Drag, collapse, and popup settings work
- [ ] Code follows the existing style (`'use strict'`, named functions, clear comments)

---

## Reporting Bugs

Open an [Issue](https://github.com/yourusername/ClodCount/issues) with the label `bug` and include:

- Chrome version
- Extension version (shown in `chrome://extensions`)
- Steps to reproduce
- Expected vs. actual behavior
- Console errors (open DevTools → check both the page console and the background service worker)

---

## Suggesting Features

Open an [Issue](https://github.com/yourusername/ClodCount/issues) with the label `enhancement` and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

Check the [roadmap in README.md](README.md#roadmap) first — it may already be planned.

---

## Areas That Need Help

These are open areas where contributions are especially welcome:

| Area | Description |
|---|---|
| **Selector robustness** | Claude.ai's DOM changes frequently — more resilient input selectors needed |
| **Tokenizer accuracy** | Improve multipliers or detect more edge cases (markdown, URLs, numbers) |
| **Prompt optimization hints** | V1.5 feature — detect repetition, redundant phrases |
| **Automated tests** | Unit tests for `tokenizer.js` using a test runner |
| **Firefox port** | Adapt for `browser.*` API compatibility |
| **Accessibility** | Keyboard navigation and screen reader support for the widget |
| **i18n** | Internationalization for non-English popup text |

---

## Questions?

Open a [Discussion](https://github.com/yourusername/ClodCount/discussions) or file an issue with the label `question`.

---

*Thank you for helping make ClodCount better!*
