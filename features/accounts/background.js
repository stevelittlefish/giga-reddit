// The account switcher's service worker side. It keeps each account's Reddit
// cookies (sealed), swaps them on command, and asks Reddit who is really
// logged in rather than trusting what it last switched to.
//
// Storage (chrome.storage.local):
//   accounts.saved   [{ name, colour, savedAt, session: sealed cookies }]
//   accounts.current { name, colour, saved, checkedAt }: who Reddit says is
//                    logged in. Content scripts watch this to paint the page.

import { seal, unseal } from './crypto.js';
import { REDDIT_DOMAIN, snapshot, cookieUrl, isExpired, toSetDetails } from './cookies.js';
import { WHOAMI_URL, NEUTRAL, nameFromProfileUrl, sameName, pickColour, badgeText } from './identity.js';

const SAVED_KEY = 'accounts.saved';
const CURRENT_KEY = 'accounts.current';
// How long a whoami answer is trusted when nothing has been switched.
const FRESH_MS = 15_000;
const REDDIT_TAB = /^https:\/\/([a-z0-9-]+\.)?reddit\.com\//;

const HANDLERS = {
  // Popup: the account list and who's logged in.
  'giga-accounts-state': () => state(FRESH_MS),
  // Popup: save (or re-save) the logged-in account's cookies.
  'giga-accounts-save': async () => {
    const name = await whoami();
    if (!name) throw new Error('Nobody is logged in to Reddit.');
    await saveAccount(name);
    return state();
  },
  'giga-accounts-switch': ({ name, tabId }) => switchTo(name, tabId),
  'giga-accounts-add': ({ tabId }) => logInAnother(tabId),
  'giga-accounts-forget': async ({ name }) => {
    await storeSaved((await loadSaved()).filter(a => !sameName(a.name, name)));
    // The logged-in account may have just lost its colour.
    const current = await loadCurrent();
    if (current) await setCurrent(current.name);
    return state();
  },
  // Content script: the page says who it was rendered for. Check if it
  // disagrees with what we have.
  'giga-accounts-page': async ({ name }) => {
    const current = await loadCurrent();
    if (name && current && sameName(name, current.name)) return current;
    try {
      return await refreshCurrent(0);
    } catch {
      // whoami failed; the page is the next best witness.
      return name ? setCurrent(name) : current;
    }
  },
  // Content script: someone is about to post. Make sure we know as who.
  'giga-accounts-check': () => refreshCurrent(FRESH_MS),
};

export function initAccounts() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = HANDLERS[message && message.type];
    if (!handler) return false;
    exclusive(() => handler(message, sender)).then(
      result => sendResponse({ ok: true, result }),
      error => sendResponse({ ok: false, error: String(error && error.message ? error.message : error) }),
    );
    return true;
  });
  chrome.runtime.onStartup.addListener(() => {
    exclusive(() => refreshCurrent(0)).catch(() => {});
  });
  chrome.runtime.onInstalled.addListener(() => {
    exclusive(() => refreshCurrent(0)).catch(() => {});
  });
}

