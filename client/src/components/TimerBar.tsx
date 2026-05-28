// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import TimerCharacter from './art/TimerCharacter';

interface Props {
  deadline: number;
  duration: number;
}

export default function TimerBar({ deadline, duration }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, deadline - now);
  const pct = Math.max(0, Math.min(100, (remaining / duration) * 100));
  // Spec §8: green -> amber (last 20s) -> red (last 10s).
  const color =
    remaining < 10_000 ? 'bg-red-500' : remaining < 20_000 ? 'bg-amber-500' : 'bg-emerald-500';
  // Spec §8 / DESIGN_SYSTEM §6: timer character panics in the final 10s.
  const panicking = remaining > 0 && remaining < 10_000;

  return (
    <div className="fixed top-0 left-0 right-0 h-2 bg-amber-200 z-10">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      <div
        className={`absolute top-2 -translate-x-1/2 ${panicking ? 'timer-panic' : ''}`}
        style={{ left: `${pct}%` }}
      >
        <TimerCharacter className="h-8 w-8" />
      </div>
    </div>
  );
}
