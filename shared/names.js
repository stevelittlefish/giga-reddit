// Names for things we save. An ES module, not a content script: the popup and
// extension pages import it. Pure, so node --test can check it.

/** A readable, unique name for a thread: subreddit_postid_short-title */
export function threadName(post) {
  const slug = (post.title || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  const id = (post.id || '').replace(/^t3_/, '');
  return [post.subreddit, id, slug].filter(Boolean).join('_');
}
