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
- The exact cookies that make up a Reddit login still need to be confirmed against the live site before implementation.

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

One click exports the current Reddit thread, including its metadata, in a form that LLMs and other tools can read easily.

- The data is read from the rendered page (the DOM), not from Reddit's `.json` endpoints.
- It's based on the capture code in lemon-chat's `save-reddit` extension (see [references](references/README.md)). That code is extended to capture more metadata: timestamps, OP markers, flair, edited status and upvote ratio, along with author, score, depth and permalink.
- Formats:
  - **Markdown** for pasting into an LLM chat: the post first, then nested comments with metadata on each one.
  - **JSON** for other tools.
- Output can be **copied to the clipboard** or **saved as a file**.
- Scores come from what Reddit displays. Reddit deliberately fuzzes vote counts, and doesn't show true upvote and downvote counts.
- *Undecided:* whether hidden comments ("more replies") are expanded automatically and how far; whether profile and subreddit listing pages are supported; whether the JSON matches lemon-chat's import format.

## Licence

See [LICENCE](LICENCE).