// One cookie operation at a time. Two switches racing each other would leave
// a Frankenstein's monster of two accounts' cookies.
let queue = Promise.resolve();
function exclusive(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function state(maxAge) {
  let current = await loadCurrent();
  let error = null;
  if (maxAge !== undefined) {
    try {
      current = await refreshCurrent(maxAge);
    } catch (e) {
      error = `Couldn't ask Reddit who's logged in: ${e.message || e}`;
    }
  }
  const saved = (await loadSaved()).map(({ name, colour, savedAt }) => ({ name, colour, savedAt }));
  return { saved, current, error };
}

/** Asks Reddit who is logged in. Returns the name, or null if nobody. */
async function whoami() {
  const response = await fetch(WHOAMI_URL, { credentials: 'include', cache: 'no-store' });
  // Only the final URL matters; don't download the whole profile page.
  response.body?.cancel().catch(() => {});
  if (!response.redirected) {
    throw new Error(`Reddit answered /user/me/ with ${response.status} and no redirect.`);
  }
  return nameFromProfileUrl(response.url);
}

async function refreshCurrent(maxAge) {
  const current = await loadCurrent();
  if (current && Date.now() - current.checkedAt < maxAge) return current;
  return setCurrent(await whoami());
}

async function setCurrent(name) {
  const account = name ? (await loadSaved()).find(a => sameName(a.name, name)) : null;
  const current = { name, colour: account ? account.colour : null, saved: !!account, checkedAt: Date.now() };
  await chrome.storage.local.set({ [CURRENT_KEY]: current });
  await showBadge(current);
  return current;
}

async function showBadge(current) {
  await chrome.action.setBadgeText({ text: badgeText(current.name) });
  await chrome.action.setBadgeBackgroundColor({ color: current.colour || NEUTRAL });
  await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await chrome.action.setTitle({ title: current.name ? `Giga Reddit: u/${current.name}` : 'Giga Reddit: logged out' });
}

async function saveAccount(name) {
  const cookies = snapshot(await chrome.cookies.getAll({ domain: REDDIT_DOMAIN }));
  const saved = await loadSaved();
  const existing = saved.find(a => sameName(a.name, name));
  const others = saved.filter(a => a !== existing);
  const entry = {
    name: existing ? existing.name : name,
    colour: existing ? existing.colour : pickColour(others.map(a => a.colour)),
    savedAt: Date.now(),
    session: await seal(cookies),
  };
  await storeSaved(existing ? saved.map(a => (a === existing ? entry : a)) : [...saved, entry]);
  await setCurrent(name);
  return entry;
}

async function switchTo(name, tabId) {
  const target = (await loadSaved()).find(a => sameName(a.name, name));
  if (!target) throw new Error(`u/${name} isn't saved.`);

  const before = await whoami();
  if (!sameName(before, target.name)) {
    // Re-save whoever we're leaving, in case Reddit has refreshed their
    // cookies since. Accounts that were never saved get saved here too, so
    // switching away can't strand them.
    const previous = before ? await saveAccount(before) : null;

    await replaceCookies(await unseal(target.session));
    const after = await whoami();
    if (!sameName(after, target.name)) {
      // The saved session is dead. Put the previous account back.
      await replaceCookies(previous ? await unseal(previous.session) : []);
      await setCurrent(await whoami().catch(() => before));
      throw new Error(`u/${target.name}'s saved session doesn't work any more. Log in to it again, then save it.`);
    }
    await setCurrent(after);
  }
  await reloadIfReddit(tabId);
  return state();
}

// Saves the current account, then clears Reddit's cookies so the master can
// log in as someone else. Never logs out through Reddit: that would kill the
// saved session on Reddit's side.
async function logInAnother(tabId) {
  const before = await whoami();
  if (before) await saveAccount(before);
  await replaceCookies([]);
  await setCurrent(null);
  if (!(await reloadIfReddit(tabId))) await chrome.tabs.create({ url: 'https://www.reddit.com/' });
  return state();
}

async function replaceCookies(cookies) {
  const existing = await chrome.cookies.getAll({ domain: REDDIT_DOMAIN });
  await Promise.all(existing.map(c => chrome.cookies.remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId })));
  const now = Date.now() / 1000;
  const failed = [];
  for (const cookie of cookies) {
    if (isExpired(cookie, now)) continue;
    const result = await chrome.cookies.set(toSetDetails(cookie)).catch(() => null);
    if (!result) failed.push(cookie.name);
  }
  if (failed.length) console.warn('Giga Reddit: cookies that would not go back:', failed);
}

async function reloadIfReddit(tabId) {
  if (tabId === undefined || tabId === null) return false;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !REDDIT_TAB.test(tab.url || '')) return false;
  await chrome.tabs.reload(tabId);
  return true;
}

async function loadSaved() {
  return (await chrome.storage.local.get(SAVED_KEY))[SAVED_KEY] || [];
}

function storeSaved(saved) {
  return chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function loadCurrent() {
  return (await chrome.storage.local.get(CURRENT_KEY))[CURRENT_KEY] || null;
}
