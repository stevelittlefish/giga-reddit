// Glues Reddit's separate video and audio streams into one ordinary MP4 by
// copying the encoded packets across with Mediabunny. Nothing is re-encoded, so
// it's quick and the quality is untouched. No DOM, no chrome.*, so node --test
// can run it on real files.

import {
  Input, Output, BufferSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS,
  EncodedPacketSink, EncodedVideoPacketSource, EncodedAudioPacketSource,
} from '../../vendor/mediabunny/mediabunny.min.mjs';

/**
 * Merges a video stream and an optional audio stream (each a whole MP4 file)
 * into one MP4. With no audio, the video is still rewritten as a plain MP4,
 * since Reddit's fragmented files play badly in some players.
 * @param {ArrayBuffer|Uint8Array} videoBytes
 * @param {ArrayBuffer|Uint8Array|null} audioBytes
 * @returns {Promise<Uint8Array>}
 */
export async function mux(videoBytes, audioBytes) {
  const videoTrack = await (await open(videoBytes)).getPrimaryVideoTrack();
  if (!videoTrack) throw new Error('The video stream has no video in it.');
  const audioTrack = audioBytes ? await (await open(audioBytes)).getPrimaryAudioTrack() : null;
  if (audioBytes && !audioTrack) throw new Error('The audio stream has no audio in it.');

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });
  const videoSource = new EncodedVideoPacketSource(videoTrack.codec);
  output.addVideoTrack(videoSource);
  let audioSource = null;
  if (audioTrack) {
    audioSource = new EncodedAudioPacketSource(audioTrack.codec);
    output.addAudioTrack(audioSource);
  }

  await output.start();
  await Promise.all([
    copyPackets(videoTrack, videoSource),
    audioTrack && copyPackets(audioTrack, audioSource),
  ]);
  await output.finalize();
  return new Uint8Array(output.target.buffer);
}

async function open(bytes) {
  return new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
}

async function copyPackets(track, source) {
  const decoderConfig = await track.getDecoderConfig();
  let first = true;
  for await (const packet of new EncodedPacketSink(track).packets()) {
    await source.add(packet, first ? { decoderConfig } : undefined);
    first = false;
  }
  source.close();
}
