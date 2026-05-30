// SPDX-License-Identifier: AGPL-3.0-only

// Re-export of the canonical registry that now lives in shared/. Existing
// imports of `../languages` keep working; new code should import directly
// from 'shared'.
export { LANGUAGES, isLanguage } from 'shared';
export type { Language, LanguageOption } from 'shared';
