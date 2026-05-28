// SPDX-License-Identifier: AGPL-3.0-only

// The three named spring presets from DESIGN_SYSTEM.md §4. Use these
// everywhere; do not invent a fourth without a documented reason.

export const snappy = { type: 'spring', stiffness: 400, damping: 30 } as const;
export const goofy = { type: 'spring', stiffness: 180, damping: 12 } as const;
export const panic = { type: 'spring', stiffness: 700, damping: 8 } as const;
