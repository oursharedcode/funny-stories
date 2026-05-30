// SPDX-License-Identifier: AGPL-3.0-only

// "Rich" variant of the 5-second wobble recorder, opt-in via the home-screen
// engine toggle. Visually richer than the CSS path: it adds an articulated
// monkey character that walks in, points at the cartoon, and falls over
// laughing on top of the same wobbling cartoon background.
//
// Earlier iterations of this module ran the monkey through lottie-web's
// canvas renderer, and the file is still named after that attempt. In
// practice lottie-web's renderer kept failing silently on hand-authored
// (non-Bodymovin) shape JSON — the monkey never appeared in the recorded
// WebM. To unblock the user-facing feature, the monkey is now drawn with
// the same canvas API the cartoon uses; the lottie-web dependency is no
// longer imported here. When somebody authors a real Bodymovin JSON we
// can wire Lottie back in, but the public contract (Lottie engine = cartoon
// + monkey, CSS engine = cartoon only) stays the same.

import { SOURCE_URL } from './sourceUrl.js';

const W = 720;
const H = 1280;
const FPS = 30;
const DURATION_MS = 5000;
const CREAM = '#fef3c7';
const INK = '#1f2937';
const PINK = '#ec4899';
const FUR = '#8c5b33';
const SKIN = '#e9c78c';
const EYE = '#1f1f1f';

// Half-cycle sine eased between 0 and 1 — matches the CSS ease-in-out curve
// closely enough for visual parity at 30 fps.
function tri(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
}

// ── Cartoon wobble ──────────────────────────────────────────────────────────
// Mirrors recordWobble.ts so the cartoon's motion is identical between the
// two engines. Only difference between the engines is the monkey overlay.

interface CartoonFrame {
  scale: number;
  dx: number;
  dy: number;
  rot: number;
}

function cartoonWobbleAt(ms: number): CartoonFrame {
  const zoomPhase = (ms % 2400) / 2400;
  const driftPhase = (ms % 5000) / 5000;
  const jigglePhase = (ms % 1600) / 1600;
  return {
    scale: 1 + 0.05 * tri(zoomPhase),
    dx: 12 * Math.sin(driftPhase * Math.PI * 2) - 6,
    dy: 8 * Math.sin(driftPhase * Math.PI * 2 + Math.PI / 2) + 1,
    rot: ((2.8 * tri(jigglePhase) - 1.4) * Math.PI) / 180,
  };
}

// ── Articulated monkey ──────────────────────────────────────────────────────
// Same parent-bone semantics a Bodymovin rig would have, expressed as nested
// ctx.translate/rotate calls. The torso is the root; its transform cascades
// to every limb and the head via ctx.save / ctx.restore stacking.

interface MonkeyFrame {
  torsoX: number;
  torsoY: number;
  torsoRot: number;
  legLeftRot: number;
  legRightRot: number;
  armPointRot: number;
  armFreeRot: number;
  headRot: number;
}

const GROUND_Y = 1180;

