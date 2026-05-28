// SPDX-License-Identifier: AGPL-3.0-only

// A boxy robot with one eye drawn higher than the other (DESIGN_SYSTEM §5).
// Replaces the 🤖 emoji for bot slots in the player list. Idle blink via CSS.

interface Props {
  className?: string;
}

export default function BotAvatar({ className = '' }: Props) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 100 100" fill="none">
      <line
        x1="50"
        y1="14"
        x2="50"
        y2="28"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="11" r="5" fill="#ec4899" stroke="#1f2937" strokeWidth="2.5" />
      <rect
        x="20"
        y="28"
        width="60"
        height="56"
        rx="13"
        fill="#60a5fa"
        stroke="#1f2937"
        strokeWidth="2.5"
      />
      <circle cx="20" cy="56" r="4.5" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="80" cy="56" r="4.5" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
      <g className="bot-blink">
        <circle cx="38" cy="46" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="64" cy="53" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="40" cy="48" r="3.6" fill="#1f2937" />
        <circle cx="62" cy="51" r="3.6" fill="#1f2937" />
      </g>
      <path
        d="M38 71 h24"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
