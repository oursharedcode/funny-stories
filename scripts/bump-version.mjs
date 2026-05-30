// SPDX-License-Identifier: AGPL-3.0-only
//
// Bumps the user-visible version in client/package.json (the only version
// surfaced to players — see client/src/version.ts → SourceFooter). Optionally
// creates a commit and a git tag so the bump is part of the release record.
//
// Usage (from repo root):
//   node scripts/bump-version.mjs patch              → bumps file, stages, commits, tags
//   node scripts/bump-version.mjs minor --dry        → prints the next version, no writes
//   node scripts/bump-version.mjs major --no-git     → bumps file only, no commit/tag
//   node scripts/bump-version.mjs patch --ci-skip    → no-op on CI; bump locally
//
// Recommended via npm: `npm run version:patch` (also `version:minor`, `version:major`).
//
// After the script finishes, push with: `git push --follow-tags`.
//
// CI-skip notes. The client's `prebuild` hook calls this with `--ci-skip` so
// every local `npm run build` increments the patch component, but Render's
// build (CI=true) does not — Render therefore serves exactly the version
// committed in master, not master+1 in-process. The match between the
// displayed version on the deployed site and the committed value is what
// makes monotonic-across-deploys ergonomics work.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const bump = args[0];
const dryRun = args.includes('--dry');
const noGit = args.includes('--no-git');
const ciSkip = args.includes('--ci-skip');

if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(
    'Usage: node scripts/bump-version.mjs <patch|minor|major> [--dry] [--no-git] [--ci-skip]',
  );
  process.exit(1);
}

// Skip when running on Render / GitHub Actions / any CI that announces itself.
// The committed version stays the source of truth for deployed builds.
if (ciSkip && (process.env.CI === 'true' || process.env.RENDER === 'true')) {
  console.log('[bump-version] CI detected, skipping bump (--ci-skip).');
  process.exit(0);
}

// Resolve client/package.json relative to this script so the bump works
// regardless of cwd — `npm run build -w client` runs from the client workspace,
// `npm run version:patch` runs from the repo root, both must locate the same
// file.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(repoRoot, 'client', 'package.json');
const raw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);

const parts = pkg.version.split('.').map(Number);
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  console.error(`Cannot parse current version "${pkg.version}" as MAJOR.MINOR.PATCH`);
  process.exit(1);
}
const [maj, min, pat] = parts;

const next =
  bump === 'major'
    ? `${maj + 1}.0.0`
    : bump === 'minor'
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${pat + 1}`;

console.log(`Current: v${pkg.version} -> Next: v${next}`);

if (dryRun) {
  console.log('(--dry, no changes written)');
  process.exit(0);
}

// Preserve the file's original indentation and trailing newline.
const indent = raw.match(/^(\s+)"/m)?.[1] ?? '  ';
const trailingNewline = raw.endsWith('\n') ? '\n' : '';
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + trailingNewline);
console.log(`Wrote ${pkgPath} (version: ${next})`);

if (noGit) {
  console.log('(--no-git, skipping commit and tag)');
  process.exit(0);
}

// Refuse to create a commit if the working tree has unrelated staged changes —
// bumping should produce a clean single-purpose commit.
const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: repoRoot });
const otherChanges = status
  .split('\n')
  .filter((line) => line.trim() && !line.endsWith('client/package.json'));
if (otherChanges.length > 0) {
  console.error(
    'Working tree has other changes; refusing to auto-commit:\n' +
      otherChanges.join('\n') +
      '\nCommit or stash them first, or re-run with --no-git.',
  );
  process.exit(1);
}

const tag = `v${next}`;
execSync('git add client/package.json', { cwd: repoRoot });
execSync(`git commit -m "Bump client to ${tag}"`, { cwd: repoRoot });
execSync(`git tag ${tag}`, { cwd: repoRoot });
console.log(`Committed and tagged ${tag}`);
console.log('Push with: git push --follow-tags');
