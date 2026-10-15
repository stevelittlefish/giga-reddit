// Remembers what was last right-clicked, so the "Copy thread down to this
// comment" menu item knows which comment was meant. Chrome's menu click doesn't
// say. Loaded on every Reddit page by the manifest; it watches and nothing else.

var giga = globalThis.giga || (globalThis.giga = {});
giga.export = giga.export || {};

if (!giga.export.menuWatching) {
  giga.export.menuWatching = true;
  // Capture phase, so nothing on the page can stop the event before we see it.
  document.addEventListener('contextmenu', event => { giga.export.menuTarget = event.target; }, true);
}
