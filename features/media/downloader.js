// The download page. The popup finds the media, stashes the list in
// chrome.storage.session and opens this tab, which outlives the popup and does
// the slow part: fetching, merging video with its audio, and saving.

import { parseMaster, pickBest, singleFileUrl } from './hls.js';
import { mux } from './mux.js';

const WORKERS = 3;

const summary = document.getElementById('summary');
const list = document.getElementById('items');

// Blob URLs stay alive until Chrome has finished saving them.
const blobUrls = new Map();
chrome.downloads.onChanged.addListener(delta => {
  if (!delta.state || delta.state.current === 'in_progress' || !blobUrls.has(delta.id)) return;
  URL.revokeObjectURL(blobUrls.get(delta.id));
  blobUrls.delete(delta.id);
});

main().catch(error => {
  summary.textContent = `Something went wrong: ${error.message || error}`;
});

async function main() {
  const key = `media.job.${new URLSearchParams(location.search).get('job')}`;
  const job = (await chrome.storage.session.get(key))[key];
  if (!job) {
    summary.textContent = 'Nothing to download. Start again from the Giga Reddit button on a Reddit thread.';
    return;
  }
  // Gone once read, so reloading this tab doesn't download everything twice.
  await chrome.storage.session.remove(key);
  document.title = `Downloading: ${job.title || job.folder}`;

  const rows = job.items.map(item => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const state = document.createElement('span');
    name.textContent = item.filename;
    state.className = 'state';
    state.textContent = 'Waiting';
    li.append(name, state);
    list.append(li);
    return { item, li, state };
  });

  let finished = 0;
  let failed = 0;
  const progress = () => {
    summary.textContent = `${finished} of ${rows.length} done${failed ? `, ${failed} failed` : ''}. ` +
      `Saving to Downloads/${job.folder}/`;
  };
  progress();

  const queue = [...rows];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const say = text => (row.state.textContent = text);
      try {
        say(await (row.item.kind === 'video' ? saveVideo : saveImage)(row.item, job.folder, say));
        row.li.className = 'done';
      } catch (error) {
        say(`Failed: ${error.message || error}`);
        row.li.className = 'failed';
        failed++;
      }
      finished++;
      progress();
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));

  summary.textContent = failed
    ? `Finished, but ${failed} of ${rows.length} failed (see below). The rest are in Downloads/${job.folder}/`
    : `All ${rows.length} saved to Downloads/${job.folder}/`;
}

async function saveImage(item, folder, say) {
  say('Downloading…');
  let blob;
  try {
    blob = await fetchBlob(item.url);
  } catch (error) {
    if (!item.fallbackUrl) throw error;
    blob = await fetchBlob(item.fallbackUrl);
  }
  await save(blob, folder, item.filename);
  return 'Saved';
}

async function saveVideo(item, folder, say) {
  say('Reading the video playlist…');
  const masterUrl = item.url;
  const best = pickBest(parseMaster(await fetchText(masterUrl), masterUrl));
  if (!best) throw new Error('No video streams listed.');
  const videoFile = singleFileUrl(await fetchText(best.video.url), best.video.url);
  const audioFile = best.audio ? singleFileUrl(await fetchText(best.audio.url), best.audio.url) : null;
  if (!videoFile || (best.audio && !audioFile)) {
    throw new Error('This video is stored in a way the downloader does not handle yet.');
  }

  say(`Downloading ${best.video.width}×${best.video.height}${audioFile ? ' with sound' : ''}…`);
  const [videoBytes, audioBytes] = await Promise.all([
    fetchBytes(videoFile),
    audioFile ? fetchBytes(audioFile) : null,
  ]);

  say('Merging…');
  try {
    const merged = await mux(videoBytes, audioBytes);
    await save(new Blob([merged], { type: 'video/mp4' }), folder, item.filename);
    return audioBytes ? 'Saved' : 'Saved (this video has no sound)';
  } catch (error) {
    // Better two files than none.
    const base = item.filename.replace(/\.mp4$/, '');
    await save(new Blob([videoBytes], { type: 'video/mp4' }), folder, `${base}_video.mp4`);
    if (audioBytes) await save(new Blob([audioBytes], { type: 'audio/mp4' }), folder, `${base}_audio.m4a`);
    return `Merging failed (${error.message || error}), so the video and sound were saved as separate files`;
  }
}

async function save(blob, folder, filename) {
  const url = URL.createObjectURL(blob);
  const id = await chrome.downloads.download({ url, filename: `${folder}/${filename}`, conflictAction: 'uniquify' });
  blobUrls.set(id, url);
}

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`);
  return response;
}

const fetchText = async url => (await get(url)).text();
const fetchBytes = async url => new Uint8Array(await (await get(url)).arrayBuffer());
const fetchBlob = async url => (await get(url)).blob();
