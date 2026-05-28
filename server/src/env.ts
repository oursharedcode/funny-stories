// SPDX-License-Identifier: AGPL-3.0-only
//
// Loads the repo-root .env into process.env for local development.
// MUST be imported before any module that reads process.env (it is the first
// import in index.ts). In production (Render) the platform injects env vars
// directly and no .env file exists — the try/catch handles that.
//
// Uses Node's built-in process.loadEnvFile (Node 20.12+) — no dotenv
// dependency, keeping the supply-chain surface small for a process that
// holds the Cloudflare Worker secret (see docs/Cloudflare_usage.md).

import { fileURLToPath } from 'node:url';

try {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
  process.loadEnvFile(envPath);
} catch {
  // No .env file (production, or not created yet) — fine.
}
