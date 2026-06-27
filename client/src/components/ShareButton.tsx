// SPDX-License-Identifier: AGPL-3.0-only

interface Props {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// Native-share button shown beside the gallery's download buttons. The blue
// pill + universal "share-nodes" glyph reads as Share on every platform; the
// word itself is localised via `label` (uppercased for emphasis, matching the
// platform share affordance). Wiring lives in RoomGallery — this is presentation
// only.
export default function ShareButton({ label, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-sky-500 px-4 py-3 font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-sky-600 active:bg-sky-700 disabled:cursor-wait disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span>{label}</span>
      <ShareGlyph />
    </button>
  );
}

// Feather-style "share-2" glyph: three nodes joined by two links. Inherits the
// button's white text via currentColor.
function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
