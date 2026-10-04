// Checks items.js with scans shaped like the ones content.js returns, using URLs
// seen on live Reddit threads (signatures shortened).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildItems, fullSizeImage, mediaFolder, videoId } from '../../../features/media/items.js';

const scan = (extra = {}) => ({
  post: { id: 't3_1wst7wd', title: 'Posters in Arbury', subreddit: 'cambridge' },
  contentHref: null,
  players: [],
  galleryImages: [],
  commentImages: [],
  ...extra,
});

test('previews upgrade to their i.redd.it originals', () => {
  assert.equal(
    fullSizeImage('https://preview.redd.it/random-shots-from-this-morning-v0-hsr6ql0ttgth1.jpg?width=640&crop=smart&auto=webp&s=4fa1'),
    'https://i.redd.it/hsr6ql0ttgth1.jpg',
  );
  assert.equal(fullSizeImage('https://preview.redd.it/abc123.png?width=320&s=x'), 'https://i.redd.it/abc123.png');
  assert.equal(fullSizeImage('https://i.redd.it/nppm94mk9csh1.jpeg'), 'https://i.redd.it/nppm94mk9csh1.jpeg');
});

test('thumbnails, avatars, other hosts and junk are not images', () => {
  assert.equal(fullSizeImage('https://preview.redd.it/duwg8xxrajsh1.jpg?vthumb=1&s=95ca'), null);
  assert.equal(fullSizeImage('https://preview.redd.it/snoovatar/avatars/7e14-headshot.png?width=64&s=c6c0'), null);
  assert.equal(fullSizeImage('https://external-preview.redd.it/Z2Jq.png?format=pjpg'), null);
  assert.equal(fullSizeImage('https://v.redd.it/cqvx5mrsnbjh1'), null);
  assert.equal(fullSizeImage(null), null);
});

test('video IDs come out of post and comment playlist URLs', () => {
  assert.equal(videoId('https://v.redd.it/cqvx5mrsnbjh1/HLSPlaylist.m3u8?f=sd&a=1,sig'), 'cqvx5mrsnbjh1');
  assert.equal(videoId('https://v.redd.it/link/1wst7wd/asset/duwg8xxrajsh1/HLSPlaylist.m3u8?a=1,sig'), 'duwg8xxrajsh1');
  assert.equal(videoId('https://v.redd.it/cqvx5mrsnbjh1/CMAF_96.mp4'), null);
});

test('thread folder is readable and unique', () => {
  assert.equal(mediaFolder(scan().post), 'reddit-media/cambridge_1wst7wd_posters-in-arbury');
});

test('image post with comment videos and comment images', () => {
  const items = buildItems(scan({
    contentHref: 'https://i.redd.it/nppm94mk9csh1.jpeg',
    players: [
      { src: 'https://v.redd.it/link/1wst7wd/asset/duwg8xxrajsh1/HLSPlaylist.m3u8?a=1,sig', postId: 't3_1wst7wd', commentId: 't1_pcvu3fg', promoted: false, poster: 'https://preview.redd.it/duwg8xxrajsh1.jpg?vthumb=1' },
      { src: 'https://v.redd.it/link/1wst7wd/asset/y593r43gbjsh1/HLSPlaylist.m3u8?a=1,sig', postId: 't3_1wst7wd', commentId: 't1_pcvutpc', promoted: false, poster: null },
    ],
    commentImages: [
      { src: 'https://preview.redd.it/posters-in-arbury-v0-96u6cg7ubjsh1.jpeg?width=320&s=3a99', commentId: 't1_abc' },
      { src: 'https://preview.redd.it/snoovatar/avatars/x-headshot.png?width=64', commentId: 't1_abc' },
    ],
  }));
  assert.deepEqual(items.map(i => [i.kind, i.filename]), [
    ['image', 'post_nppm94mk9csh1.jpeg'],
    ['video', 'comment_pcvu3fg_duwg8xxrajsh1.mp4'],
    ['video', 'comment_pcvutpc_y593r43gbjsh1.mp4'],
    ['image', 'comment_abc_96u6cg7ubjsh1.jpeg'],
  ]);
  assert.equal(items[0].fallbackUrl, null);
  assert.equal(items[3].url, 'https://i.redd.it/96u6cg7ubjsh1.jpeg');
  assert.equal(items[3].fallbackUrl, 'https://preview.redd.it/posters-in-arbury-v0-96u6cg7ubjsh1.jpeg?width=320&s=3a99');
});

test('video post: its own player first, adverts and duplicates dropped', () => {
  const own = { src: 'https://v.redd.it/cqvx5mrsnbjh1/HLSPlaylist.m3u8?f=sd&a=1,sig', postId: 't3_1wst7wd', commentId: null, promoted: false, poster: 'p.png' };
  const advert = { src: 'https://v.redd.it/uq8vxpx9nbsh1/HLSPlaylist.m3u8?a=1,sig', postId: 't3_1wsq27c', commentId: null, promoted: true, poster: null };
  const items = buildItems(scan({ contentHref: 'https://v.redd.it/cqvx5mrsnbjh1', players: [advert, own, { ...own }] }));
  assert.deepEqual(items.map(i => i.filename), ['post_cqvx5mrsnbjh1.mp4']);
  assert.equal(items[0].poster, 'p.png');
});

test('a promoted player is dropped even if it claims to be ours', () => {
  const sneaky = { src: 'https://v.redd.it/uq8vxpx9nbsh1/HLSPlaylist.m3u8', postId: 't3_1wst7wd', commentId: null, promoted: true, poster: null };
  assert.deepEqual(buildItems(scan({ players: [sneaky] })), []);
});

test('gallery slides are numbered in order', () => {
  const items = buildItems(scan({
    galleryImages: Array.from({ length: 10 }, (_, i) => `https://i.redd.it/img${i}.jpg`),
  }));
  assert.equal(items.length, 10);
  assert.equal(items[0].filename, 'post_01_img0.jpg');
  assert.equal(items[9].filename, 'post_10_img9.jpg');
});
