// The account switcher's part of the popup: the saved accounts, who's logged
// in, and buttons to save, switch, forget and log in as someone new. All the
// cookie work happens in the background worker.

import { NEUTRAL } from './identity.js';

const REDDIT_TAB = /^https:\/\/([a-z0-9-]+\.)?reddit\.com\//;

export async function initAccounts(section) {
  const list = section.querySelector('[data-list]');
  const status = section.querySelector('[data-status]');
  const saveButton = section.querySelector('[data-action="save"]');
  const addButton = section.querySelector('[data-action="add"]');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab && REDDIT_TAB.test(tab.url || '') ? tab.id : null;

  const buttons = () => [...section.querySelectorAll('button')];
  const run = async (busyText, type, extra = {}) => {
    buttons().forEach(b => (b.disabled = true));
    status.textContent = busyText;
    try {
      render(await ask(type, { tabId, ...extra }));
      return true;
    } catch (error) {
      status.textContent = error.message;
      buttons().forEach(b => (b.disabled = false));
      return false;
    }
  };

  function render({ saved, current, error }) {
    const name = current && current.name;
    list.replaceChildren(...saved.map(account => row(account, name)));
    if (!saved.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No accounts saved yet.';
      list.append(empty);
    }
    saveButton.textContent = name ? `${current.saved ? 'Re-save' : 'Save'} u/${name}` : 'Save account';
    saveButton.disabled = !name;
    addButton.disabled = false;
    status.textContent = error || (name ? '' : 'Not logged in to Reddit.');
  }

  function row(account, currentName) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = account.colour || NEUTRAL;
    const label = document.createElement('span');
    label.className = 'name';
    label.textContent = `u/${account.name}`;
    li.append(dot, label);

    const active = !!currentName && currentName.toLowerCase() === account.name.toLowerCase();
    if (active) {
      const badge = document.createElement('span');
      badge.className = 'active';
      badge.textContent = 'active';
      li.append(badge);
    } else {
      const switchButton = document.createElement('button');
      switchButton.type = 'button';
      switchButton.textContent = 'Switch';
      switchButton.addEventListener('click', () =>
        run(`Switching to u/${account.name}…`, 'giga-accounts-switch', { name: account.name }));
      li.append(switchButton);
    }

    // Two clicks to forget, so a stray one doesn't lose an account.
    const forget = document.createElement('button');
    forget.type = 'button';
    forget.className = 'forget';
    forget.textContent = 'Forget';
    forget.title = 'Forget this account\'s saved session. Doesn\'t log it out.';
    forget.addEventListener('click', () => {
      if (forget.dataset.armed) {
        run(`Forgetting u/${account.name}…`, 'giga-accounts-forget', { name: account.name });
      } else {
        forget.dataset.armed = 'yes';
        forget.textContent = 'Sure?';
      }
    });
    li.append(forget);
    return li;
  }

  saveButton.addEventListener('click', () => run('Saving…', 'giga-accounts-save'));
  addButton.addEventListener('click', () => run('Clearing Reddit\'s cookies so you can log in…', 'giga-accounts-add'));

  status.textContent = 'Asking Reddit who you are…';
  buttons().forEach(b => (b.disabled = true));
  try {
    render(await ask('giga-accounts-state'));
  } catch (error) {
    status.textContent = error.message;
  }
}

async function ask(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response) throw new Error('The background worker didn\'t answer.');
  if (!response.ok) throw new Error(response.error);
  return response.result;
}
