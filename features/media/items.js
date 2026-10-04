// Turns the raw links content.js finds into a tidy list of things to download:
// adverts dropped, duplicates merged, previews upgraded to originals, and every
// item given a file name. Pure: no DOM, no chrome.*.

import { threadName } from '../../shared/names.js';

/** The thread's folder under Downloads. */
export function mediaFolder(post) {
  return `reddit-media/${threadName(post)}`;
}

/**
 * The full-size i.redd.it original for a Reddit image URL, or null if it isn't
 * one. Previews are named "<slug>-v0-<id>.<ext>" or "<id>.<ext>", and the
 * original is i.redd.it/<id>.<ext> (true for every pair seen on the live site).
 * Video thumbnails (vthumb) and avatars (snoovatar) aren't content, so they
 * give null.
 */
export function fullSizeImage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname === 'i.redd.it') return parsed.origin + parsed.pathname;
  if (parsed.hostname !== 'preview.redd.it') return null;
  if (parsed.searchParams.has('vthumb') || parsed.pathname.includes('/snoovatar/')) return null;
  const name = parsed.pathname.slice(1).split('-v0-').pop();
  return /^[a-z0-9]+\.[a-z0-9]+$/i.test(name) ? `https://i.redd.it/${name}` : null;
}

/**
 * The v.redd.it ID in a player's HLS playlist URL. Post videos use
 * v.redd.it/<id>/HLSPlaylist.m3u8 and comment videos
 * v.redd.it/link/<post>/asset/<id>/HLSPlaylist.m3u8.
 */
export function videoId(url) {
  const match = /^https:\/\/v\.redd\.it\/(?:link\/[^/]+\/asset\/)?([a-z0-9]+)\/HLSPlaylist\.m3u8/i.exec(url || '');
  return match ? match[1] : null;
}

/**
 * Builds the download list from a scan: the post's own media first, then the
 * comments' in page order.
 * @returns {{ kind: 'video'|'image', url: string, fallbackUrl: string|null,
 *   poster: string|null, commentId: string|null, filename: string }[]}
 */
export function buildItems(scan) {
  const items = [];
  const seen = new Set();
  const add = (key, item) => {
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };
  const short = id => (id || '').replace(/^t\d_/, '');
  const fileOf = url => new URL(url).pathname.slice(1);

  const videos = scan.players.filter(p => !p.promoted && p.postId === scan.post.id && videoId(p.src));
  const video = player => {
    const id = videoId(player.src);
    const owner = player.commentId ? `comment_${short(player.commentId)}` : 'post';
    add(`video:${id}`, {
      kind: 'video', url: player.src, fallbackUrl: null, poster: player.poster || null,
      commentId: player.commentId || null, filename: `${owner}_${id}.mp4`,
    });
  };
  const image = (src, commentId, label) => {
    const full = fullSizeImage(src);
    if (!full) return;
    add(`image:${fileOf(full)}`, {
      kind: 'image', url: full, fallbackUrl: full === src ? null : src, poster: null,
      commentId, filename: `${label}_${fileOf(full)}`,
    });
  };

  videos.filter(p => !p.commentId).forEach(video);
  image(scan.contentHref, null, 'post');
  const pad = String(scan.galleryImages.length).length;
  scan.galleryImages.forEach((src, i) => image(src, null, `post_${String(i + 1).padStart(pad, '0')}`));
  videos.filter(p => p.commentId).forEach(video);
  for (const { src, commentId } of scan.commentImages) {
    image(src, commentId, commentId ? `comment_${short(commentId)}` : 'comment');
  }
  return items;
}
