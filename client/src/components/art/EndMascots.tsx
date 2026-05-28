// SPDX-License-Identifier: AGPL-3.0-only

// Two companion creatures waving goodbye to the monkeys-on-bus
// (DESIGN_SYSTEM §5). Idle wave loop via CSS.

interface Props {
  className?: string;
}

export default function EndMascots({ className = '' }: Props) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 150 100" fill="none">
      <g>
        <circle cx="44" cy="60" r="28" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="36" cy="53" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="54" cy="56" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="38" cy="56" r="3.6" fill="#1f2937" />
        <circle cx="56" cy="59" r="3.6" fill="#1f2937" />
        <path d="M36 70 q9 9 18 0" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 87 v7 M52 87 v7" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
        <g className="mascot-wave">
          <path
            d="M67 58 q12 -6 17 -20"
            stroke="#1f2937"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="84" cy="36" r="5.5" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
        </g>
      </g>
      <g>
        <circle cx="106" cy="64" r="24" fill="#60a5fa" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="100" cy="58" r="8" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="116" cy="60" r="8" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="102" cy="61" r="3.2" fill="#1f2937" />
        <circle cx="114" cy="63" r="3.2" fill="#1f2937" />
        <path d="M101 72 q7 7 14 0" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M102 88 v6 M114 88 v6" stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
        <g className="mascot-wave" style={{ animationDelay: '0.45s' }}>
          <path
            d="M88 62 q-12 -5 -16 -19"
            stroke="#1f2937"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="72" cy="42" r="5.5" fill="#60a5fa" stroke="#1f2937" strokeWidth="2.5" />
        </g>
      </g>
    </svg>
  );
}
