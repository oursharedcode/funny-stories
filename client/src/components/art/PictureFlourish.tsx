// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from 'framer-motion';

// A one-shot confetti + sparkle burst (DESIGN_SYSTEM §5). Plays once when the
// cartoon arrives (reveal:pictureReady). Render as a centered overlay.

interface Props {
  className?: string;
}

const PARTICLES = [
  { dx: -38, dy: -30, color: '#ec4899', star: true },
  { dx: 40, dy: -26, color: '#60a5fa', star: false },
  { dx: -30, dy: 34, color: '#facc15', star: false },
  { dx: 34, dy: 36, color: '#ec4899', star: true },
  { dx: 2, dy: -46, color: '#60a5fa', star: true },
  { dx: 46, dy: 6, color: '#facc15', star: false },
  { dx: -46, dy: 0, color: '#60a5fa', star: false },
  { dx: 8, dy: 46, color: '#ec4899', star: false },
];

export default function PictureFlourish({ className = '' }: Props) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 100 100" fill="none">
      {PARTICLES.map((p, i) => (
        <motion.g
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: p.dx, y: p.dy, scale: 1, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          {p.star ? (
            <path
              d="M50 43 l2.6 6.2 l6.7 .6 l-5.1 4.4 l1.6 6.6 l-5.8 -3.5 l-5.8 3.5 l1.6 -6.6 l-5.1 -4.4 l6.7 -.6 z"
              fill={p.color}
            />
          ) : (
            <circle cx="50" cy="50" r="5.5" fill={p.color} />
          )}
        </motion.g>
      ))}
    </svg>
  );
}
