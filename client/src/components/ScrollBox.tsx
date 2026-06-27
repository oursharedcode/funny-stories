// SPDX-License-Identifier: AGPL-3.0-only

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Sizing for the box. MUST resolve to a definite height (e.g. "w-28 h-40", or
  // "flex-1" inside a fixed-height flex column) or there is nothing to scroll.
  className?: string;
  // Layout/padding for the scrolling content (e.g. "p-3 text-base" or
  // "flex flex-col gap-2 pr-2").
  contentClassName?: string;
  role?: string;
  'aria-label'?: string;
}

interface Thumb {
  h: number;
  top: number;
}

// Scroll container with an always-visible custom scrollbar. Mobile browsers
// (Samsung Internet, Android Chrome, iOS Safari) draw *overlay* scrollbars that
// fade out when idle and ignore `::-webkit-scrollbar` / `scrollbar-*` styling,
// so a native bar simply cannot be pinned on screen there. We hide the native
// bar (.hide-native-scrollbar) and paint our own thumb from the scroll metrics,
// which renders identically on every platform. The thumb is decorative — touch
// and wheel scroll the content; it only signals that the box scrolls and where
// you are within it.
export default function ScrollBox({
  children,
  className = '',
  contentClassName = '',
  role,
  'aria-label': ariaLabel,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);

  function recompute(): void {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb((prev) => (prev === null ? prev : null)); // nothing to scroll
      return;
    }
    const h = Math.max(28, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = clientHeight - h;
    const denom = scrollHeight - clientHeight;
    const top = denom > 0 ? (scrollTop / denom) * maxTop : 0;
    setThumb((prev) =>
      prev && Math.abs(prev.h - h) < 0.5 && Math.abs(prev.top - top) < 0.5 ? prev : { h, top },
    );
  }

  useLayoutEffect(() => {
    recompute();
    const el = viewportRef.current;
    const content = contentRef.current;
    if (!el) return;
    // Catches viewport resize (orientation change) and content-height changes
    // (e.g. the rules text swapping when the language changes).
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    if (content) ro.observe(content);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={viewportRef}
        onScroll={recompute}
        role={role}
        aria-label={ariaLabel}
        className="hide-native-scrollbar absolute inset-0 overflow-y-auto"
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      {thumb && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0.5 w-1.5 rounded-full bg-amber-200/70"
        >
          <span
            className="absolute left-0 w-full rounded-full bg-pink-500"
            style={{ height: `${thumb.h}px`, transform: `translateY(${thumb.top}px)` }}
          />
        </span>
      )}
    </div>
  );
}
