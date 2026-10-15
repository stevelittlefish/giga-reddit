// Page export's content script. Expands hidden replies, then reads the post and
// comments into plain data. It also reads single reply chains for the
// right-click menu, and shows that menu's results. No formatting happens here;
// format.js does that. Needs shared/selectors.js, shared/expand.js and
// selectors.js injected first.

var giga = globalThis.giga || (globalThis.giga = {});
giga.export = giga.export || {};

giga.export.capture = async function ({ maxClicks = 25 } = {}) {
  const shared = giga.shared.selectors;

  // Progress goes to the popup, if it's still open to hear it.
  const report = message => chrome.runtime.sendMessage({ type: 'giga-export-progress', ...message }).catch(() => {});
  const expansion = await giga.shared.expandReplies({
    maxClicks,
    onProgress: (clicks, max) => report({ stage: 'expanding', clicks, maxClicks: max }),
  });
  report({ stage: 'reading' });

  const post = document.querySelector(shared.post);
  if (!post) throw new Error('No Reddit post found on this page.');

  return {
    url: location.href,
    capturedAt: new Date().toISOString(),
    expansion,
    post: giga.export.readPost(post),
    comments: [...document.querySelectorAll(shared.comment)].map(comment => {
      const parent = comment.parentElement && comment.parentElement.closest(shared.comment);
      return giga.export.readComment(comment, parent ? parent.getAttribute('thingid') : null);
    }),
  };
};

// The reply chain above the comment that was last right-clicked (menu.js
// remembers it), leaf first, as far up as this page shows it. Each comment
// gets parentPermalink, so the rest can be fetched if the page cut it off.
giga.export.captureChain = function () {
  const shared = giga.shared.selectors;
  const target = giga.export.menuTarget;
  const leaf = target && target.isConnected && target.closest(shared.comment);
  if (!leaf) throw new Error('Right-click inside a comment to copy its thread. If Giga Reddit was just reloaded, reload this page first.');
  const post = document.querySelector(shared.post);
  if (!post) throw new Error('No Reddit post found on this page.');

  const chain = [];
  for (let comment = leaf; comment; comment = comment.parentElement && comment.parentElement.closest(shared.comment)) {
    chain.push(giga.export.readChainComment(comment));
  }
  return { url: location.href, post: giga.export.readPost(post), chain };
};

// Fetches another page of this thread and reads every comment on it. On a
// comment's own page, Reddit sends that comment and all its ancestors inside
// <template> elements (checked on live Reddit, 2026-10-15), so the templates'
// contents are searched as well as the page itself.
giga.export.readThreadPage = async function (path) {
  const shared = giga.shared.selectors;
  const response = await fetch(new URL(path, location.origin), { credentials: 'include' });
  if (!response.ok) throw new Error(`Reddit answered ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  const roots = [doc, ...[...doc.querySelectorAll('template')].map(template => template.content)];
  const post = doc.querySelector(shared.post);
  return {
    post: post ? giga.export.readPost(post) : null,
    comments: roots.flatMap(root => [...root.querySelectorAll(shared.comment)]).map(giga.export.readChainComment),
  };
};

// A comment for a chain. Its parentid attribute names the parent even when the
// parent isn't on the page; it's null on top-level comments, so the element
// nesting is the fallback.
giga.export.readChainComment = function (comment) {
  const shared = giga.shared.selectors;
  const parent = comment.parentElement && comment.parentElement.closest(shared.comment);
  const parentId = comment.getAttribute('parentid') || (parent ? parent.getAttribute('thingid') : null);
  return { ...giga.export.readComment(comment, parentId), parentPermalink: comment.getAttribute('parent-permalink') };
};

giga.export.readPost = function (post) {
  const sel = giga.export.selectors;
  const body = post.querySelector(sel.postBody);
  const flair = post.querySelector(sel.postFlair);
  const attr = name => post.getAttribute(name);
  return {
    id: attr('id'),
    title: attr('post-title'),
    author: attr('author'),
    subreddit: attr('subreddit-name'),
    permalink: attr('permalink'),
    link: attr('content-href'),
    postType: attr('post-type'),
    created: attr('created-timestamp'),
    score: giga.export.number(attr('score')),
    upvoteRatio: giga.export.number(attr('upvote-ratio')),
    commentCount: giga.export.number(attr('comment-count')),
    flair: flair ? flair.textContent.trim().replace(/\s+/g, ' ') : null,
    body: body ? giga.export.readTree(body) : null,
  };
};

giga.export.readComment = function (comment, parentId) {
  const shared = giga.shared.selectors;
  // The comment's own body, not one belonging to a reply nested inside it.
  const body = [...comment.querySelectorAll(shared.commentBody)].find(el => el.closest(shared.comment) === comment);
  const attr = name => comment.getAttribute(name);
  return {
    id: attr('thingid'),
    parentId,
    author: attr('author'),
    created: attr('created'),
    score: giga.export.number(attr('score')),
    depth: giga.export.number(attr('depth')),
    permalink: attr('permalink'),
    collapsed: comment.hasAttribute('collapsed'),
    body: body ? giga.export.readTree(body) : null,
  };
};

giga.export.number = function (value) {
  return value === null || value === '' || isNaN(value) ? null : Number(value);
};

// Copies text to the clipboard. The page has focus right after a menu click,
// which is what the clipboard asks for.
giga.export.copyText = function (text) {
  return navigator.clipboard.writeText(text);
};

// A small notice at the bottom of the page, for results of the right-click
// menu, which has nowhere else to report. Replaces any notice already showing.
giga.export.toast = function (message) {
  let box = giga.export.toastBox;
  if (!box || !box.isConnected) {
    box = giga.export.toastBox = document.createElement('div');
    box.setAttribute('role', 'status');
    Object.assign(box.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 2147483647,
      maxWidth: 'min(480px, calc(100vw - 32px))', padding: '10px 16px', borderRadius: '8px',
      background: '#1a1a1b', color: '#fff', font: '14px/1.4 system-ui, sans-serif',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)', pointerEvents: 'none',
    });
    document.body.append(box);
  }
  box.textContent = message;
  clearTimeout(giga.export.toastTimer);
  giga.export.toastTimer = setTimeout(() => box.remove(), 5000);
};

// Copies an element's content into plain nested objects, so formatting can
// happen outside the page. Text nodes become strings; elements become
// { tag, children } plus href, src and alt where present.
giga.export.readTree = function (node) {
  const children = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      children.push(child.textContent);
    } else if (child.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE', 'TEMPLATE', 'svg'].includes(child.tagName)) {
      const item = giga.export.readTree(child);
      for (const name of ['href', 'src', 'alt']) {
        if (child.hasAttribute(name)) item[name] = child.getAttribute(name);
      }
      children.push(item);
    }
  }
  return { tag: node.tagName.toLowerCase(), children };
};
