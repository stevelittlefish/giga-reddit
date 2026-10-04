// The service worker. Its only job is to summon each feature's background
// module. The minions do the actual work; this file just signs the forms.

import { initAccounts } from './features/accounts/background.js';

initAccounts();
