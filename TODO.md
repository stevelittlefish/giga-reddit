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
- [ ] Include the post's images and gallery links in the export. A gallery post currently exports as text only.

## Media downloader

- [ ] Vendor Mediabunny.
- [ ] Find media by watching the tab's network requests and scanning the page.
- [ ] Merge Reddit video and audio into one MP4, falling back to separate files.
- [ ] Popup list with per-item downloads, "download everything" and a badge count.

## Account switcher

- [ ] Save and restore each account's Reddit cookies, encrypted.
- [ ] Switch accounts without logging out, re-saving the current account first.
- [ ] Show the active account: toolbar badge, page marker and the "Posting as" label.

## Open questions

- [x] Confirm the reddit-video-grabber source is available on this machine. It is, at `~/scratch/reddit-video-grabber`.
- [ ] Find a reliable way to read the logged-in username on current Reddit.
- [ ] Big threads only show about 100 comments at first and load more as you scroll. Find out how, so export and the media downloader can get the rest.
- [ ] Find the markup for edited comments and comment author flair, so export can include them.
- [ ] Decide what to do about "More replies" links (Reddit's continue-thread links), which open a separate page instead of loading in place.
- [ ] Check whether Reddit refreshes session cookies after they've been saved.
