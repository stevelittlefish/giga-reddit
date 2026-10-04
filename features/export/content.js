// Page export's content script. Expands hidden replies, then reads the post and
// comments into plain data. No formatting happens here; format.js does that.
// Needs shared/selectors.js, shared/expand.js and selectors.js injected first.

var giga = globalThis.giga || (globalThis.giga = {});
giga.export = giga.export || {};

giga.export.capture = async function ({ maxClicks = 25 } = {}) {
  const shared = giga.shared.selectors;
  const sel = giga.export.selectors;

  const expansion = await giga.shared.expandReplies({ maxClicks });

  const post = document.querySelector(shared.post);
  if (!post) throw new Error('No Reddit post found on this page.');

  const attr = (el, name) => el.getAttribute(name);
  const number = value => (value === null || value === '' || isNaN(value) ? null : Number(value));
  // The first match that belongs to root itself, not to a comment nested inside it.
  const own = (root, selector) =>
    [...root.querySelectorAll(selector)].find(el => el.closest(shared.comment) === (root.matches(shared.comment) ? root : null));
  const text = el => (el ? el.textContent.trim().replace(/\s+/g, ' ') : null);

  const postBody = post.querySelector(sel.postBody);

  return {
    url: location.href,
    capturedAt: new Date().toISOString(),
    expansion,
    post: {
      id: attr(post, 'id'),
      title: attr(post, 'post-title'),
      author: attr(post, 'author'),
      subreddit: attr(post, 'subreddit-name'),
      permalink: attr(post, 'permalink'),
      link: attr(post, 'content-href'),
      postType: attr(post, 'post-type'),
      created: attr(post, 'created-timestamp'),
      score: number(attr(post, 'score')),
      upvoteRatio: number(attr(post, 'upvote-ratio')),
      commentCount: number(attr(post, 'comment-count')),
      flair: text(post.querySelector(sel.postFlair)),
      body: postBody ? giga.export.readTree(postBody) : null,
    },
    comments: [...document.querySelectorAll(shared.comment)].map(comment => {
      const parent = comment.parentElement && comment.parentElement.closest(shared.comment);
      const body = own(comment, sel.commentBody);
      return {
        id: attr(comment, 'thingid'),
        parentId: parent ? attr(parent, 'thingid') : null,
        author: attr(comment, 'author'),
        created: attr(comment, 'created'),
        score: number(attr(comment, 'score')),
        depth: number(attr(comment, 'depth')),
        permalink: attr(comment, 'permalink'),
        collapsed: comment.hasAttribute('collapsed'),
        body: body ? giga.export.readTree(body) : null,
      };
    }),
  };
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
