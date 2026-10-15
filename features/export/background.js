// Page export's service worker side: the right-click "Copy thread down to this
// comment" item. It reads the chain from the page, fetches any ancestors the
// page cut off ("Continue this thread" pages hide them), and copies the result
// as Markdown.

import { FILES } from './popup.js';
import { nextPage, extendChain, isComplete } from './chain.js';
import { toChainMarkdown } from './format.js';

const MENU_ID = 'giga-export-chain';
// Each fetched page has held the whole chain so far, so one is the norm. The
// limit only stops a runaway.
const MAX_PAGES = 10;

export function initExport() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: 'Copy thread down to this comment',
        contexts: ['all'],
        documentUrlPatterns: ['https://*.reddit.com/r/*/comments/*'],
      });
    });
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab) copyChain(tab.id, info.frameId || 0);
  });
}

async function copyChain(tabId, frameId) {
  const target = { tabId, frameIds: [frameId] };
  // Calls giga.export[name](...args) in the page and hands back its result.
  const run = async (name, ...args) => {
    const [frame] = await chrome.scripting.executeScript({
      target,
      args: [name, args],
      func: async (name, args) => {
        try {
          return { ok: true, data: await giga.export[name](...args) };
        } catch (error) {
          return { ok: false, error: String(error && error.message ? error.message : error) };
        }
      },
    });
    const result = frame && frame.result;
    if (!result) throw new Error('The page did not respond.');
    if (!result.ok) throw new Error(result.error);
    return result.data;
  };

  try {
    await chrome.scripting.executeScript({ target, files: FILES });
  } catch {
    return; // Not a page we can touch, so there's nowhere to report to either.
  }

  try {
    let { url, post, chain } = await run('captureChain');
    run('toast', 'Copying the thread…').catch(() => {});

    let stopReason = null;
    for (let pages = 0; !isComplete(chain); pages++) {
      const path = nextPage(chain);
      if (!path) { stopReason = 'the page gives no link to them'; break; }
      if (pages === MAX_PAGES) { stopReason = `the limit of ${MAX_PAGES} page fetches was reached`; break; }
      let page;
      try {
        page = await run('readThreadPage', path);
      } catch (error) {
        stopReason = `fetching them failed (${error.message})`;
        break;
      }
      // A continue-thread page may show the post without its text.
      if (!post.body && page.post && page.post.body) post = { ...post, body: page.post.body };
      const longer = extendChain(chain, page.comments);
      if (longer.length === chain.length) { stopReason = "Reddit's page for them didn't include them"; break; }
      chain = longer;
    }

    const complete = isComplete(chain);
    const text = toChainMarkdown({ url, capturedAt: new Date().toISOString(), post, chain, complete, stopReason });
    await run('copyText', text);
    const count = `${chain.length} comment${chain.length === 1 ? '' : 's'}`;
    await run('toast', complete
      ? `Copied the post and ${count}.`
      : `Copied the post and ${count}, but earlier comments are missing: ${stopReason}.`);
  } catch (error) {
    await run('toast', `Copy failed: ${error.message}`).catch(() => {});
  }
}
