// Runs mux.js on tiny fragmented MP4s (see tests/fixtures/media/README.md),
// then reads the result back with Mediabunny to check what came out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mux } from '../../../features/media/mux.js';
import { Input, BufferSource, ALL_FORMATS } from '../../../vendor/mediabunny/mediabunny.min.mjs';

const fixture = name => readFileSync(new URL(`../../fixtures/media/${name}`, import.meta.url));

async function tracksOf(bytes) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  return {
    video: await input.getPrimaryVideoTrack(),
    audio: await input.getPrimaryAudioTrack(),
    duration: await input.computeDuration(),
  };
}

test('video and audio streams merge into one MP4 with both tracks', async () => {
  const { video, audio, duration } = await tracksOf(await mux(fixture('video.mp4'), fixture('audio.mp4')));
  assert.equal(video.codec, 'avc');
  assert.equal(video.displayWidth, 64);
  assert.equal(audio.codec, 'aac');
  assert.ok(duration > 0.9 && duration < 1.2, `duration ${duration}`);
});

test('a video with no audio comes out as video only', async () => {
  const { video, audio } = await tracksOf(await mux(fixture('video.mp4'), null));
  assert.equal(video.codec, 'avc');
  assert.equal(audio, null);
});

test('audio passed off as video is refused', async () => {
  await assert.rejects(mux(fixture('audio.mp4'), null), /no video/);
});
