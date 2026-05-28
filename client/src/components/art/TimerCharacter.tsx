// SPDX-License-Identifier: AGPL-3.0-only

// A round-bodied creature riding the timer bar (DESIGN_SYSTEM §5). Idle wobble
// via CSS. The ≤10s "panic" shake is applied by the parent TimerBar to the
// wrapper, so this component itself stays prop-free.

interface Props {
  className?: string;
}

export default function TimerCharacter({ className = '' }: Props) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 100 100" fill="none">
      <g className="mascot-wobble">
        <path
          d="M22 60 q-10 4 -12 15"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M78 60 q10 4 12 15"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="50" cy="53" r="34" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="40" cy="45" r="11" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="63" cy="49" r="11" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="43" cy="48" r="4.5" fill="#1f2937" />
        <circle cx="60" cy="52" r="4.5" fill="#1f2937" />
        <path
          d="M40 67 q10 11 20 0"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M41 87 v7 M59 87 v7"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