function monkeyAt(ms: number): MonkeyFrame | null {
  // Off-screen for the first 1.5 s.
  if (ms < 1500) return null;

  let torsoX = W * 0.78;
  let torsoY = GROUND_Y;
  let torsoRot = 0;
  let legLeftRot = 0;
  let legRightRot = 0;
  let armPointRot = degToRad(10);
  let armFreeRot = degToRad(-10);
  let headRot = 0;

  if (ms < 3000) {
    // 1.5–3.0 s — walking in from the right with alternating leg swings.
    const t = (ms - 1500) / 1500; // 0 → 1
    torsoX = (1 - t) * (W + 60) + t * W * 0.78;
    torsoY = GROUND_Y + Math.sin(t * Math.PI * 6) * 4;
    const swing = degToRad(28 * Math.sin(t * Math.PI * 6));
    legLeftRot = swing;
    legRightRot = -swing;
    armPointRot = degToRad(10) + -1.5 * swing;
    armFreeRot = degToRad(-10) + 1.5 * swing;
  } else if (ms < 4000) {
    // 3.0–4.0 s — stops, raises the pointing arm at the cartoon, head tilts.
    const t = Math.min((ms - 3000) / 600, 1); // ease into the gesture within 0.6 s
    armPointRot = degToRad(10 - 125 * t); // 10° → -115° (up-left)
    headRot = degToRad(-12 * t);
  } else {
    // 4.0–5.0 s — fall onto the back, laughing.
    const t = (ms - 4000) / 1000;
    const fallEase = Math.min(t * 1.4, 1);
    torsoY = GROUND_Y + 22 * fallEase;
    torsoRot = degToRad(-78 * fallEase);
    headRot = degToRad(-12 + 18 * Math.sin(t * Math.PI * 5));
    // Arms and legs wiggle / kick.
    armPointRot = degToRad(-115 + 30 * Math.sin(t * Math.PI * 8));
    armFreeRot = degToRad(-10 - 40 * Math.sin(t * Math.PI * 6));
    legLeftRot = degToRad(-40);
    legRightRot = degToRad(-30);
  }

  return {
    torsoX,
    torsoY,
    torsoRot,
    legLeftRot,
    legRightRot,
    armPointRot,
    armFreeRot,
    headRot,
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

// Draw a limb (rounded rect) attached at (attachX, attachY) on its parent and
// rotated around that attachment point. The limb hangs down (positive y).
function drawLimb(
  ctx: CanvasRenderingContext2D,
  attachX: number,
  attachY: number,
  rotation: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.save();
  ctx.translate(attachX, attachY);
  ctx.rotate(rotation);
  ctx.fillStyle = FUR;
  drawRoundedRect(ctx, -w / 2, 0, w, h, radius);
  ctx.restore();
}

function drawMonkey(ctx: CanvasRenderingContext2D, ms: number): void {
  const m = monkeyAt(ms);
  if (!m) return;

  ctx.save();
  ctx.translate(m.torsoX, m.torsoY);
  ctx.rotate(m.torsoRot);

  // Legs first so the torso paints on top of their hip attachments.
  drawLimb(ctx, -16, 44, m.legLeftRot, 22, 78, 10);
  drawLimb(ctx, 16, 44, m.legRightRot, 22, 78, 10);

  // Torso.
  drawEllipse(ctx, 0, 0, 70, 95, FUR);
  drawEllipse(ctx, 0, 12, 45, 55, SKIN);

  // Free arm under the body, pointing arm on top so the gesture is visible.
  drawLimb(ctx, 32, -32, m.armFreeRot, 18, 72, 9);
  drawLimb(ctx, -32, -32, m.armPointRot, 18, 72, 9);

  // Head — pivots around the neck (where it meets the torso).
  ctx.save();
  ctx.translate(0, -68);
  ctx.rotate(m.headRot);
  ctx.translate(0, -39);
  drawEllipse(ctx, 0, 0, 78, 78, FUR);
  drawEllipse(ctx, 0, 8, 50, 40, SKIN);
  drawEllipse(ctx, -16, -10, 10, 14, EYE);
  drawEllipse(ctx, 16, -10, 10, 14, EYE);
  ctx.restore();

  ctx.restore();
}

// ── MediaRecorder setup ────────────────────────────────────────────────────

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

export async function recordWobbleVideoLottie(opts: {
  nickname: string;
  pictureUrl: string;
}): Promise<void> {
  const { nickname, pictureUrl } = opts;
  const mime = pickMime();
  if (!mime) throw new Error('MediaRecorder not supported in this browser');

  const picture = await loadImage(pictureUrl);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

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

  recorder.start();

  const start = performance.now();
  let raf = 0;

  // Cartoon layout — matches the CSS-path recorder so the two engines'
  // outputs are spatially identical apart from the monkey overlay.
  const margin = 40;
  const picRenderSize = W - margin * 2;
  const picCx = margin + picRenderSize / 2;
  const picCy = (H - picRenderSize) / 2 - 60;

  function drawFrame(now: number): void {
    const elapsed = now - start;
    const w = cartoonWobbleAt(elapsed);

    // 1. Cream background.
    ctx!.fillStyle = CREAM;
    ctx!.fillRect(0, 0, W, H);

    // 2. Cartoon — drawn with the same four-axis wobble math the CSS path uses.
    ctx!.save();
    ctx!.translate(picCx + w.dx, picCy + w.dy);
    ctx!.rotate(w.rot);
    ctx!.scale(w.scale, w.scale);
    ctx!.drawImage(picture, -picRenderSize / 2, -picRenderSize / 2, picRenderSize, picRenderSize);
    ctx!.restore();

    // 3. Monkey — walks, points, falls. Painted on top of the cartoon.
    drawMonkey(ctx!, elapsed);

    // 4. Pulsing nickname + source badge at the bottom.
    const pulsePhase = ((elapsed % 600) / 600) * Math.PI * 2;
    const pulse = 1 + 0.12 * (0.5 - 0.5 * Math.cos(pulsePhase));
    const badgeY = picCy + picRenderSize / 2 + 70;
    ctx!.save();
    ctx!.translate(W / 2, badgeY);
    ctx!.scale(pulse, pulse);
    ctx!.fillStyle = PINK;
    ctx!.font = 'bold 32px system-ui, sans-serif';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText(nickname, 0, -22);
    ctx!.fillStyle = INK;
    ctx!.font = '20px ui-monospace, "SF Mono", Consolas, monospace';
    ctx!.fillText(SOURCE_URL.replace(/^https?:\/\//, ''), 0, 18);
    ctx!.restore();

    if (elapsed >= DURATION_MS) {
      recorder.stop();
      return;
    }
    raf = requestAnimationFrame(drawFrame);
  }

  raf = requestAnimationFrame(drawFrame);

  try {
    await done;
  } finally {
    cancelAnimationFrame(raf);
  }
}
