/**
 * ClodCount — Token Estimation Engine
 * Pure client-side heuristic. No DOM dependency. ±15–25% accuracy.
 *
 * Multiplier reference:
 *   Latin/English  → chars / 4
 *   CJK characters → chars / 2
 *   Code blocks    → chars / 3.5
 *   Emoji          → 1 token per emoji
 */

'use strict';

// ─── Regex Patterns ──────────────────────────────────────────────────────────

const CJK_RANGE = /[\u3000-\u9fff\ua000-\ua48f\ua490-\ua4ff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef\u4e00-\u9fff\u3400-\u4dbf]/g;
const EMOJI_RANGE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
const CODE_BLOCK = /```[\s\S]*?```|`[^`]+`/g;

// ─── Core Estimation ─────────────────────────────────────────────────────────

/**
 * Count CJK characters in a string.
 * @param {string} text
 * @returns {number}
 */
function countCJK(text) {
  const matches = text.match(CJK_RANGE);
  return matches ? matches.length : 0;
}

/**
 * Count emoji characters in a string.
 * @param {string} text
 * @returns {number}
 */
function countEmoji(text) {
  const matches = text.match(EMOJI_RANGE);
  return matches ? matches.length : 0;
}

/**
 * Extract and measure code blocks, return total char count inside code regions.
 * @param {string} text
 * @returns {{ codeChars: number, strippedText: string }}
 */
function extractCode(text) {
  let codeChars = 0;
  const strippedText = text.replace(CODE_BLOCK, (match) => {
    codeChars += match.length;
    return ''; // remove from main text
  });
  return { codeChars, strippedText };
}

/**
 * Main token estimator — applies per-segment multipliers.
 * @param {string} text
 * @returns {number} estimated token count
 */
function estimateTokens(text) {
  if (!text || text.trim().length === 0) return 0;

  // 1. Extract code blocks separately
  const { codeChars, strippedText } = extractCode(text);

  // 2. From remaining text, count CJK + emoji
  const cjkCount = countCJK(strippedText);
  const emojiCount = countEmoji(strippedText);

  // 3. Remaining latin chars (subtract CJK and emoji char positions)
  // CJK chars avg ~2 bytes in JS string but we count by char
  const latinChars = Math.max(0, strippedText.length - cjkCount - emojiCount);

  // 4. Apply multipliers
  const latinTokens  = latinChars / 4;
  const cjkTokens    = cjkCount / 2;
  const emojiTokens  = emojiCount * 1;
  const codeTokens   = codeChars / 3.5;

  const total = latinTokens + cjkTokens + emojiTokens + codeTokens;

  return Math.max(0, Math.ceil(total));
}

/**
 * Estimate tokens from an array of history message strings.
 * Caps at last 20 messages to avoid performance issues.
 * @param {string[]} messages — array of message text strings
 * @returns {number} estimated token sum for history
 */
function estimateHistory(messages) {
  if (!messages || messages.length === 0) return 0;

  // Cap to last 20 messages
  const capped = messages.slice(-20);

  return capped.reduce((sum, msg) => {
    return sum + estimateTokens(msg);
  }, 0);
}

/**
 * Get total estimated context usage, including system prompt buffer.
 * @param {number} inputTokens — current input token estimate
 * @param {number} historyTokens — history token estimate
 * @returns {number} total tokens including system buffer
 */
function getTotalContext(inputTokens, historyTokens) {
  const SYSTEM_BUFFER = 1000; // conservative system prompt overhead
  return inputTokens + historyTokens + SYSTEM_BUFFER;
}

/**
 * Determine status label and CSS class based on usage percentage.
 * @param {number} pct — usage percent (0–100)
 * @returns {{ label: string, cls: string }}
 */
function getStatus(pct) {
  if (pct >= 90) return { label: '● Danger',  cls: 'cc-danger'  };
  if (pct >= 75) return { label: '● Warning', cls: 'cc-warning' };
  return             { label: '● Safe',    cls: 'cc-safe'    };
}

/**
 * Analyze prompt for optimization hints.
 * @param {string} text
 * @returns {string[]} Array of hint messages
 */
function analyzePrompt(text) {
  const hints = [];
  if (!text || text.trim().length === 0) return hints;
  
  const tokens = estimateTokens(text);
  
  // 1. Length warning
  if (tokens > 50000) {
    hints.push("Length warning: Input exceeds 50k tokens. Output quality may begin to degrade due to attention dilution.");
  }
  
  // 2. Repetition check (naive: look for duplicate blocks of 500+ chars)
  if (text.length > 2000) {
    const largeBlocks = text.split('\n\n').filter(b => b.length > 500);
    const seen = new Set();
    let repeated = false;
    for (const block of largeBlocks) {
      if (seen.has(block)) {
        repeated = true;
        break;
      }
      seen.add(block);
    }
    if (repeated) {
      hints.push("Repetition detected: Found redundant large text blocks. Consider cleaning up your prompt.");
    }
  }
  
  return hints;
}

// ─── Export to global scope (content.js imports these) ───────────────────────
// Using window assignment since MV3 content scripts share the page's JS environment.
window.__ccTokenizer = {
  estimateTokens,
  estimateHistory,
  getTotalContext,
  getStatus,
  analyzePrompt,
};
