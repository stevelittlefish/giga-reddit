// Page export's Reddit DOM selectors. Checked on live Reddit, logged in, in
// Brave with Shields on (2026-10-04). Needs shared/selectors.js for the post
// and comment elements themselves.

var giga = globalThis.giga || (globalThis.giga = {});
giga.export = giga.export || {};

giga.export.selectors = {
  // Inside shreddit-post. Most post metadata is on the element's own attributes.
  postBody: 'shreddit-post-text-body',
  postFlair: 'shreddit-post-flair',
};
