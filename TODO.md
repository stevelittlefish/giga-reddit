# TODO

High-level plan for Giga Reddit. Tick items off as they land. The features are
described in the [README](README.md), and the working rules are in
[AGENTS.md](AGENTS.md).

## Foundations

- [x] Skeleton extension: manifest, service worker, empty popup, icons. Loads unpacked in Brave and does nothing.
- [x] Test setup under `tests/` (see AGENTS.md for the command).
- [x] Shared "more replies" expander for hidden comments, used by page export and the media downloader.

## Page export

- [x] Capture the post and comments from the rendered page, including the extra metadata. Edited status and author flair are still missing (see open questions).
- [x] Markdown output.
- [x] JSON output.
- [x] Copy to clipboard and save as a file from the popup.

## Media downloader

- [x] Vendor Mediabunny.
- [ ] Find media by watching the tab's network requests and scanning the page. Page scanning is written (`features/media/content.js` and `items.js`) but not yet connected to the popup or tried on the live site. Network watching hasn't started.
- [ ] Merge Reddit video and audio into one MP4, falling back to separate files.
- [ ] Popup list with per-item downloads, "download everything" and a badge count.

## Account switcher

- [ ] Save and restore each account's Reddit cookies, encrypted.
- [ ] Switch accounts without logging out, re-saving the current account first.
- [ ] Show the active account: toolbar badge, page marker and the "Posting as" label.

## Later

- [ ] Page export: include the post's own images and gallery links. A gallery post currently exports its text only (comment images already come through). Reuse the media downloader's gallery finding once it exists.
- [ ] Media: post video players carry a `packaged-media-json` attribute listing ready-made MP4s with audio included (`packaged-media.redd.it`). Comment players don't. It could be a backup if merging fails.

## Open questions

- [x] Confirm the reddit-video-grabber source is available on this machine. It is, at `~/scratch/reddit-video-grabber`.
- [ ] Find a reliable way to read the logged-in username on current Reddit.
- [ ] Big threads only show about 100 comments at first and load more as you scroll. Find out how, so export and the media downloader can get the rest.
- [ ] Find the markup for edited comments and comment author flair, so export can include them.
- [ ] Decide what to do about "More replies" links (Reddit's continue-thread links), which open a separate page instead of loading in place.
- [ ] Check whether Reddit refreshes session cookies after they've been saved.
- [ ] Big galleries: check that every slide is in the page before you click through. The carousel has `fetch-ahead-count="3"`, which hints that it might not be.
