// The account switcher's content script, on every Reddit page. It paints a
// marker in the account's colour, and a "Posting as u/<name>" label over any
// comment box or post form being typed in. The truth about who is logged in
// comes from the background worker, through chrome.storage. Needs selectors.js
// loaded first.

var giga = globalThis.giga || (globalThis.giga = {});
giga.accounts = giga.accounts || {};

if (!giga.accounts.started) {
  giga.accounts.started = true;
  giga.accounts.start = function () {
    const sel = giga.accounts.selectors;
    const CURRENT_KEY = 'accounts.current';
    const NEUTRAL = '#878a8c';
    // The create-post form: /submit, /r/<sub>/submit, /user/<name>/submit.
    const SUBMIT_PATH = /\/submit\/?$/;

    const pageName = readPageName();
    let current = null;
    let anchor = null;
    let hideTimer = 0;

    const host = document.createElement('giga-accounts');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        div {
          position: fixed;
          z-index: 2147483647;
          padding: 3px 10px;
          border-radius: 999px;
          color: #fff;
          font: 600 12px/1.4 system-ui, sans-serif;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          pointer-events: none;
          white-space: nowrap;
        }
        .marker { left: 12px; bottom: 12px; opacity: 0.85; }
        .label { font-size: 13px; }
        [hidden] { display: none; }
      </style>
      <div class="marker"></div>
      <div class="label" hidden></div>`;
    const marker = root.querySelector('.marker');
    const label = root.querySelector('.label');
    document.documentElement.append(host);

    function render() {
      const name = current && current.name;
      const colour = (current && current.colour) || NEUTRAL;
      // The page was loaded as someone else: another tab has switched since.
      const stale = !!pageName && !!name && pageName.toLowerCase() !== name.toLowerCase();
      const warning = stale ? ` (page loaded as u/${pageName}, reload before posting)` : '';
      marker.textContent = (name ? `u/${name}` : 'Logged out') + (stale ? ' ⚠' : '');
      marker.style.background = colour;
      marker.hidden = !current;
      label.textContent = (name ? `Posting as u/${name}` : 'Not logged in') + warning;
      label.style.background = colour;
    }

    function show(target) {
      clearTimeout(hideTimer);
      if (anchor === target) return;
      const wasHidden = !anchor;
      anchor = target;
      label.hidden = false;
      // Someone may have switched accounts in another window. Check, cheaply.
      chrome.runtime.sendMessage({ type: 'giga-accounts-check' }).catch(() => {});
      if (wasHidden) requestAnimationFrame(follow);
    }

    function hide() {
      anchor = null;
      label.hidden = true;
    }

    // Keep the label sitting just above whatever is being typed in.
    function follow() {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      if (!anchor.isConnected || !rect.width) return hide();
      label.style.left = `${Math.max(4, rect.left)}px`;
      label.style.top = `${Math.max(4, rect.top - label.offsetHeight - 6)}px`;
      requestAnimationFrame(follow);
    }

    document.addEventListener('focusin', event => {
      const path = event.composedPath();
      const composer = path.find(el => el instanceof Element && el.matches(sel.commentComposer));
      const target = path[0];
      if (composer) show(composer);
      else if (SUBMIT_PATH.test(location.pathname) && isEditable(target)) show(target);
      else hide();
    }, true);

    // If focus moves somewhere, the focusin above decides. If it goes nowhere,
    // hide, after a moment in case it comes straight back.
    document.addEventListener('focusout', event => {
      if (event.relatedTarget) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, 150);
    }, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[CURRENT_KEY]) return;
      current = changes[CURRENT_KEY].newValue || null;
      render();
    });

    chrome.storage.local.get(CURRENT_KEY).then(stored => {
      current = stored[CURRENT_KEY] || null;
      render();
      // Tell the background who this page was rendered for. If that doesn't
      // match, it asks Reddit and the storage listener repaints us.
      chrome.runtime.sendMessage({ type: 'giga-accounts-page', name: pageName }).catch(() => {});
    });

    function readPageName() {
      for (const template of document.querySelectorAll(sel.template)) {
        const user = template.content.querySelector(sel.currentUser);
        if (user) return user.getAttribute('display-name');
      }
      return null;
    }

    function isEditable(el) {
      return el instanceof Element && (el.isContentEditable || el.matches('textarea, input[type="text"], input:not([type])'));
    }
  };
  giga.accounts.start();
}
