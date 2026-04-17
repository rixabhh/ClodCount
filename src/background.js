/**
 * ClodCount — Background Service Worker
 * Handles preference persistence and message relay.
 */

'use strict';

// ─── Default Preferences ─────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  selectedModel: 'claude-sonnet-4-5',
  customLimit: null,           // null = use model default
  widgetPosition: { bottom: 24, right: 20 },
  collapsed: false,
};

const MODELS = {
  'claude-opus-4-5':   { label: 'Claude Opus 4.5',    limit: 200000 },
  'claude-sonnet-4-5': { label: 'Claude Sonnet 4.5',  limit: 200000 },
  'claude-haiku-3-5':  { label: 'Claude Haiku 3.5',   limit: 200000 },
};

// ─── Install / Startup ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_PREFS, (stored) => {
    // Only set keys that don't already exist
    const toSet = {};
    for (const [key, val] of Object.entries(DEFAULT_PREFS)) {
      if (!(key in stored)) toSet[key] = val;
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.sync.set(toSet);
    }
  });
});

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // GET_PREFS — content script or popup requests current preferences
  if (msg.type === 'GET_PREFS') {
    chrome.storage.sync.get(DEFAULT_PREFS, (prefs) => {
      // Resolve effective limit
      const model = MODELS[prefs.selectedModel] || MODELS['claude-sonnet-4-5'];
      prefs.effectiveLimit = prefs.customLimit && prefs.customLimit > 0
        ? prefs.customLimit
        : model.limit;
      prefs.modelLabel = model.label;
      prefs.models = MODELS;
      sendResponse({ ok: true, prefs });
    });
    return true; // keep channel open for async
  }

  // SET_PREFS — popup updates settings
  if (msg.type === 'SET_PREFS') {
    chrome.storage.sync.set(msg.prefs, () => {
      sendResponse({ ok: true });
      // Notify all claude.ai tabs to refresh
      notifyClaudeTabs();
    });
    return true;
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Send PREFS_UPDATED to all active claude.ai tabs so content script refreshes.
 */
function notifyClaudeTabs() {
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'PREFS_UPDATED' }).catch(() => {
        // Tab may not have content script yet — ignore
      });
    }
  });
}
