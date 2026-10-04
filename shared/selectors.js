// Reddit DOM selectors used by more than one feature. When Reddit rearranges
// its furniture, this is the first file to fix.
//
// Content script: not a module. Everything hangs off one global namespace so
// features don't trip over each other, and so the file can be injected again
// without "already declared" tantrums.

var giga = globalThis.giga || (globalThis.giga = {});
giga.shared = giga.shared || {};

giga.shared.selectors = {
  // The post on a comments page.
  post: 'shreddit-post',
  // Every comment, nested inside its parent comment.
  comment: 'shreddit-comment',
  // "N more replies" buttons that load replies in place. Checked on live
  // Reddit (2026-10-04): clicking one adds the replies without leaving the page.
  moreRepliesButton: 'faceplate-partial[slot="children"] button',
  // The same-looking "N more replies" / "More replies" links. These navigate
  // to a separate permalink page instead, so the expander never clicks them.
  moreRepliesLink: 'a.more-comments-link',
};
