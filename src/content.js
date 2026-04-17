/**
 * ClodCount — Content Script
 * Injected into claude.ai. Orchestrates widget injection, input capture,
 * MutationObserver for SPA navigation, and real-time token estimation updates.
 *
 * Dependencies (injected before this file via manifest content_scripts order):
 *   - tokenizer.js → window.__ccTokenizer
 */

'use strict';

// ─── Guard: Prevent double injection ─────────────────────────────────────────
if (window.__clodCountInitialized) {
  // Already running — exit silently
} else {
  window.__clodCountInitialized = true;

  // ─── State ───────────────────────────────────────────────────────────────
  let prefs = {
    selectedModel: 'claude-sonnet-4-5',
    effectiveLimit: 200000,
    modelLabel: 'Claude Sonnet 4.5',
    widgetPosition: { bottom: 24, right: 20 },
    collapsed: false,
  };

  let updateTimer     = null;
  let observerRef     = null;
  let inputEl         = null;
  let widgetEl        = null;
  let isDragging      = false;
  let dragOffsetX     = 0;
  let dragOffsetY     = 0;

  const { estimateTokens, estimateHistory, getTotalContext, getStatus } = window.__ccTokenizer;

  // ─── Selectors for Claude's input box ────────────────────────────────────
  // Ordered by specificity — most reliable first
  const INPUT_SELECTORS = [
    '[data-testid="chat-input"]',
    'div[contenteditable="true"][translate="no"]',
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    'textarea',
  ];

  // Selectors for past human messages in the conversation
  const HISTORY_SELECTORS = [
    '[data-testid="human-turn-content"]',
    '[data-testid="user-message"]',
    '.human-turn',
    'div[data-message-author-role="user"]',
  ];

  // ─── Initialization ───────────────────────────────────────────────────────

  async function init() {
    await loadPreferences();
    injectBridge();
    injectWidget();
    attachInputListeners();
    startMutationObserver();
    listenForUsage();
    fetchInitialUsage();
    runUpdate();
  }

  // ─── Bridge & Usage Integration ──────────────────────────────────────────

  function injectBridge() {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('src/bridge.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  let usageCache = { fiveHrPct: 0, sevenDayPct: 0, fiveHrReset: '', sevenDayReset: '' };

  function setUsageDataFromSSE(payload) {
    if (!payload?.windows) return;
    const w5 = payload.windows['5h'];
    const w7 = payload.windows['7d'];
    if (w5 && typeof w5.utilization === 'number') {
      usageCache.fiveHrPct = Math.max(0, Math.min(100, w5.utilization * 100));
      if (w5.resets_at) {
        usageCache.fiveHrReset = new Date(w5.resets_at * 1000).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
      }
    }
    if (w7 && typeof w7.utilization === 'number') {
      usageCache.sevenDayPct = Math.max(0, Math.min(100, w7.utilization * 100));
      if (w7.resets_at) {
        // usually show Day/Time for 7-day
        usageCache.sevenDayReset = new Date(w7.resets_at * 1000).toLocaleDateString([], {weekday: 'short', hour: 'numeric', minute:'2-digit'});
      }
    }
    updateWidgetUsageBars();
  }

  function listenForUsage() {
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || event.data.cc !== 'ClodCountBridge') return;
      if (event.data.type === 'cc:message_limit') {
        setUsageDataFromSSE(event.data.payload);
      }
    });
  }

  function getOrgIdFromCookie() {
    try {
      return document.cookie.split('; ').find(r => r.startsWith('lastActiveOrg='))?.split('=')[1] || null;
    } catch { return null; }
  }

  async function fetchInitialUsage() {
    const orgId = getOrgIdFromCookie();
    if (!orgId) return;
    try {
      const res = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, { credentials: 'include' });
      const raw = await res.json();
      if (raw) {
        if (raw.five_hour && typeof raw.five_hour.utilization === 'number') {
          usageCache.fiveHrPct = Math.max(0, Math.min(100, raw.five_hour.utilization)); // already 0-100 here
          if (raw.five_hour.resets_at) {
             usageCache.fiveHrReset = new Date(raw.five_hour.resets_at).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
          }
        }
        if (raw.seven_day && typeof raw.seven_day.utilization === 'number') {
          usageCache.sevenDayPct = Math.max(0, Math.min(100, raw.seven_day.utilization));
          if (raw.seven_day.resets_at) {
             usageCache.sevenDayReset = new Date(raw.seven_day.resets_at).toLocaleDateString([], {weekday: 'short', hour: 'numeric', minute:'2-digit'});
          }
        }
        updateWidgetUsageBars();
      }
    } catch (e) {
      // safe fail
    }
  }

  function updateWidgetUsageBars() {
    const w5Pct = document.getElementById('cc-use-5hr-pct');
    const w5Bar = document.getElementById('cc-use-5hr-bar');
    const w5Sub = document.getElementById('cc-use-5hr-sub');
    if (w5Pct && w5Bar && w5Sub) {
      w5Pct.textContent = usageCache.fiveHrPct.toFixed(0) + '%';
      w5Sub.textContent = usageCache.fiveHrReset ? \`Resets \${usageCache.fiveHrReset}\` : 'Active';
      setBar(w5Bar, usageCache.fiveHrPct);
    }
    
    // We update 7day when UI exists...
    const w7Pct = document.getElementById('cc-use-7day-pct');
    const w7Bar = document.getElementById('cc-use-7day-bar');
    const w7Sub = document.getElementById('cc-use-7day-sub');
    if (w7Pct && w7Bar && w7Sub) {
      w7Pct.textContent = usageCache.sevenDayPct.toFixed(0) + '%';
      w7Sub.textContent = usageCache.sevenDayReset ? \`Resets \${usageCache.sevenDayReset}\` : 'Active';
      setBar(w7Bar, usageCache.sevenDayPct);
    }
  }

  // ─── Preference Loading ───────────────────────────────────────────────────

  function loadPreferences() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PREFS' }, (resp) => {
        if (chrome.runtime.lastError) { resolve(); return; }
        if (resp && resp.ok) {
          prefs = { ...prefs, ...resp.prefs };
        }
        resolve();
      });
    });
  }

  // ─── Widget Injection ─────────────────────────────────────────────────────

  function injectWidget() {
    if (document.getElementById('clodcount-widget')) return;

    // Inject stylesheet
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = chrome.runtime.getURL('src/widget.css');
    document.head.appendChild(link);

    // Build widget DOM
    const widget = document.createElement('div');
    widget.id = 'clodcount-widget';

    widget.innerHTML = `
      <div id="clodcount-drag-handle" title="Drag to move"></div>
      <div id="clodcount-body">

        <div class="cc-section">
          <div class="cc-section-header">
            <span class="cc-icon">↗</span>
            <span class="cc-label">INPUT TOKENS <span class="cc-help-icon" title="Tokens consumed by your current message box">[?]</span></span>
            <span class="cc-pct" id="cc-input-pct">0%</span>
          </div>
          <div class="cc-bar-track">
            <div class="cc-bar-fill" id="cc-input-bar"></div>
          </div>
          <div class="cc-sub" id="cc-input-sub">0 / ${fmtNum(prefs.effectiveLimit)} tokens</div>
        </div>

        <div class="cc-section">
          <div class="cc-section-header">
            <span class="cc-icon">◎</span>
            <span class="cc-label">CONTEXT USED <span class="cc-help-icon" title="Total accumulated tokens in this chat history">[?]</span></span>
            <span class="cc-pct" id="cc-ctx-pct">0%</span>
          </div>
          <div class="cc-split" id="cc-split">
            <span id="cc-split-in" title="Tokens in your current prompt">Prompt: 0</span>
            <span id="cc-split-hist" title="Tokens consumed by past conversation memory">Memory: 0</span>
          </div>
          <div class="cc-bar-track">
            <div class="cc-bar-fill" id="cc-ctx-bar"></div>
          </div>
          <div class="cc-sub" id="cc-ctx-sub">Remaining: ~${fmtNum(prefs.effectiveLimit)}</div>
        </div>

        <div class="cc-divider"></div>

        <div class="cc-section">
          <div class="cc-section-header">
            <span class="cc-icon">⏱</span>
            <span class="cc-label">5-HOUR <span class="cc-help-icon" title="Claude's strict 5-hour rolling message limit">[?]</span></span>
            <span class="cc-pct" id="cc-use-5hr-pct">0%</span>
          </div>
          <div class="cc-bar-track">
            <div class="cc-bar-fill" id="cc-use-5hr-bar"></div>
          </div>
          <div class="cc-sub" id="cc-use-5hr-sub">Loading...</div>
        </div>

        <div class="cc-section">
          <div class="cc-section-header">
            <span class="cc-icon">📅</span>
            <span class="cc-label">7-DAY <span class="cc-help-icon" title="Claude's long-term 7-day rolling limit threshold">[?]</span></span>
            <span class="cc-pct" id="cc-use-7day-pct">0%</span>
          </div>
          <div class="cc-bar-track">
            <div class="cc-bar-fill" id="cc-use-7day-bar"></div>
          </div>
          <div class="cc-sub" id="cc-use-7day-sub">Loading...</div>
        </div>

      </div>

      <div id="cc-hints-container"></div>

      <div id="cc-footer">
        <span id="cc-status">● Safe</span>
        <button id="cc-collapse-btn" title="Collapse / Expand">‹</button>
      </div>

      <div id="cc-disclaimer">~±20% estimate · <span id="cc-model-name">${prefs.modelLabel}</span></div>
    `;

    document.body.appendChild(widget);
    widgetEl = widget;

    // Apply theme
    applyTheme();

    // Apply saved position
    if (prefs.widgetPosition) {
      widget.style.bottom = prefs.widgetPosition.bottom + 'px';
      widget.style.right  = prefs.widgetPosition.right  + 'px';
    }

    // Apply collapsed state
    if (prefs.collapsed) setCollapsed(true, false);

    // Wire up interactions
    setupDragging();
    setupCollapseButton();
  }

  // ─── Theme Detection ──────────────────────────────────────────────────────

  function applyTheme() {
    if (!widgetEl) return;
    const isDark =
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    widgetEl.classList.toggle('cc-dark', isDark);
  }

  // Watch for theme changes on html element
  function watchTheme() {
    const htmlEl = document.documentElement;
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(htmlEl, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  }

  // ─── Input Detection ──────────────────────────────────────────────────────

  function findInputElement() {
    for (const sel of INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getInputText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA') return el.value || '';
    return el.innerText || el.textContent || '';
  }

  // ─── History Scanning ─────────────────────────────────────────────────────

  function getHistoryMessages() {
    for (const sel of HISTORY_SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        return Array.from(els).map((el) => el.innerText || el.textContent || '');
      }
    }
    return [];
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────

  function attachInputListeners() {
    const el = findInputElement();
    if (!el || el === inputEl) return; // already attached

    // Detach from previous
    if (inputEl) {
      inputEl.removeEventListener('input',  onInputChange);
      inputEl.removeEventListener('paste',  onInputChange);
      inputEl.removeEventListener('keyup',  onKeyUp);
    }

    inputEl = el;
    inputEl.addEventListener('input',  onInputChange);
    inputEl.addEventListener('paste',  onInputChange);
    inputEl.addEventListener('keyup',  onKeyUp);
  }

  function onInputChange() {
    scheduleUpdate();
  }

  function onKeyUp(e) {
    // Catch undo (Ctrl+Z) / redo (Ctrl+Y / Ctrl+Shift+Z)
    if (e.ctrlKey || e.metaKey) {
      scheduleUpdate();
    }
  }

  // ─── Debounced Update ─────────────────────────────────────────────────────

  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(runUpdate, 320);
  }

  function runUpdate() {
    const text         = getInputText(inputEl || findInputElement());
    const history      = getHistoryMessages();

    const inputTokens  = estimateTokens(text);
    const histTokens   = estimateHistory(history);
    const totalTokens  = getTotalContext(inputTokens, histTokens);
    const limit        = prefs.effectiveLimit || 200000;

    const inputPct     = Math.min(100, (inputTokens  / limit) * 100);
    const ctxPct       = Math.min(100, (totalTokens  / limit) * 100);
    const remaining    = Math.max(0, limit - totalTokens);
    const status       = getStatus(ctxPct);
    const hints        = window.__ccTokenizer.analyzePrompt ? window.__ccTokenizer.analyzePrompt(text) : [];

    updateWidget({
      inputTokens,
      histTokens,
      totalTokens,
      limit,
      inputPct,
      ctxPct,
      remaining,
      status,
      hints,
    });
  }

  // ─── Usage Limit DOM Scraping ──────────────────────────────────────────────

  function checkUsageLimits() {
    let limitMsg = null;
    let limitType = null; // 'warning', 'danger'

    // Look through all divs for Claude's limit text
    // E.g., "7 messages remaining until 3:00 PM" or "You are out of free messages until 3:30 PM"
    const elements = document.querySelectorAll('div, span, button');
    for (const el of elements) {
      if (!el.textContent) continue;
      const text = el.textContent.trim();

      // "out of free messages until 3:30 PMUpgrade..."
      let match = text.match(/out of .*?messages until\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (match && match[1]) {
        limitMsg = `0 msgs left (resets ${match[1]})`;
        limitType = 'danger';
        break;
      }

      // "7 messages remaining until 3:00 PMUpgrade..."
      match = text.match(/([0-9]+)\s*messages? remaining until\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (match && match[1] && match[2]) {
        limitMsg = `${match[1]} msgs left (resets ${match[2]})`;
        limitType = match[1] <= 3 ? 'danger' : 'warning';
        break;
      }
    }

    return { limitMsg, limitType };
  }

  // ─── Widget DOM Updates ───────────────────────────────────────────────────

  function updateWidget({ inputTokens, histTokens, totalTokens, limit, inputPct, ctxPct, remaining, status, hints }) {
    if (!widgetEl) return;

    const $  = (id) => document.getElementById(id);
    const pf = (n)  => n.toFixed(1);

    // Input section
    $('cc-input-pct').textContent = pf(inputPct) + '%';
    $('cc-input-sub').textContent = `${fmtNum(inputTokens)} / ${fmtNum(limit)} tokens`;
    setBar($('cc-input-bar'), inputPct);

    // Context section
    $('cc-ctx-pct').textContent = pf(ctxPct) + '%';
    $('cc-ctx-sub').textContent = `Remaining: ~${fmtNum(remaining)}`;
    
    // Breakdown
    $('cc-split-in').textContent = `Prompt: ${fmtNum(inputTokens)}`;
    $('cc-split-hist').textContent = `Memory: ${fmtNum(histTokens)}`;

    setBar($('cc-ctx-bar'), ctxPct);

    // Hints Update
    const hintsEl = $('cc-hints-container');
    if (hints && hints.length > 0) {
      hintsEl.innerHTML = hints.map(h => `<div class="cc-hint-item">💡 ${h}</div>`).join('');
      hintsEl.classList.add('cc-has-hints');
    } else {
      hintsEl.classList.remove('cc-has-hints');
      hintsEl.innerHTML = '';
    }

    // Status & Usage
    const statusEl = $('cc-status');
    const limits = checkUsageLimits();
    
    if (limits.limitMsg) {
      statusEl.textContent = `● ${limits.limitMsg}`;
      statusEl.className = `cc-${limits.limitType}`;
    } else {
      statusEl.textContent = status.label;
      statusEl.className = '';
      if (ctxPct >= 90) statusEl.classList.add('cc-danger');
      else if (ctxPct >= 75) statusEl.classList.add('cc-warning');
    }
  }

  function setBar(barEl, pct) {
    if (!barEl) return;
    barEl.style.width = Math.min(100, pct) + '%';
    barEl.style.opacity = pct > 0 ? '1' : '0';
    barEl.classList.remove('cc-bar-warning', 'cc-bar-danger');
    if (pct >= 90) barEl.classList.add('cc-bar-danger');
    else if (pct >= 75) barEl.classList.add('cc-bar-warning');
  }

  // ─── Collapse / Expand ────────────────────────────────────────────────────

  function setupCollapseButton() {
    const btn = document.getElementById('cc-collapse-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isNowCollapsed = !widgetEl.classList.contains('cc-collapsed');
      setCollapsed(isNowCollapsed, true);
    });
  }

  function setCollapsed(collapse, save = true) {
    const body = document.getElementById('clodcount-body');
    if (!body || !widgetEl) return;

    if (collapse) {
      body.classList.add('cc-hidden');
      widgetEl.classList.add('cc-collapsed');
      const btn = document.getElementById('cc-collapse-btn');
      if (btn) btn.textContent = '›';
    } else {
      body.classList.remove('cc-hidden');
      widgetEl.classList.remove('cc-collapsed');
      const btn = document.getElementById('cc-collapse-btn');
      if (btn) btn.textContent = '‹';
    }

    if (save) {
      chrome.runtime.sendMessage({ type: 'SET_PREFS', prefs: { collapsed: collapse } });
    }
  }

  // ─── Dragging ─────────────────────────────────────────────────────────────

  function setupDragging() {
    const handle = document.getElementById('clodcount-drag-handle');
    if (!handle || !widgetEl) return;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;

      const rect = widgetEl.getBoundingClientRect();
      // Offset from mouse to widget bottom-right corner
      dragOffsetX = window.innerWidth  - e.clientX - (window.innerWidth  - rect.right);
      dragOffsetY = window.innerHeight - e.clientY - (window.innerHeight - rect.bottom);

      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup',   onDragEnd);
    });
  }

  function onDragMove(e) {
    if (!isDragging || !widgetEl) return;
    const newRight  = Math.max(0, window.innerWidth  - e.clientX - dragOffsetX);
    const newBottom = Math.max(0, window.innerHeight - e.clientY - dragOffsetY);
    widgetEl.style.right  = newRight  + 'px';
    widgetEl.style.bottom = newBottom + 'px';
  }

  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup',   onDragEnd);

    const newRight  = parseFloat(widgetEl.style.right)  || 20;
    const newBottom = parseFloat(widgetEl.style.bottom) || 24;
    chrome.runtime.sendMessage({
      type: 'SET_PREFS',
      prefs: { widgetPosition: { right: newRight, bottom: newBottom } },
    });
  }

  // ─── MutationObserver — SPA Navigation Guard ──────────────────────────────

  function startMutationObserver() {
    if (observerRef) observerRef.disconnect();

    let reattachTimer = null;

    observerRef = new MutationObserver(() => {
      // Re-check input element and theme on DOM changes (throttled)
      clearTimeout(reattachTimer);
      reattachTimer = setTimeout(() => {
        attachInputListeners();
        applyTheme();
        // Re-inject widget if it was removed (rare, but SPA can nuke elements)
        if (!document.getElementById('clodcount-widget')) {
          injectWidget();
        }
        // Force update on DOM mutation to capture new chat history
        runUpdate();
      }, 600);
    });

    observerRef.observe(document.body, {
      childList: true,
      subtree:   true,
    });

    watchTheme();
  }

  // ─── Listen for preference updates from popup ─────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PREFS_UPDATED') {
      loadPreferences().then(() => {
        // Update model label in footer
        const modelEl = document.getElementById('cc-model-name');
        if (modelEl) modelEl.textContent = prefs.modelLabel;

        // Refresh counts with new limit
        runUpdate();
      });
    }
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function fmtNum(n) {
    return Math.round(n).toLocaleString();
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
