// SPDX-License-Identifier: AGPL-3.0-only
//
// Post-build step: tsc only emits .js, so the i18n JSON files (questions +
// prose templates) are not carried into dist/. i18n/index.ts loads them at
// runtime via createRequire('./en.json'), so they must sit next to the
// compiled index.js. Run from the server/ workspace root (npm sets cwd).

import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist/i18n', { recursive: true });
for (const file of ['en.json', 'ru.json']) {
  copyFileSync(`src/i18n/${file}`, `dist/i18n/${file}`);
}
console.log('[build] copied i18n JSON -> server/dist/i18n');
