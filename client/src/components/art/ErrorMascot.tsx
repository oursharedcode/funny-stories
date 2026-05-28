// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from 'framer-motion';
import { panic } from '../../styles/motion';

// A sad-but-resigned blob shrugging (DESIGN_SYSTEM §5). Enters with a panic
// spring, then settles into a slow idle shrug (CSS on the inner group, so it
// doesn't fight the Framer entrance transform on the outer element).

interface Props {
  className?: string;
}

export default function ErrorMascot({ className = '' }: Props) {
  return (
    <motion.svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      initial={{ scale: 0, y: -22 }}
      animate={{ scale: 1, y: 0 }}
      transition={panic}
    >
      <g className="mascot-shrug">
        <path
          d="M22 58 q-13 -2 -15 -15"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M78 58 q13 -2 15 -15"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="50" cy="56" r="30" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="41" cy="50" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="62" cy="53" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
        <circle cx="41" cy="53" r="3.6" fill="#1f2937" />
        <circle cx="62" cy="56" r="3.6" fill="#1f2937" />
        <path
          d="M32 41 l13 5 M71 44 l-13 5"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M39 71 q5.5 -6 11 0 t11 0"
          stroke="#1f2937"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </motion.svg>
  );
}
