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
| reddit-video-grabber (local only, at `~/scratch/reddit-video-grabber` on the master's machine. It's deliberately not in git, so `pull.sh` doesn't fetch it, and it's only readable on that machine) | **Basis for the media downloader.** The master's earlier extension for downloading Reddit videos and images |
| [reddit-session-switcher](https://github.com/HejAsh/reddit-session-switcher) | **Basis for the account switcher.** A small MV3 extension that switches Reddit accounts by swapping session cookies |

## lemon-chat's Reddit capture

**lemon-chat is our own code, so the clean-room rule doesn't apply: it may be
copied and adapted directly.**

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

## reddit-video-grabber

The master's own earlier Manifest V3 extension (about 350 lines plus a vendored
library). **It's our own code, so the clean-room rule doesn't apply: it may be
copied and adapted directly.** It isn't in a git repository yet, so it lives outside `references/`
for now.

How it finds media:

- **Watching network traffic:** the background service worker uses
  `chrome.webRequest.onBeforeRequest` on `*.redd.it` to record every media
  request a tab makes. That catches anything that actually plays, including
  comment GIFs (which Reddit serves as MP4s). Found items are stored per tab
  in `chrome.storage.session`, the toolbar badge shows the count, and the list
  is cleared when the tab navigates or closes.
- **Scanning the page:** the popup injects a function with
  `chrome.scripting.executeScript` that searches the page's HTML for media URLs.
  It also fetches the thread's `.json`, which **Giga Reddit must not do** (see
  AGENTS.md).
- Kinds of URL it recognises:
  - Reddit-hosted video on `v.redd.it`, as `HLSPlaylist.m3u8` or
    `DASHPlaylist.mpd`. This includes videos attached to comments, under
    `v.redd.it/link/<post>/asset/<id>/`, and comment links of the form
    `reddit.com/link/<id>/video/<id>/player`.
  - MP4s that already contain audio, or are silent GIFs: `packaged-media.redd.it`,
    `preview.redd.it` and `external-preview.redd.it` with `format=mp4`, and
    `i.redd.it/*.mp4`.
  - Images on `i.redd.it` (jpg, png, gif, webp).

How it downloads (an extension page, `downloader.html`, opened in a new tab):

- **Reddit video comes as separate video and audio streams.** It fetches the
  DASH manifest (`DASHPlaylist.mpd`), parses it with `DOMParser`, and picks the
  video stream with the greatest height and the audio stream with the highest
  bandwidth.
- Some `v.redd.it` files need the signed query string from the original player
  URL. It tries without it first, then with it.
- **Merging:** it combines video and audio into one MP4 **without re-encoding**,
  using the third-party library [Mediabunny](https://github.com/Vanilagy/mediabunny)
  (vendored as `vendor/mediabunny.min.mjs`, **MPL-2.0**). If merging fails, it
  saves the video and audio as separate files. If there's no audio stream, it
  saves the video and says the video has no sound.
- Files are saved with `chrome.downloads` to `Downloads/reddit-videos/`, and
  duplicate names get a number added.
- The popup lists everything found, with videos first, plus "Download all
  videos" and "Download everything" buttons.

Gaps and things to check:

- The `.json` fetch has to go. Network watching and page scanning are what's left.
- Gallery images (served from `preview.redd.it`) don't appear to be handled.
- Media hosted outside Reddit (Imgur, YouTube and so on) isn't handled.
- Downloads happen one after another in a separate tab, which has to stay open.
