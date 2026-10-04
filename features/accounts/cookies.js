// Turns the cookies chrome.cookies hands us into ones it will take back.
// Every Reddit cookie is saved and swapped together, so we never have to know
// which of them actually make up a login.

// chrome.cookies.getAll({ domain }) matches this domain and all its subdomains.
export const REDDIT_DOMAIN = 'reddit.com';

// The fields worth keeping. storeId is left behind on purpose: cookies go back
// into whichever store is current.
const KEPT = ['name', 'value', 'domain', 'hostOnly', 'path', 'secure', 'httpOnly', 'sameSite', 'session', 'expirationDate'];

/** Strips chrome.cookies.Cookie objects down to what restoring them needs. */
export function snapshot(cookies) {
  return cookies.map(cookie => Object.fromEntries(KEPT.filter(k => k in cookie).map(k => [k, cookie[k]])));
}

/** The URL chrome.cookies.set and remove want for a cookie. */
export function cookieUrl(cookie) {
  const host = cookie.domain.replace(/^\./, '');
  return `http${cookie.secure ? 's' : ''}://${host}${cookie.path || '/'}`;
}

/** True if a saved cookie has expired by nowSeconds. Session cookies never do. */
export function isExpired(cookie, nowSeconds) {
  return !cookie.session && typeof cookie.expirationDate === 'number' && cookie.expirationDate <= nowSeconds;
}

/** Builds chrome.cookies.set details from a saved cookie. */
export function toSetDetails(cookie) {
  const details = {
    url: cookieUrl(cookie),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
  };
  // A host-only cookie must not be given a domain, or Chrome widens it to
  // every subdomain.
  if (!cookie.hostOnly) details.domain = cookie.domain;
  if (cookie.sameSite && cookie.sameSite !== 'unspecified') details.sameSite = cookie.sameSite;
  if (!cookie.session && typeof cookie.expirationDate === 'number') details.expirationDate = cookie.expirationDate;
  return details;
}
