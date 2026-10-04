// Checks we can tell who's who from where Reddit's /user/me/ redirect lands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nameFromProfileUrl, sameName, pickColour, badgeText, COLOURS,
} from '../../../features/accounts/identity.js';

test('reads the name from the profile URL the redirect lands on', () => {
  assert.equal(nameFromProfileUrl('https://www.reddit.com/user/Evil_Overlord_42/'), 'Evil_Overlord_42');
  assert.equal(nameFromProfileUrl('https://reddit.com/u/some-one_2?x=1'), 'some-one_2');
});

test('anything other than a profile means nobody', () => {
  assert.equal(nameFromProfileUrl('https://www.reddit.com/login/?dest=x'), null);
  assert.equal(nameFromProfileUrl('https://www.reddit.com/user/me/'), null);
  assert.equal(nameFromProfileUrl('https://evil.example/user/Bob/'), null);
  assert.equal(nameFromProfileUrl(''), null);
});

test('sameName ignores case and refuses nobody', () => {
  assert.equal(sameName('Bob', 'bOB'), true);
  assert.equal(sameName('Bob', 'Rob'), false);
  assert.equal(sameName(null, null), false);
});

test('pickColour hands out unused colours, then recycles', () => {
  assert.equal(pickColour([]), COLOURS[0]);
  assert.equal(pickColour([COLOURS[0], COLOURS[2]]), COLOURS[1]);
  assert.ok(COLOURS.includes(pickColour([...COLOURS, ...COLOURS])));
});

test('badgeText', () => {
  assert.equal(badgeText('Evil_Overlord_42'), 'Evi');
  assert.equal(badgeText(null), '');
});
