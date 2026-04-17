/**
 * ClodCount — Popup Script
 * Reads and writes extension preferences via chrome.storage.sync.
 * Sends PREFS_UPDATED message to active claude.ai tab after saving.
 */

'use strict';

const DEFAULT_PREFS = {
  selectedModel: 'claude-sonnet-4-5',
  customLimit: null,
};

// ─── DOM References ───────────────────────────────────────────────────────────
const modelSelect  = document.getElementById('model-select');
const customLimitInput = document.getElementById('custom-limit');
const resetBtn     = document.getElementById('reset-btn');

// ─── Load Saved Prefs ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ type: 'GET_PREFS' }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) return;
    const prefs = resp.prefs;

    // Set model dropdown
    if (modelSelect && prefs.selectedModel) {
      modelSelect.value = prefs.selectedModel;
    }

    // Set custom limit
    if (customLimitInput && prefs.customLimit) {
      customLimitInput.value = prefs.customLimit;
    }
  });
});

// ─── Model Change ─────────────────────────────────────────────────────────────
if (modelSelect) {
  modelSelect.addEventListener('change', () => {
    savePrefs({ selectedModel: modelSelect.value });
  });
}

// ─── Custom Limit Change ──────────────────────────────────────────────────────
if (customLimitInput) {
  customLimitInput.addEventListener('blur', () => {
    const raw = parseInt(customLimitInput.value, 10);
    const val = (!isNaN(raw) && raw >= 1000) ? raw : null;
    if (val === null) customLimitInput.value = '';
    savePrefs({ customLimit: val });
  });

  // Allow clearing with delete/backspace without triggering on each keypress
  customLimitInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') customLimitInput.blur();
  });
}

// ─── Reset ────────────────────────────────────────────────────────────────────
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (modelSelect)      modelSelect.value = DEFAULT_PREFS.selectedModel;
    if (customLimitInput) customLimitInput.value = '';
    savePrefs({ selectedModel: DEFAULT_PREFS.selectedModel, customLimit: null });

    // Brief visual feedback
    resetBtn.textContent = '✓ Reset';
    setTimeout(() => { resetBtn.textContent = 'Reset to Defaults'; }, 1200);
  });
}

// ─── Save Helper ──────────────────────────────────────────────────────────────
function savePrefs(partialPrefs) {
  chrome.runtime.sendMessage({ type: 'SET_PREFS', prefs: partialPrefs }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[ClodCount] Failed to save prefs:', chrome.runtime.lastError.message);
    }
  });
}
