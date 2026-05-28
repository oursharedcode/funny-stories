// SPDX-License-Identifier: AGPL-3.0-only

// Canonical upstream repository URL surfaced by the in-game source footer
// (spec §27). Hardcoded by design — this points at the upstream project the
// deployer's binary was built from. A deployer with a non-trivial fork that
// they want surfaced instead is expected to change this constant in their
// build. Operator-controllable runtime config (donation link, etc.) goes
// through env vars (see §20); this one is the upstream's identity.
export const SOURCE_URL = 'https://github.com/oursharedcode/funny-stories';
