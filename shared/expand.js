// Expands hidden comments by clicking Reddit's "N more replies" buttons, up to
// a limit. Used by page export and the media downloader. Needs
// shared/selectors.js injected first.

var giga = globalThis.giga || (globalThis.giga = {});
giga.shared = giga.shared || {};

/**
 * Clicks "more replies" buttons one at a time, waiting for each to load.
 * Visible buttons go first; buttons inside collapsed comments come after.
 * @returns {Promise<{clicks: number, remaining: number, limitReached: boolean}>}
 */
giga.shared.expandReplies = async function ({ maxClicks = 25, timeoutMs = 8000 } = {}) {
  const sel = giga.shared.selectors;
  const tried = new WeakSet();
  const visible = el => el.getClientRects().length > 0;
  const commentCount = () => document.querySelectorAll(sel.comment).length;

  let clicks = 0;
  while (clicks < maxClicks) {
    const buttons = [...document.querySelectorAll(sel.moreRepliesButton)].filter(b => !tried.has(b));
    const button = buttons.find(visible) || buttons[0];
    if (!button) break;

    tried.add(button);
    const before = commentCount();
    button.click();
    clicks++;
    // Assumed, not confirmed: loading either removes the button or adds comments.
    await giga.shared.waitFor(() => !button.isConnected || commentCount() > before, timeoutMs);
  }

  const remaining = document.querySelectorAll(sel.moreRepliesButton).length;
  return { clicks, remaining, limitReached: clicks >= maxClicks && remaining > 0 };
};

// Polls until check() is true or the time runs out. Returns whether it came true.
giga.shared.waitFor = async function (check, timeoutMs, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return check();
};
