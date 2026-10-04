// Feeds hls.js the playlists a real v.redd.it comment video served (signature
// trimmed off the master URL), plus a few made-up edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAttributes, parseMaster, pickBest, singleFileUrl,
} from '../../../features/media/hls.js';

const BASE = 'https://v.redd.it/link/1wst7wd/asset/duwg8xxrajsh1/';
const MASTER_URL = BASE + 'HLSPlaylist.m3u8?f=hd%2CsubsAll%2ChlsSpecOrder&v=1&a=1793718308%2Csig';

const MASTER = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-MEDIA:URI="CMAF_AUDIO_128.m3u8",TYPE=AUDIO,GROUP-ID="6",NAME="audio 0",DEFAULT=YES,AUTOSELECT=YES
#EXT-X-MEDIA:URI="CMAF_AUDIO_64.m3u8",TYPE=AUDIO,GROUP-ID="7",NAME="audio 0",DEFAULT=YES,AUTOSELECT=YES
#EXT-X-MEDIA:URI="wh_ben_en/index.m3u8",TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="en",NAME="English",DEFAULT=NO,AUTOSELECT=NO,FORCED="NO"
#EXT-X-STREAM-INF:PROGRAM-ID=0,CLOSED-CAPTIONS=NONE,BANDWIDTH=1368482,AVERAGE-BANDWIDTH=1228793,RESOLUTION=480x854,FRAME-RATE=30,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="6",SUBTITLES="subs"
CMAF_480.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=0,CLOSED-CAPTIONS=NONE,BANDWIDTH=375294,AVERAGE-BANDWIDTH=335357,RESOLUTION=220x392,FRAME-RATE=30,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="6",SUBTITLES="subs"
CMAF_220.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=0,CLOSED-CAPTIONS=NONE,BANDWIDTH=2517698,AVERAGE-BANDWIDTH=2217591,RESOLUTION=720x1280,FRAME-RATE=30,CODECS="avc1.4d401f,mp4a.40.2",AUDIO="6",SUBTITLES="subs"
CMAF_720.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=0,CLOSED-CAPTIONS=NONE,BANDWIDTH=5175946,AVERAGE-BANDWIDTH=4557410,RESOLUTION=1080x1920,FRAME-RATE=30,CODECS="avc1.640028,mp4a.40.2",AUDIO="6",SUBTITLES="subs"
CMAF_1080.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=0,CLOSED-CAPTIONS=NONE,BANDWIDTH=311589,AVERAGE-BANDWIDTH=271635,RESOLUTION=220x392,FRAME-RATE=30,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="7",SUBTITLES="subs"
CMAF_220.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=0,CLOSED-CAPTIONS=NONE,BANDWIDTH=5112241,AVERAGE-BANDWIDTH=4493688,RESOLUTION=1080x1920,FRAME-RATE=30,CODECS="avc1.640028,mp4a.40.2",AUDIO="7",SUBTITLES="subs"
CMAF_1080.m3u8
`;

const AUDIO_128 = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:5
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="CMAF_AUDIO_128.mp4",BYTERANGE="833@0"
#EXTINF:4.011,
#EXT-X-BYTERANGE:65407@913
CMAF_AUDIO_128.mp4
#EXTINF:3.989,
#EXT-X-BYTERANGE:64554
CMAF_AUDIO_128.mp4
#EXTINF:1.943,
#EXT-X-BYTERANGE:31987
CMAF_AUDIO_128.mp4
#EXT-X-ENDLIST
`;

test('attribute lists keep commas inside quotes', () => {
  assert.deepEqual(
    parseAttributes('BANDWIDTH=375294,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="6"'),
    { BANDWIDTH: '375294', CODECS: 'avc1.4d401e,mp4a.40.2', AUDIO: '6' },
  );
});

test('master playlist: variants and audio resolve to unsigned URLs', () => {
  const { variants, audio } = parseMaster(MASTER, MASTER_URL);
  assert.equal(variants.length, 6);
  assert.deepEqual(variants[0], {
    url: BASE + 'CMAF_480.m3u8', width: 480, height: 854, bandwidth: 1368482,
    codecs: 'avc1.4d401f,mp4a.40.2', audioGroup: '6',
  });
  assert.deepEqual(audio.map(a => [a.url, a.groupId]), [
    [BASE + 'CMAF_AUDIO_128.m3u8', '6'],
    [BASE + 'CMAF_AUDIO_64.m3u8', '7'],
  ]);
});

test('best pick: biggest picture, and the better audio group that goes with it', () => {
  const best = pickBest(parseMaster(MASTER, MASTER_URL));
  assert.equal(best.video.url, BASE + 'CMAF_1080.m3u8');
  assert.equal(best.video.height, 1920);
  assert.equal(best.audio.url, BASE + 'CMAF_AUDIO_128.m3u8');
});

test('a video with no audio tracks gets audio: null', () => {
  const silent = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=720x1280,CODECS="avc1.4d401f"
CMAF_720.m3u8
`;
  const best = pickBest(parseMaster(silent, MASTER_URL));
  assert.equal(best.video.url, BASE + 'CMAF_720.m3u8');
  assert.equal(best.audio, null);
});

test('a playlist with no variants picks nothing', () => {
  assert.equal(pickBest(parseMaster('#EXTM3U\n', MASTER_URL)), null);
});

test('media playlist made of byte ranges of one file gives that file', () => {
  assert.equal(singleFileUrl(AUDIO_128, BASE + 'CMAF_AUDIO_128.m3u8'), BASE + 'CMAF_AUDIO_128.mp4');
});

test('media playlist split across several files gives null', () => {
  const split = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\nseg1.m4s\n#EXTINF:4,\nseg2.m4s\n';
  assert.equal(singleFileUrl(split, BASE), null);
});
