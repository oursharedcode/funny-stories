// SPDX-License-Identifier: AGPL-3.0-only

import { splitProse } from '../prose';

interface Props {
  prose: string;
  answers: string[];
  className?: string;
}

// Renders story prose with the player-supplied phrases highlighted in pink
// (DESIGN_SYSTEM §3). Shared by the reveal screen and the room gallery.
export default function ProseText({ prose, answers, className = '' }: Props) {
  const segments = splitProse(prose, answers);
  return (
    <p className={`font-prose leading-relaxed text-gray-800 ${className}`}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <span key={i} className="font-bold text-pink-600">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
