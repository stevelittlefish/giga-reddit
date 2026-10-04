// The popup. Each feature brings its own section; this file just wakes them up.

import { initAccounts } from '../features/accounts/popup.js';
import { initExport } from '../features/export/popup.js';
import { initMedia } from '../features/media/popup.js';

initAccounts(document.getElementById('accounts'));
initExport(document.getElementById('export'));
initMedia(document.getElementById('media'));
