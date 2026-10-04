// The popup. Each feature brings its own section; this file just wakes them up.

import { initExport } from '../features/export/popup.js';
import { initMedia } from '../features/media/popup.js';

initExport(document.getElementById('export'));
initMedia(document.getElementById('media'));
