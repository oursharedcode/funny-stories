// SPDX-License-Identifier: AGPL-3.0-only

// A fixed, full-screen layer of hand-drawn squiggles — subtle notebook
// texture behind every screen. Static by spec §8 ("Do not animate the
// background").

export default function BackgroundDoodle() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g
          stroke="#1f2937"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.1"
        >
          <path d="M28 78 q14 -22 28 0 t28 0 t28 0" />
          <path d="M312 132 q12 20 24 0 t24 0" />
          <path d="M52 372 q18 -24 36 0 t36 0" />
          <path d="M286 520 q14 22 28 0 t28 0" />
          <path d="M40 250 q16 18 32 0" />
          <path d="M260 690 q15 -20 30 0 t30 0" />
          <path d="M338 632 a20 20 0 1 1 -12 -17 a12 12 0 1 1 -7 11 a5 5 0 1 1 -3 -6" />
          <path d="M74 596 l7 15 l16 1 l-12 11 l4 16 l-15 -9 l-15 9 l4 -16 l-12 -11 l16 -1 z" />
          <circle cx="206" cy="208" r="7" />
          <circle cx="150" cy="724" r="9" />
          <circle cx="356" cy="372" r="6" />
        </g>
      </svg>
    </div>
  );
}
