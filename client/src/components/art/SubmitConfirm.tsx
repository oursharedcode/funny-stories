// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from 'framer-motion';
import { goofy } from '../../styles/motion';

// A tiny celebrating blob, arms thrown up (DESIGN_SYSTEM §5). Mounts as a
// one-shot overlay after round:submit with a goofy spring entrance.

interface Props {
  className?: string;
}

export default function SubmitConfirm({ className = '' }: Props) {
  return (
    <motion.svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      initial={{ scale: 0, rotate: -25 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={goofy}
    >
      <path
        d="M26 56 L12 33"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M74 56 L88 33"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="31" r="6" fill="#ec4899" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="88" cy="31" r="6" fill="#ec4899" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="50" cy="60" r="30" fill="#facc15" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="41" cy="54" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="62" cy="57" r="9" fill="#fff" stroke="#1f2937" strokeWidth="2.5" />
      <circle cx="43" cy="56" r="3.6" fill="#1f2937" />
      <circle cx="60" cy="59" r="3.6" fill="#1f2937" />
      <path
        d="M38 70 q12 14 24 0"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M20 14 l2.4 6 l6.4 2.2 l-6.4 2.2 l-2.4 6 l-2.4 -6 l-6.4 -2.2 l6.4 -2.2 z" fill="#60a5fa" />
      <path d="M83 12 l1.8 5 l5 1.8 l-5 1.8 l-1.8 5 l-1.8 -5 l-5 -1.8 l5 -1.8 z" fill="#ec4899" />
    </motion.svg>
  );
}
