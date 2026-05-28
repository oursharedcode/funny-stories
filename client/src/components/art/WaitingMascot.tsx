// SPDX-License-Identifier: AGPL-3.0-only

// A bored creature drumming its fingers on a desk (DESIGN_SYSTEM §5).
// Idle finger-tap loop via CSS.

interface Props {
  className?: string;
}

export default function WaitingMascot({ className = '' }: Props) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 100 100" fill="none">
      <path
        d="M8 80 h84"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="44" cy="46" r="30" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="36" cy="40" r="10" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="56" cy="43" r="10" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="40" cy="43" r="4" fill="#1f2937" />
      <circle cx="60" cy="46" r="4" fill="#1f2937" />
      <path
        d="M36 60 h17"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M64 58 q14 7 17 20"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g className="mascot-tap">
        <line x1="71" y1="78" x2="71" y2="71" stroke="#1f2937" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="78" y1="78" x2="78" y2="71" stroke="#1f2937" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="85" y1="78" x2="85" y2="71" stroke="#1f2937" strokeWidth="3.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
