# Reference projects

These repositories are kept here to **read**, not to depend on. They're cloned
and gitignored. Nothing in this folder is part of Giga Reddit, and nothing here
should ever be imported by it.

```sh
./pull.sh      # clone anything missing, pull anything already present
```

To add a reference, add its clone URL to `REPOS` in `pull.sh`, then add a row
below saying why it's here and which parts are worth reading.

| Repository | Why it's here |
|---|---|
| [lemon-chat](https://github.com/stevelittlefish/lemon-chat) | **Basis for the page export feature.** Our LLM chat. Its `extensions/save-reddit` extension already captures Reddit threads from the rendered page |

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
