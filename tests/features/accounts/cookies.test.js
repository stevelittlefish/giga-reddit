// Makes sure cookies come back out the way chrome.cookies.set expects them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, cookieUrl, isExpired, toSetDetails } from '../../../features/accounts/cookies.js';

const domainCookie = {
  name: 'token', value: 'abc', domain: '.reddit.com', hostOnly: false, path: '/',
  secure: true, httpOnly: true, sameSite: 'no_restriction', session: false,
  expirationDate: 2000000000, storeId: '0',
};
const hostCookie = {
  name: 'pref', value: 'x', domain: 'www.reddit.com', hostOnly: true, path: '/r/',
  secure: false, httpOnly: false, sameSite: 'unspecified', session: true, storeId: '0',
};

test('snapshot keeps restore fields and drops storeId', () => {
  const [saved] = snapshot([domainCookie]);
  assert.equal(saved.storeId, undefined);
  assert.equal(saved.value, 'abc');
  assert.equal(saved.expirationDate, 2000000000);
});

test('cookieUrl drops the leading dot and follows secure', () => {
  assert.equal(cookieUrl(domainCookie), 'https://reddit.com/');
  assert.equal(cookieUrl(hostCookie), 'http://www.reddit.com/r/');
});

test('isExpired', () => {
  assert.equal(isExpired(domainCookie, 1999999999), false);
  assert.equal(isExpired(domainCookie, 2000000000), true);
  assert.equal(isExpired(hostCookie, Infinity), false);
});

test('a domain cookie keeps its domain, sameSite and expiry', () => {
  assert.deepEqual(toSetDetails(domainCookie), {
    url: 'https://reddit.com/', name: 'token', value: 'abc', path: '/', secure: true,
    httpOnly: true, domain: '.reddit.com', sameSite: 'no_restriction', expirationDate: 2000000000,
  });
});

test('a host-only session cookie gets no domain, sameSite or expiry', () => {
  assert.deepEqual(toSetDetails(hostCookie), {
    url: 'http://www.reddit.com/r/', name: 'pref', value: 'x', path: '/r/', secure: false, httpOnly: false,
  });
});
