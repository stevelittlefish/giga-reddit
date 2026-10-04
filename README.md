# Giga Reddit

A Chrome extension that fixes the things about Reddit that shouldn't need fixing.

Built for Brave, works in Google Chrome. Firefox is not supported.

> **Status:** design stage. Nothing is built yet.

## Features

### 1. Account switcher

Switch between multiple Reddit accounts in one click, and always know which account you're using.

**Switching**

- Each account's Reddit session cookies are saved and restored with the `chrome.cookies` API. Switching swaps the cookies and reloads the page, with no logout and no password typing.
- Switching never logs out through Reddit, because that would end the session on Reddit's side and make the saved cookies useless.
- All Reddit cookies are saved and swapped together, so we don't need to know which ones make up a login. This approach comes from [reddit-session-switcher](references/README.md).
- Before switching away, the current account's cookies are saved again, in case Reddit has refreshed them since they were captured.

**Knowing which account you're on**

- The toolbar icon shows the active account with a badge and a colour for each account.
- Every Reddit page gets a marker in the account's colour.
- The extension asks Reddit who is actually logged in, instead of trusting what it last switched to.
- *Undecided:* a "posting as X" warning on comment and submit boxes.

**Storage and security**

- Saved sessions are kept only in `chrome.storage.local` and never leave the machine.
- They're encrypted with AES-GCM (`crypto.subtle`), using a key built into the extension.
- This deliberately provides **minimal protection only**. It stops generic scripts that grab plain-text cookies from browser profile files. It doesn't stop anyone targeting this extension specifically, because the key is in the source code. Anyone with access to your unlocked browser can use your saved accounts.

### 2. Page export

One click exports the current Reddit comment thread, including its metadata, in a form that LLMs can read easily.

- **Comment threads only** for now. Profile and subreddit listing pages are out of scope.
- **LLM readability is the priority.** The output format is our own design, chosen for how well an LLM reads it. Compatibility with other tools' formats is not a goal.
- The data is read from the rendered page (the DOM), not from Reddit's `.json` endpoints.
- The capture code is based on lemon-chat's `save-reddit` extension (see [references](references/README.md)). It's extended to capture more metadata: timestamps, OP markers, flair, edited status and upvote ratio, along with author, score, depth and permalink.
- **Hidden comments:** the export clicks "more replies" style buttons to expand hidden comments, up to a configurable limit on the number of clicks. The default is 5, copied from lemon-chat until we have a reason to pick something else. If the limit is reached, the export says so.
- Formats:
  - **Markdown** (primary) for pasting into an LLM chat: the post first, then nested comments with metadata on each one.
  - **JSON** for other tools.
- Output can be **copied to the clipboard** or **saved as a file**.
- Scores come from what Reddit displays. Reddit deliberately fuzzes vote counts, and doesn't show true upvote and downvote counts.

### 3. Media downloader

Download videos and images from Reddit posts and comments, with sound included.

- It's based on the master's earlier reddit-video-grabber (see [references](references/README.md)).
- It finds media in two ways. It **watches the media requests a tab makes**, so anything that plays gets caught, including comment GIFs. It also **scans the rendered page** for media links. It doesn't use Reddit's `.json` endpoints.
- **Reddit video** comes as separate video and audio streams. The downloader picks the best quality of each from the DASH manifest and merges them into one MP4 without re-encoding. If merging fails, it saves the two streams separately.
- **Images** and single-file MP4s are saved as they are.
- The toolbar badge shows how many media items were found on the current page, and you can download one item or all of them.
- *Undecided:* gallery support, media hosted outside Reddit, which library does the merging, and where files are saved.

## Licence

See [LICENCE](LICENCE).
