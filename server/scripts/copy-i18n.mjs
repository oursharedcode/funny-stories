// SPDX-License-Identifier: AGPL-3.0-only
//
// Post-build step: tsc only emits .js, so the i18n JSON files (questions +
// prose templates) are not carried into dist/. server/src/i18n/index.ts loads
// them at runtime via createRequire('./<code>.json'), so they must sit next
// to the compiled index.js. Run from the server/ workspace root (npm sets cwd).
//
// Discovers files dynamically — adding a language is a single drop-in of
// src/i18n/<code>.json with no change to this script.

import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

mkdirSync('dist/i18n', { recursive: true });
const files = readdirSync('src/i18n').filter((f) => f.endsWith('.json'));
for (const file of files) {
  copyFileSync(`src/i18n/${file}`, `dist/i18n/${file}`);
}
console.log(`[build] copied ${files.length} i18n JSON file(s) -> server/dist/i18n`);
