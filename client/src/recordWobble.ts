// SPDX-License-Identifier: AGPL-3.0-only

// Records a 5-second 9:16 wobble of the AI cartoon to WebM via MediaRecorder.
// Sibling to downloadStory.ts: same idea (composite + download), but the
// composite is animated. The easing math mirrors the CSS keyframes in
// styles/index.css so the recorded clip matches the in-app preview.
//
// Container/codec: MediaRecorder support is patchy across browsers — VP9, VP8,
// then MP4 (Safari) are tried in order. If none is supported the function
// rejects; the caller surfaces this as a button-disabled state.

import { SOURCE_URL } from './sourceUrl.js';
import { drawAttribution, renderQrCanvas } from './videoFooter.js';

const W = 720;
const H = 1280;
const FPS = 30;
const DURATION_MS = 5000;
const CREAM = '#fef3c7';
const PINK = '#ec4899';

// Half-cycle sine eased between 0 and 1 (matches CSS ease-in-out closely
// enough for visual parity at 30 fps).
function tri(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
}

interface WobbleFrame {
  scale: number;
  dx: number;
  dy: number;
  rot: number;
  pulse: number;
}

function wobbleAt(ms: number): WobbleFrame {
  // Each axis has its own period; matches the four keyframe blocks.
  const zoomPhase = (ms % 2400) / 2400;
  const driftPhase = (ms % 5000) / 5000;
  const jigglePhase = (ms % 1600) / 1600;
  const pulsePhase = (ms % 600) / 600;
  return {
    scale: 1 + 0.05 * tri(zoomPhase),
    dx: 12 * Math.sin(driftPhase * Math.PI * 2) - 6,
    dy: 8 * Math.sin(driftPhase * Math.PI * 2 + Math.PI / 2) + 1,
    rot: ((2.8 * tri(jigglePhase) - 1.4) * Math.PI) / 180,
    pulse: 1 + 0.12 * tri(pulsePhase),
  };
}

function pickMime(): { mime: string; ext: string } | null {
  const candidates: Array<[string, string]> = [
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
    ['video/mp4', 'mp4'],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return { mime, ext };
    }
  }
  return null;
}

function safeFileName(nickname: string, ext: string): string {
  const slug = nickname
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `funny-stories-${slug || 'story'}.${ext}`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return img;
}

export function isVideoRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickMime() !== null
  );
}

export async function recordWobbleVideo(opts: {
  nickname: string;
  pictureUrl: string;
}): Promise<void> {
  const { nickname, pictureUrl } = opts;
  const mime = pickMime();
  if (!mime) throw new Error('MediaRecorder not supported in this browser');

  const picture = await loadImage(pictureUrl);
  // Deployer logo: best-effort — if it fails to load (404 / CORS), the video
  // still records, just without the stamp.
  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImage('/deployer-logo.png');
  } catch {
    logo = null;
  }
  // QR code rendered once, then blitted onto every recorded frame.
  const qrCanvas = await renderQrCanvas(SOURCE_URL);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // The picture is square (Flux Schnell default); fit it into the 9:16 frame
  // with a margin and let the wobble play on top.
  const margin = 40;
  const picSize = W - margin * 2;
  const picX = margin;
  const picY = (H - picSize) / 2 - 60; // bias up to leave room for the badge

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime.mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e): void => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = (): void => {
      const blob = new Blob(chunks, { type: mime.mime });
      triggerDownload(blob, safeFileName(nickname, mime.ext));
      resolve();
    };
  });

  const start = performance.now();
  let raf = 0;

  function drawFrame(now: number): void {
    const elapsed = now - start;
    const w = wobbleAt(elapsed);

    // Background.
    ctx!.fillStyle = CREAM;
    ctx!.fillRect(0, 0, W, H);

    // Picture with the four-axis transform — composed around its own centre.
    const cx = picX + picSize / 2;
    const cy = picY + picSize / 2;
    ctx!.save();
    ctx!.translate(cx + w.dx, cy + w.dy);
    ctx!.rotate(w.rot);
    ctx!.scale(w.scale, w.scale);
    ctx!.drawImage(picture, -picSize / 2, -picSize / 2, picSize, picSize);
    // Deployer logo stamp (25×25, bottom-right of the picture rect).
    if (logo) {
      ctx!.drawImage(logo, picSize / 2 - 33, picSize / 2 - 33, 25, 25);
    }
    ctx!.restore();

    // Pulsing nickname badge — the "speech bubble pulse" element. URL was
    // moved out of the pulse into the static attribution block below; the
    // pulse now carries just the nickname to avoid duplicating the URL.
    const badgeY = picY + picSize + 50;
    const badgeCx = W / 2;
    ctx!.save();
    ctx!.translate(badgeCx, badgeY);
    ctx!.scale(w.pulse, w.pulse);
    ctx!.fillStyle = PINK;
    ctx!.font = 'bold 36px system-ui, sans-serif';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText(nickname, 0, 0);
    ctx!.restore();

    // Static attribution footer matching the downloadable PNG's footer:
    // wrapped content-responsibility notice + QR + source label + URL.
    drawAttribution(ctx!, qrCanvas, { topY: badgeY + 50, canvasWidth: W });

    if (elapsed >= DURATION_MS) {
      recorder.stop();
      return;
    }
    raf = requestAnimationFrame(drawFrame);
  }

  recorder.start();
  raf = requestAnimationFrame(drawFrame);
  try {
    await done;
  } finally {
    cancelAnimationFrame(raf);
  }
}
