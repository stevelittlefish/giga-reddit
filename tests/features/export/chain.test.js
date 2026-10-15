// Checks that chain.js climbs from a comment to the post without falling off,
// looping, or picking up strangers along the way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCommentId, isComplete, nextPage, extendChain } from '../../../features/export/chain.js';

const comment = (id, parentId) => ({ id, parentId, parentPermalink: parentId ? `/r/test/comments/abc/comment/${parentId.slice(3)}/` : null });

test('comment IDs are t1_, posts and missing parents are not', () => {
  assert.equal(isCommentId('t1_abc'), true);
  assert.equal(isCommentId('t3_abc'), false);
  assert.equal(isCommentId(null), false);
});

test('a chain is complete once its top comment has no comment above it', () => {
  assert.equal(isComplete([comment('t1_c', 't1_b'), comment('t1_b', null)]), true);
  assert.equal(isComplete([comment('t1_c', 't1_b'), comment('t1_b', 't3_post')]), true);
  assert.equal(isComplete([comment('t1_c', 't1_b')]), false);
  assert.equal(isComplete([]), false);
});

test('the next page is the top comment\'s parent page, until the chain is complete', () => {
  assert.equal(nextPage([comment('t1_c', 't1_b')]), '/r/test/comments/abc/comment/b/');
  assert.equal(nextPage([comment('t1_c', null)]), null);
  assert.equal(nextPage([{ id: 't1_c', parentId: 't1_b', parentPermalink: null }]), null);
});

test('extending follows parents upwards and ignores siblings and the chain\'s own comments', () => {
  const chain = [comment('t1_e', 't1_d'), comment('t1_d', 't1_c')];
  const found = [
    comment('t1_a', null), comment('t1_b', 't1_a'), comment('t1_x', 't1_a'),
    comment('t1_c', 't1_b'), comment('t1_d', 't1_c'),
  ];
  const longer = extendChain(chain, found);
  assert.deepEqual(longer.map(c => c.id), ['t1_e', 't1_d', 't1_c', 't1_b', 't1_a']);
  assert.equal(chain.length, 2, 'the original chain is untouched');
});

test('extending stops at a gap and never loops', () => {
  assert.deepEqual(extendChain([comment('t1_c', 't1_b')], [comment('t1_a', null)]).map(c => c.id), ['t1_c']);
  const loop = extendChain([comment('t1_c', 't1_b')], [comment('t1_b', 't1_a'), comment('t1_a', 't1_b')]);
  assert.deepEqual(loop.map(c => c.id), ['t1_c', 't1_b', 't1_a']);
});
