# Reference projects

These repositories are kept here to **read**, not to depend on. They're cloned
and gitignored. Nothing in this folder is part of Giga Reddit, and nothing here
should ever be imported by it.

**Clean-room rule:** these are inspiration, not source material. We describe
what they do in plain language here, then write our own implementation from
those descriptions without copying any code. The full rule is in
[AGENTS.md](../AGENTS.md).

```sh
./pull.sh      # clone anything missing, pull anything already present
```

To add a reference, add its clone URL to `REPOS` in `pull.sh`, then add a row
below saying why it's here and which parts are worth reading.

| Repository | Why it's here |
|---|---|
| [lemon-chat](https://github.com/stevelittlefish/lemon-chat) | **Basis for the page export feature.** Our LLM chat. Its `extensions/save-reddit` extension already captures Reddit threads from the rendered page |
| [reddit-session-switcher](https://github.com/HejAsh/reddit-session-switcher) | **Basis for the account switcher.** A small MV3 extension that switches Reddit accounts by swapping session cookies |

## lemon-chat's Reddit capture

`extensions/save-reddit/` is a small Manifest V3 extension (about 500 lines)
that captures Reddit threads for lemon-chat's research import. It reads the
rendered page, uses the browser's existing session, and doesn't call Reddit's
`.json` endpoints. That's the same approach Giga Reddit takes.

Worth reading:

- `capture.js`: the content script. It has selectors for new Reddit
  (`shreddit-post`, `shreddit-comment`), the previous new-Reddit markup and old
  Reddit. It clicks "more replies" style buttons within action and time
  limits, then captures the post and a flat list of comments with `depth`.
- `popup.js`: "Export current page", clipboard copy capped at 1 MB, and
  download through `chrome.downloads`.
- `background.js`: batch capture across many pages. Giga Reddit doesn't need
  this, but the badge and alarm handling is a useful example.
- `internal/redditimport/redditimport.go`: the Go side of the JSON format,
  with its limits (2,000 comments, depth 50 and so on).

What it doesn't capture yet: comment timestamps, OP markers, flair, edited
status, awards and upvote ratio. Bodies are taken with `innerText`, so links
and formatting are lost.

## reddit-session-switcher

A Manifest V3 extension (about 400 lines of JavaScript) that does the core of
Giga Reddit's account switcher. It's MIT licensed, but that doesn't matter
here, because we don't copy its code.

How it works (`background.js`):

- **Capture:** `chrome.cookies.getAll({ domain: 'reddit.com' })` saves *every*
  Reddit cookie for the account, not just chosen login cookies. That avoids
  having to know which cookies make up a Reddit login.
- **Switch:** it removes every Reddit cookie, sets the saved ones (including
  `httpOnly`, `sameSite` and expiry), then reloads the tab. It never logs out.
- **On-page switcher:** `content.js` adds a floating "Accounts" dropdown to
  Reddit pages, and moves aside if the RES account switcher is present.

Gaps compared with Giga Reddit's plans:

- Cookies are stored in plain text in `chrome.storage.local`.
- Before switching away, it doesn't re-save the current account's cookies. If
  Reddit has refreshed any of them since capture, the saved copy may be out of
  date. This is unconfirmed and needs testing.
- The current username is read with `a[data-click-id="user"]`, a selector from
  the previous new-Reddit markup. It may not match current Reddit. This needs
  checking.
- Errors from `chrome.cookies` (`chrome.runtime.lastError`) are ignored.
- Nothing constantly shows which account is active.
