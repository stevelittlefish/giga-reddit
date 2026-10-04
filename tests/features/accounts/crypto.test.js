// Checks the garden-shed padlock opens with our key and jams if anyone pokes it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal, unseal } from '../../../features/accounts/crypto.js';

const cookies = [{ name: 'a', value: 'secret ☃'.repeat(5000) }, { name: 'b', value: '' }];

test('seal and unseal round-trip', async () => {
  assert.deepEqual(await unseal(await seal(cookies)), cookies);
});

test('sealed boxes do not contain the plain text', async () => {
  const box = await seal({ value: 'hunter2' });
  assert.ok(!JSON.stringify(box).includes('hunter2'));
});

test('each seal uses a fresh IV', async () => {
  const [one, two] = [await seal(cookies), await seal(cookies)];
  assert.notEqual(one.iv, two.iv);
  assert.notEqual(one.data, two.data);
});

test('a tampered box refuses to open', async () => {
  const box = await seal(cookies);
  const flipped = (box.data[10] === 'A' ? 'B' : 'A');
  await assert.rejects(unseal({ ...box, data: box.data.slice(0, 10) + flipped + box.data.slice(11) }));
});

test('an unknown format refuses to open', async () => {
  await assert.rejects(unseal({ v: 99, iv: '', data: '' }), /format/);
  await assert.rejects(unseal(undefined), /format/);
});
