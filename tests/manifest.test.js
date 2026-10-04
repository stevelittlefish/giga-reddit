// Interrogates manifest.json before Chrome does. Chrome's error messages for a
// broken manifest are terse; ours at least name the missing file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

// Every file path the manifest mentions, wherever it hides.
function referencedFiles(m) {
  const files = [];
  if (m.background?.service_worker) files.push(m.background.service_worker);
  if (m.action?.default_popup) files.push(m.action.default_popup);
  files.push(...Object.values(m.action?.default_icon ?? {}));
  files.push(...Object.values(m.icons ?? {}));
  for (const cs of m.content_scripts ?? []) {
    files.push(...(cs.js ?? []), ...(cs.css ?? []));
  }
  return files;
}

test('manifest is Manifest V3', () => {
  assert.equal(manifest.manifest_version, 3);
});

test('service worker is an ES module', () => {
  assert.equal(manifest.background.type, 'module');
});

test('every file the manifest references exists', () => {
  for (const file of referencedFiles(manifest)) {
    assert.ok(existsSync(join(root, file)), `missing: ${file}`);
  }
});

test('nothing in the manifest points into references/', () => {
  for (const file of referencedFiles(manifest)) {
    assert.ok(!file.startsWith('references/'), `forbidden: ${file}`);
  }
});

test('every file page export injects exists', async () => {
  const { FILES } = await import('../features/export/popup.js');
  for (const file of FILES) {
    assert.ok(existsSync(join(root, file)), `missing: ${file}`);
  }
});
