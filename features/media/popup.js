// The media downloader's part of the popup: find every image and video in the
// thread, then hand the list to the download page, which keeps going after the
// popup closes.

import { buildItems, mediaFolder } from './items.js';

// Content script files, in load order. Paths are from the extension root.
export const FILES = [
  'shared/selectors.js',
  'shared/expand.js',
  'features/media/selectors.js',
  'features/media/content.js',
];
const THREAD_URL = /^https:\/\/(www\.)?reddit\.com\/r\/[^/]+\/comments\//;
// Shares page export's "more replies" click limit, set in the export section.
const MAX_CLICKS_KEY = 'export.maxClicks';
const DEFAULT_MAX_CLICKS = 25;

export async function initMedia(section) {
  const status = section.querySelector('[data-status]');
  const button = section.querySelector('button[data-action="download-all"]');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !THREAD_URL.test(tab.url || '')) {
    status.textContent = 'Open a Reddit comment thread to download its media.';
    button.disabled = true;
    return;
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message.type !== 'giga-media-progress') return;
    status.textContent = message.stage === 'expanding'
      ? `Expanding replies: ${message.clicks} of up to ${message.maxClicks} clicks…`
      : 'Looking for images and videos…';
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Expanding replies and looking for media…';
    try {
      const stored = await chrome.storage.local.get(MAX_CLICKS_KEY);
      const scan = await runScan(tab.id, stored[MAX_CLICKS_KEY] ?? DEFAULT_MAX_CLICKS);
      const items = buildItems(scan);
      if (!items.length) {
        status.textContent = 'No images or videos found in this thread.';
        button.disabled = false;
        return;
      }
      const job = crypto.randomUUID();
      await chrome.storage.session.set({
        [`media.job.${job}`]: { folder: mediaFolder(scan.post), title: scan.post.title, items },
      });
      // Opening the tab closes the popup; the download page takes it from here.
      await chrome.tabs.create({ url: chrome.runtime.getURL(`features/media/downloader.html?job=${job}`) });
    } catch (error) {
      status.textContent = `Couldn't find the media: ${error.message || error}`;
      button.disabled = false;
    }
  });
}

async function runScan(tabId, maxClicks) {
  await chrome.scripting.executeScript({ target: { tabId }, files: FILES });
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [maxClicks],
    // Runs in the page's content script world, where the files above defined giga.
    func: async maxClicks => {
      try {
        return { ok: true, data: await giga.media.scan({ maxClicks }) };
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
