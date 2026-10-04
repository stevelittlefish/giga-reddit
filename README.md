<p align="center">
  <img src="docs/mascot.png" alt="The Giga Reddit mascot: an armoured robot Snoo in a red cape" width="360">
</p>

# Giga Reddit

A Chrome extension for Reddit that lets you switch between accounts easily, export threads as Markdown for pasting into LLM conversations, and download the images and videos from posts.

## Features

### Account switcher

Save several Reddit accounts and switch between them from the toolbar, without logging out or typing passwords. The toolbar icon and a coloured marker on the page show which account you're on, and a "Posting as" label appears next to comment and post boxes.

To add an account, click **Log in another**, log in, then click **Save account**. Don't use Reddit's own "Log Out": it ends the saved session, and you'll have to log in to that account again.

Saved logins never leave your browser. As with any site you stay logged into, someone using your browser could switch to them.

### Page export

Export a comment thread (the post and its comments) as Markdown to paste into an LLM chat, or as JSON. Copy it to the clipboard or save it as a file. It expands hidden replies first, up to a limit you can set, so very large threads may not be captured in full.

### Media downloader

Download the images, GIFs and videos from a thread, including those in comments and every image in a gallery. Reddit videos are saved with their sound. Files go to `Downloads/reddit-media/`, in a folder for each thread. Media linked from other sites, such as Imgur or YouTube, isn't downloaded.

## Installing

Giga Reddit isn't on the Chrome Web Store. To install it from this repository:

1. Open `brave://extensions` (or `chrome://extensions` in Chrome).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this repository's folder.

There's no build step. The repository folder is the extension.

## Licence

See [LICENCE](LICENCE).

**El. Psy. Kongroo.**
