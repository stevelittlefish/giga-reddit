// The media downloader's content script. Expands hidden replies, then reports
// the raw media links it can see. Picking, de-duplicating and naming happen in
// items.js. Needs shared/selectors.js, shared/expand.js and selectors.js
// injected first.

var giga = globalThis.giga || (globalThis.giga = {});
giga.media = giga.media || {};

giga.media.scan = async function ({ maxClicks = 25 } = {}) {
  const shared = giga.shared.selectors;
  const sel = giga.media.selectors;

  const report = message => chrome.runtime.sendMessage({ type: 'giga-media-progress', ...message }).catch(() => {});
  const expansion = await giga.shared.expandReplies({
    maxClicks,
    onProgress: (clicks, max) => report({ stage: 'expanding', clicks, maxClicks: max }),
  });
  report({ stage: 'scanning' });

  const post = document.querySelector(shared.post);
  if (!post) throw new Error('No Reddit post found on this page.');
  const postId = post.getAttribute('id');
  const commentOf = el => {
    const comment = el.closest(shared.comment);
    return comment ? comment.getAttribute('thingid') : null;
  };

  return {
    url: location.href,
    expansion,
    post: {
      id: postId,
      title: post.getAttribute('post-title'),
      subreddit: post.getAttribute('subreddit-name'),
    },
    contentHref: post.getAttribute('content-href'),
    players: [...document.querySelectorAll(sel.player)].map(player => ({
      src: player.getAttribute('src'),
      postId: player.getAttribute('post-id'),
      commentId: player.getAttribute('comment-id') || commentOf(player),
      promoted: player.hasAttribute('post-promoted'),
      poster: player.getAttribute('poster'),
    })),
    galleryImages: [...document.querySelectorAll(`${sel.gallery}[post-id="${postId}"] ${sel.galleryFullImage}`)]
      .map(img => img.getAttribute('src')),
    commentImages: [...document.querySelectorAll(`${shared.commentBody} img`)].map(img => ({
      src: img.getAttribute('src'),
      commentId: commentOf(img),
    })),
  };
};
