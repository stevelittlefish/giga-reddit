// Reads the HLS playlists Reddit's video player uses (v.redd.it HLSPlaylist.m3u8)
// and works out which whole MP4 files to fetch. Pure: no DOM, no chrome.*.
//
// What the live site serves (checked in Brave, October 2026):
// - The master playlist lists video variants (#EXT-X-STREAM-INF, each followed by
//   its playlist URI) and audio tracks (#EXT-X-MEDIA TYPE=AUDIO). Each video
//   variant appears once per audio group. Only the master URL is signed; the
//   relative URIs inside it resolve to unsigned URLs that load fine.
// - Each media playlist is byte ranges of one fragmented MP4 (#EXT-X-MAP plus
//   segments all naming the same file), and those ranges cover the whole file.
//   So one plain GET of that file gets the entire stream.
// - Variant names like CMAF_1080 give the short side, not the height, so rank
//   by RESOLUTION and BANDWIDTH instead.

/** Splits an HLS attribute list (KEY=value,KEY="quoted, value") into an object. */
export function parseAttributes(text) {
  const attrs = {};
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  for (const [, key, raw] of text.matchAll(re)) {
    attrs[key] = raw.startsWith('"') ? raw.slice(1, -1) : raw;
  }
  return attrs;
}

/**
 * Parses a master playlist. URIs are resolved against baseUrl.
 * @returns {{ variants: object[], audio: object[] }}
 */
export function parseMaster(text, baseUrl) {
  const variants = [];
  const audio = [];
  const lines = text.split(/\r?\n/).map(line => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const a = parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
      const uri = lines.slice(i + 1).find(next => next && !next.startsWith('#'));
      if (!uri) continue;
      const [width, height] = (a.RESOLUTION || '0x0').split('x').map(Number);
      variants.push({
        url: new URL(uri, baseUrl).href,
        width,
        height,
        bandwidth: Number(a.BANDWIDTH) || 0,
        codecs: a.CODECS || '',
        audioGroup: a.AUDIO || null,
      });
    } else if (line.startsWith('#EXT-X-MEDIA:')) {
      const a = parseAttributes(line.slice('#EXT-X-MEDIA:'.length));
      if (a.TYPE !== 'AUDIO' || !a.URI) continue;
      audio.push({
        url: new URL(a.URI, baseUrl).href,
        groupId: a['GROUP-ID'] || null,
        isDefault: a.DEFAULT === 'YES',
      });
    }
  }
  return { variants, audio };
}

/**
 * Picks the best video variant and the audio track that goes with it.
 * The biggest picture wins; among entries for that picture, the highest
 * bandwidth wins, and its audio group decides the audio. Audio is null when the
 * video has none.
 * @returns {{ video: object, audio: object|null } | null}
 */
export function pickBest({ variants, audio }) {
  if (!variants.length) return null;
  const pixels = v => v.width * v.height;
  const video = variants.reduce((best, v) =>
    pixels(v) > pixels(best) || (pixels(v) === pixels(best) && v.bandwidth > best.bandwidth) ? v : best);
  const group = audio.filter(a => a.groupId === video.audioGroup);
  const chosenAudio = group.find(a => a.isDefault) || group[0] || null;
  return { video, audio: chosenAudio };
}

/**
 * Finds the single file behind a media playlist. Returns its absolute URL, or
 * null if the playlist uses more than one file (Reddit doesn't, so far).
 */
export function singleFileUrl(text, baseUrl) {
  const uris = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-MAP:')) {
      const { URI } = parseAttributes(line.slice('#EXT-X-MAP:'.length));
      if (URI) uris.add(new URL(URI, baseUrl).href);
    } else if (!line.startsWith('#')) {
      uris.add(new URL(line, baseUrl).href);
    }
  }
  return uris.size === 1 ? [...uris][0] : null;
}
