// Expands hidden comments by clicking Reddit's "N more replies" buttons, up to
// a limit. Used by page export and the media downloader. Needs
// shared/selectors.js injected first.

var giga = globalThis.giga || (globalThis.giga = {});
giga.shared = giga.shared || {};

/**
 * Clicks "more replies" buttons one at a time, waiting for each to load.
 * Shallowest first, so every top-level comment gets its replies before any one
 * chain gets dug to the bottom. Among equals, visible buttons beat ones inside
 * collapsed comments. onProgress(clicks, maxClicks) is called after each click.
 * @returns {Promise<{clicks: number, remaining: number, limitReached: boolean}>}
 */
giga.shared.expandReplies = async function ({ maxClicks = 25, timeoutMs = 8000, onProgress = () => {} } = {}) {
  const sel = giga.shared.selectors;
  const tried = new WeakSet();
  const visible = el => el.getClientRects().length > 0;
  const commentCount = () => document.querySelectorAll(sel.comment).length;
  const depthOf = el => {
    let depth = 0;
    for (let c = el.closest(sel.comment); c; c = c.parentElement && c.parentElement.closest(sel.comment)) depth++;
    return depth;
  };

  let clicks = 0;
  while (clicks < maxClicks) {
    let button = null;
    let best = Infinity;
    for (const candidate of document.querySelectorAll(sel.moreRepliesButton)) {
      if (tried.has(candidate)) continue;
      // Nesting depth, with hidden buttons sorted after visible ones at the same depth.
      const rank = depthOf(candidate) * 2 + (visible(candidate) ? 0 : 1);
      if (rank < best) [button, best] = [candidate, rank];
    }
    if (!button) break;

    tried.add(button);
    const before = commentCount();
    button.click();
    clicks++;
    // Assumed, not confirmed: loading either removes the button or adds comments.
    await giga.shared.waitFor(() => !button.isConnected || commentCount() > before, timeoutMs);
    onProgress(clicks, maxClicks);
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
