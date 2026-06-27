// SPDX-License-Identifier: AGPL-3.0-only

// Web Share API helpers for the gallery's "Share" buttons. Sharing *files*
// (the still-image PNG and the 5-second video) is Web Share Level 2 — present
// on iOS Safari, Android Chrome and Chromium-based desktop browsers, but absent
// on desktop Firefox. Callers gate their Share button on canShareFiles() and,
// when a share is unsupported, fall back to a plain download so the action is
// never a dead end.

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

// Capability probe used to decide whether to render a Share button at all.
// A throwaway PNG forces canShare() down the Level-2 (files) path, which is
// what tells desktop Firefox apart from a Chromium desktop browser.
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probe = new File(['probe'], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// Hands `files` to the platform share sheet. Returns 'unsupported' when the
// browser (or this particular file type) can't be shared so the caller can
// fall back to a download; 'cancelled' when the user dismisses the sheet.
export async function shareFiles(
  files: File[],
  data: { title?: string; text?: string } = {},
): Promise<ShareResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  const payload: ShareData = { ...data, files };
  // canShare can reject a specific file type even when the probe PNG passed —
  // e.g. a browser that shares images but not webm video. Treat that as a
  // download fallback rather than a hard error.
  if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
    return 'unsupported';
  }
  try {
    await navigator.share(payload);
    return 'shared';
  } catch (err) {
    // Dismissing the share sheet rejects with AbortError — a completed
    // interaction, not a reason to fall back to a download.
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

// Saves a File to disk via a synthetic anchor click. Shared by the download
// buttons and the Share buttons' unsupported-platform fallback.
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
