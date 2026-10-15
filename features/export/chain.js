// Assembles one reply chain: a chosen comment and every comment above it, up
// to the post. Pure: no DOM, no chrome.*, so node --test can poke at it.
//
// A chain is a list of comments, leaf first, each one the parent of the one
// before it. Comments are the plain objects content.js builds, plus
// parentPermalink: the page that shows the parent comment.

/** True for a comment ID (t1_). Posts are t3_, and top-level comments may have no parent ID at all. */
export function isCommentId(id) {
  return typeof id === 'string' && id.startsWith('t1_');
}

/** True when the chain reaches all the way up to the post. */
export function isComplete(chain) {
  const top = chain[chain.length - 1];
  return Boolean(top) && !isCommentId(top.parentId);
}

/** The page to fetch for the chain's missing ancestors, or null if none are missing or there's no link to them. */
export function nextPage(chain) {
  if (!chain.length || isComplete(chain)) return null;
  return chain[chain.length - 1].parentPermalink || null;
}

/**
 * Extends the chain upwards with whichever of its ancestors are among found.
 * Returns a new chain; the old one is untouched. Stops at the first ancestor
 * found doesn't have, and never adds a comment twice.
 */
export function extendChain(chain, found) {
  const byId = new Map(found.map(comment => [comment.id, comment]));
  const out = [...chain];
  const seen = new Set(chain.map(comment => comment.id));
  let next = out.length ? byId.get(out[out.length - 1].parentId) : undefined;
  while (next && !seen.has(next.id)) {
    out.push(next);
    seen.add(next.id);
    next = byId.get(next.parentId);
  }
  return out;
}
