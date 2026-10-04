// Seals saved sessions with AES-GCM before they go into chrome.storage.local.
//
// The key is built into the extension, so this is a padlock on a garden shed:
// it stops generic scripts that hoover plain-text cookies out of browser
// profile files, and nothing more. Anyone reading this source has the key.
// See the README's "Storage and security".

const KEY_BYTES = new Uint8Array([
  0x7b, 0xed, 0xec, 0xa3, 0x45, 0x09, 0x7c, 0x29, 0xaa, 0xa6, 0x21, 0x51, 0x9e, 0xfd, 0x42, 0xff,
  0x90, 0x90, 0xd2, 0x11, 0xbd, 0xb4, 0xb6, 0x9d, 0xb9, 0xa5, 0x42, 0xf7, 0x1c, 0xe7, 0x4c, 0x2c,
]);
const VERSION = 1;

let keyPromise;
function key() {
  keyPromise ??= crypto.subtle.importKey('raw', KEY_BYTES, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return keyPromise;
}

/** Encrypts any JSON-able value into a storable { v, iv, data } box. */
export async function seal(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), plain);
  return { v: VERSION, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/** Reverses seal. Throws if the box was tampered with or isn't ours. */
export async function unseal(box) {
  if (!box || box.v !== VERSION) throw new Error('Unknown saved session format.');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(box.iv) }, await key(), fromBase64(box.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}
