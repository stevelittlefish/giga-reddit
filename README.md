<p align="center">
  <img src="docs/mascot.png" alt="The Giga Reddit mascot: an armoured robot Snoo in a red cape" width="360">
</p>

# Giga Reddit

A Chrome extension that fixes the things about Reddit that shouldn't need fixing.

Built for Brave, works in Google Chrome. Firefox is not supported.

> **Status:** design stage. Nothing is built yet. See the [TODO list](TODO.md) for the plan.

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
- **"Posting as" label:** whenever you're typing in a comment box or the create-post form, a label next to it shows **"Posting as u/<name>"** in the account's colour. It's there at the moment it matters most, just before you submit.

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
- **Hidden comments:** the export clicks "more replies" style buttons to expand hidden comments, up to a configurable limit on the number of clicks. The default is 25. It started at 5, copied from lemon-chat, but on a 1,368-comment thread 5 clicks loaded only 13 more comments. More clicks make the export slower, because each one waits for its replies to load. If the limit is reached, the export says so.
- Formats:
  - **Markdown** (primary) for pasting into an LLM chat: the post first, then nested comments with metadata on each one.
  - **JSON** for other tools.
- Output can be **copied to the clipboard** or **saved as a file**.
- Scores come from what Reddit displays. Reddit deliberately fuzzes vote counts, and doesn't show true upvote and downvote counts.

### 3. Media downloader

Download **all** the media in a Reddit thread, from the post and from every comment, with sound included.

- **The goal is completeness.** Every image, video and GIF in the thread gets found, from the post itself and from every comment.
- It's based on the master's earlier reddit-video-grabber (see [references](references/README.md)).
- It finds media in two ways. It **watches the media requests a tab makes**, so anything that plays gets caught. It also **scans the rendered page** for media links. It doesn't use Reddit's `.json` endpoints.
- **Hidden comments are expanded** before scanning, using the same "more replies" expansion as page export, so media in hidden replies isn't missed.
- **Coverage:**
  - Reddit-hosted video (`v.redd.it`), in posts and comments.
  - Images and GIFs in posts and comments (`i.redd.it`, including GIFs that Reddit serves as MP4).
  - **Every image in a gallery post.**
  - **Only media embedded in the thread itself**, meaning what Reddit shows inline. Links to media on other sites (Imgur, YouTube and so on) are not followed.
- **Reddit video** comes as separate video and audio streams. The page's video player points at an HLS playlist (`HLSPlaylist.m3u8`) listing every quality, and each stream behind it is one whole MP4 file. The downloader picks the best quality of each and merges them into one MP4 without re-encoding. If merging fails, it saves the two streams separately. Some videos have no audio at all, and those are saved as video only.
- **Images** and single-file MP4s are saved as they are.
- The toolbar badge shows how many media items were found. There's a **one-click "download everything"**, and you can still download items one at a time.
- **Merging video and audio** uses [Mediabunny](https://github.com/Vanilagy/mediabunny), a JavaScript library for reading and writing media files in the browser. It's the library reddit-video-grabber already uses successfully. It copies the streams without re-encoding, so merging is fast and the quality doesn't change. It's MPL-2.0 licensed, so its licence file ships alongside it.
- **Save location:** `Downloads/reddit-media/<thread>/`, with one folder per thread and no deeper nesting. The folder name is human readable and unique: subreddit, post ID, then a shortened version of the post title, for example `pics_1abc23_my-cat-is-plotting-something`. Chrome extensions can only save inside the Downloads folder.

## Installing

Giga Reddit isn't on the Chrome Web Store. To install it from this repository:

1. Open `brave://extensions` (or `chrome://extensions` in Chrome).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this repository's folder.

There's no build step. The repository folder is the extension.

## Licence

See [LICENCE](LICENCE).

**El. Psy. Kongroo.**
