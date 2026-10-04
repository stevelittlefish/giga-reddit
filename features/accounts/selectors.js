// The account switcher's Reddit DOM selectors. Checked on live Reddit, logged
// in, in Brave with Shields on (2026-10-04).

var giga = globalThis.giga || (globalThis.giga = {});
giga.accounts = giga.accounts || {};

giga.accounts.selectors = {
  // Who the page was rendered for, with id (t2_…) and display-name
  // attributes. It lives inside a <template> in Reddit's chat host, so
  // document.querySelector can't see it: look inside each template's content.
  // Pages without the chat host won't have it.
  currentUser: 'rs-current-user',
  template: 'template',
  // Wraps a comment box, the top-level one and each reply's. Carries the
  // logged-in account's user-id. Focus inside it is what shows the
  // "Posting as" label. Not yet checked: that focus in the editor passes
  // through this element.
  commentComposer: 'comment-composer-host',
};
