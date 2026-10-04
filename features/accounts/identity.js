// Who's who: reading the username out of Reddit's /user/me/ redirect, and
// giving each account its own colour and badge.

// Reddit redirects this to /user/<name>/ for whoever is logged in. It's an
// ordinary page, not a .json endpoint.
export const WHOAMI_URL = 'https://www.reddit.com/user/me/';

// Colours for accounts, in the order they're handed out. All readable with
// white text on top.
export const COLOURS = ['#d93a00', '#0079d3', '#46a508', '#7e53c1', '#cc8b00', '#00a6a5', '#d4357a', '#5b6770'];

// For the logged-out and the not-yet-saved.
export const NEUTRAL = '#878a8c';

/**
 * Reads the username from where a fetch of WHOAMI_URL ended up. Returns null
 * if it ended up anywhere other than a profile (logged out).
 */
export function nameFromProfileUrl(url) {
  const match = /^https:\/\/(?:www\.)?reddit\.com\/(?:user|u)\/([^/?#]+)/i.exec(url || '');
  if (!match) return null;
  const name = decodeURIComponent(match[1]);
  // "me" is the alias itself, which means the redirect didn't happen. Real
  // usernames are at least three characters, so it can't be anyone.
  return name.toLowerCase() === 'me' ? null : name;
}

/** Reddit usernames are case-insensitive. */
export function sameName(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** The first colour nobody has yet, or a recycled one once they run out. */
export function pickColour(used) {
  return COLOURS.find(colour => !used.includes(colour)) ?? COLOURS[used.length % COLOURS.length];
}

/** Toolbar badge text: the start of the name, as much as a badge will fit. */
export function badgeText(name) {
  return name ? name.slice(0, 3) : '';
}
