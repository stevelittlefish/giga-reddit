// Page export's part of the popup: capture the thread in the current tab,
// then copy or save it as Markdown or JSON.

import { toMarkdown, toJson, exportFilename } from './format.js';

// Content script files, in load order. Paths are from the extension root.
export const FILES = [
  'shared/selectors.js',
  'shared/expand.js',
  'features/export/selectors.js',
  'features/export/content.js',
];
const THREAD_URL = /^https:\/\/(www\.)?reddit\.com\/r\/[^/]+\/comments\//;
const DEFAULT_MAX_CLICKS = 5;
const STORAGE_KEY = 'export.maxClicks';

export async function initExport(section) {
  const status = section.querySelector('[data-status]');
  const limit = section.querySelector('[data-max-clicks]');
  const buttons = [...section.querySelectorAll('button[data-action]')];
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  limit.value = stored[STORAGE_KEY] ?? DEFAULT_MAX_CLICKS;
  limit.addEventListener('change', () => {
    const value = Math.max(0, Math.floor(Number(limit.value) || 0));
    limit.value = value;
    chrome.storage.local.set({ [STORAGE_KEY]: value });
  });

  if (!tab || !THREAD_URL.test(tab.url || '')) {
    status.textContent = 'Open a Reddit comment thread to export it.';
    buttons.forEach(button => (button.disabled = true));
    return;
  }

  // One capture per popup per click limit; later buttons reuse it.
  const captures = new Map();
  const getCapture = maxClicks => {
    if (!captures.has(maxClicks)) {
      captures.set(maxClicks, capture(tab.id, maxClicks).catch(error => {
        captures.delete(maxClicks);
        throw error;
      }));
    }
    return captures.get(maxClicks);
  };

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      buttons.forEach(b => (b.disabled = true));
      status.textContent = 'Expanding replies and reading the thread…';
      try {
        const data = await getCapture(Number(limit.value));
        const [format, action] = button.dataset.action.split('-');
        const text = format === 'md' ? toMarkdown(data) : toJson(data);
        if (action === 'copy') {
          await navigator.clipboard.writeText(text);
        } else {
          await save(text, exportFilename(data.post, format), format === 'md' ? 'text/markdown' : 'application/json');
        }
        status.textContent = summary(data, action === 'copy' ? 'Copied' : 'Saved');
      } catch (error) {
        status.textContent = `Export failed: ${error.message || error}`;
      } finally {
        buttons.forEach(b => (b.disabled = false));
      }
    });
  }
}

async function capture(tabId, maxClicks) {
  await chrome.scripting.executeScript({ target: { tabId }, files: FILES });
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [maxClicks],
    // Runs in the page's content script world, where the files above defined giga.
    func: async maxClicks => {
      try {
        return { ok: true, data: await giga.export.capture({ maxClicks }) };
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    },
  });
  const result = frame && frame.result;
  if (!result) throw new Error('The page did not respond.');
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

function save(text, filename, type) {
  const url = `data:${type};charset=utf-8,${encodeURIComponent(text)}`;
  return chrome.downloads.download({ url, filename: `reddit-export/${filename}` });
}

function summary(data, verb) {
  const { remaining, limitReached } = data.expansion;
  let message = `${verb} the post and ${data.comments.length} comments.`;
  if (remaining) message += ` ${remaining} "more replies" left unexpanded${limitReached ? ' (click limit reached)' : ''}.`;
  return message;
}
