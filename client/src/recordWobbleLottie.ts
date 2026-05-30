// SPDX-License-Identifier: AGPL-3.0-only

// Lottie-based variant of the 5-second wobble recorder. Same visual contract
// as recordWobble.ts (9:16 WebM/MP4 download, 30 fps, four-axis transform),
// implemented via lottie-web's canvas renderer instead of hand-written canvas
// transforms.
//
// `lottie-web` is ~250 KB minified and is the reason this module is lazy —
// it is loaded only on the first Share-as-video tap from a user who has opted
// in to the Lottie engine on the Home screen.

import { SOURCE_URL } from './sourceUrl.js';

const W = 720;
const H = 1280;
const FPS = 30;
const DURATION_S = 5;
const FRAMES = FPS * DURATION_S;
const CREAM = '#fef3c7';
const INK = '#1f2937';
const PINK = '#ec4899';

// Lottie keyframe shorthand: at frame t, value goes from current to s, then
// transitions to the next keyframe's s. Last keyframe gets h:1 (hold).
type Lk = { t: number; s: number[]; h?: 0 | 1 };

function kf(values: Array<{ t: number; s: number[] }>): Lk[] {
  return values.map((v, i) => (i === values.length - 1 ? { ...v, h: 1 } : { ...v }));
}

// ── Articulated monkey: scripted character motion ────────────────────────────
// Hand-authored Bodymovin-style rig demonstrating what Lottie buys over CSS:
// six body parts as shape layers with a parent hierarchy (limbs+head parented
// to the torso), each with its own keyframed transform timeline. A real
// designer would author this in After Effects; the JSON structure is the same.
//
// Sequence over 150 frames (5 s @ 30 fps):
//   0–44   off-screen right (opacity 0)
//   45–89  walks in from right, legs swing in alternating cycles, body bobs
//   90–119 stops; right arm rotates up to point at the cartoon; head tilts
//   120–149 falls onto its back (torso rotates), head bobs, arms wiggle
// Coordinates: 0,0 is top-left; ground line ~y=1180 keeps the monkey below
// the cartoon's bottom edge while it walks.
const FUR: number[] = [0.55, 0.36, 0.20, 1];
const SKIN: number[] = [0.93, 0.78, 0.55, 1];
const EYE: number[] = [0.12, 0.10, 0.10, 1];

// Group-wrapped shape with a fill — the Bodymovin emitter wraps every visual
// in a group { it: [shape, fill, transform] }, which lottie-web's canvas
// renderer expects. Hand-authoring loose shape+fill items works in some
// versions but breaks in others; grouping is the safe form.
function group(shape: object, color: number[]): object {
  return {
    ty: 'gr',
    it: [
      shape,
      { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 }, r: 1, bm: 0 },
      {
        ty: 'tr',
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        sk: { a: 0, k: 0 },
        sa: { a: 0, k: 0 },
      },
    ],
  };
}

function ellipse(x: number, y: number, w: number, h: number): object {
  return { ty: 'el', p: { a: 0, k: [x, y] }, s: { a: 0, k: [w, h] }, d: 1 };
}

function rect(x: number, y: number, w: number, h: number, r = 8): object {
  return {
    ty: 'rc',
    p: { a: 0, k: [x, y] },
    s: { a: 0, k: [w, h] },
    r: { a: 0, k: r },
    d: 1,
  };
}

// Body bob during walk — torso y oscillates ±4 px around its ground y.
function walkBobY(groundY: number): Lk[] {
  return kf([
    { t: 0, s: [W + 80, groundY] },
    { t: 45, s: [W + 60, groundY] },
    { t: 55, s: [W * 0.92, groundY - 4] },
    { t: 65, s: [W * 0.86, groundY] },
    { t: 75, s: [W * 0.82, groundY - 4] },
    { t: 90, s: [W * 0.78, groundY] },
    { t: 120, s: [W * 0.78, groundY] },
    { t: 135, s: [W * 0.78, groundY + 22] }, // drops as it falls
    { t: 150, s: [W * 0.78, groundY + 22] },
  ]);
}

function torsoRotation(): Lk[] {
  return kf([
    { t: 0, s: [0] },
    { t: 90, s: [0] },
    { t: 120, s: [0] },
    { t: 140, s: [-78] }, // lying on its back
    { t: 150, s: [-78] },
  ]);
}

function monkeyOpacity(): Lk[] {
  return kf([
    { t: 0, s: [0] },
    { t: 44, s: [0] },
    { t: 45, s: [100] },
    { t: 150, s: [100] },
  ]);
}

// Walking-leg rotation: 3 swing cycles between frames 45 and 90, then still
// during point, then sticking up during fall.
function legRotation(phaseOffset: number): Lk[] {
  const swing = (t: number, dir: 1 | -1): { t: number; s: number[] } => ({
    t,
    s: [dir * 28],
  });
  return kf([
    { t: 0, s: [0] },
    { t: 45, s: [0] },
    swing(50 + phaseOffset, 1),
    swing(58 + phaseOffset, -1),
    swing(66 + phaseOffset, 1),
    swing(74 + phaseOffset, -1),
    swing(82 + phaseOffset, 1),
    { t: 90, s: [0] },
    { t: 120, s: [0] },
    { t: 135, s: [-40] }, // legs kick up during fall
    { t: 145, s: [-20] },
    { t: 150, s: [-30] },
  ]);
}

// Pointing arm: stays neutral during walk, raises to point at cartoon (up-
// left), then wiggles during the laugh.
function pointArmRotation(): Lk[] {
  return kf([
    { t: 0, s: [10] },
    { t: 45, s: [10] },
    { t: 60, s: [-15] }, // swings while walking
    { t: 75, s: [10] },
    { t: 90, s: [-95] }, // raise toward cartoon
    { t: 100, s: [-115] }, // arm fully raised, pointing
    { t: 119, s: [-115] },
    { t: 125, s: [-150] }, // laugh-wiggle
    { t: 132, s: [-95] },
    { t: 140, s: [-150] },
    { t: 150, s: [-110] },
  ]);
}

// Free arm: swings during walk, hangs during point, wiggles during fall.
function freeArmRotation(): Lk[] {
  return kf([
    { t: 0, s: [-10] },
    { t: 45, s: [-10] },
    { t: 60, s: [15] },
    { t: 75, s: [-10] },
    { t: 90, s: [-10] },
    { t: 120, s: [-10] },
    { t: 128, s: [-50] },
    { t: 135, s: [10] },
    { t: 142, s: [-40] },
    { t: 150, s: [-10] },
  ]);
}

function headTilt(): Lk[] {
  return kf([
    { t: 0, s: [0] },
    { t: 90, s: [0] },
    { t: 105, s: [-12] }, // curious tilt while pointing
    { t: 119, s: [-12] },
    { t: 130, s: [8] },
    { t: 140, s: [-8] },
    { t: 150, s: [4] },
  ]);
}

function buildMonkeyLayers(startIndex: number): object[] {
  // Torso anchor sits at its centre; limbs' anchors sit at the joint that
  // connects them so rotation feels natural.
  const torsoInd = startIndex;
  const headInd = startIndex + 1;
  const armPointInd = startIndex + 2;
  const armFreeInd = startIndex + 3;
  const legLeftInd = startIndex + 4;
  const legRightInd = startIndex + 5;
  const groundY = 1180;

  const torso = {
    ddd: 0,
    ind: torsoInd,
    ty: 4,
    nm: 'torso',
    sr: 1,
    ks: {
      o: { a: 1, k: monkeyOpacity() },
      r: { a: 1, k: torsoRotation() },
      p: { a: 1, k: walkBobY(groundY) },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [group(ellipse(0, 0, 70, 95), FUR), group(ellipse(0, 12, 45, 55), SKIN)],
    ao: 0,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };

  const head = {
    ddd: 0,
    ind: headInd,
    ty: 4,
    nm: 'head',
    parent: torsoInd,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: headTilt() },
      // Head sits above the torso's centre. Anchor at base of head so it
      // tilts naturally from the neck rather than swinging from the crown.
      p: { a: 0, k: [0, -68] },
      a: { a: 0, k: [0, 30] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [
      group(ellipse(0, 0, 78, 78), FUR),
      group(ellipse(0, 8, 50, 40), SKIN),
      group(ellipse(-16, -10, 10, 14), EYE),
      group(ellipse(16, -10, 10, 14), EYE),
    ],
    ao: 0,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };

  // Arms: anchored at the shoulder so rotation pivots there.
  const armPoint = {
    ddd: 0,
    ind: armPointInd,
    ty: 4,
    nm: 'armPoint',
    parent: torsoInd,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: pointArmRotation() },
      p: { a: 0, k: [-32, -32] }, // left shoulder from viewer's POV — the cartoon is up-left
      a: { a: 0, k: [0, -36] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [group(rect(0, 0, 18, 72, 9), FUR)],
    ao: 0,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };

  const armFree = {
    ddd: 0,
    ind: armFreeInd,
    ty: 4,
    nm: 'armFree',
    parent: torsoInd,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: freeArmRotation() },
      p: { a: 0, k: [32, -32] },
      a: { a: 0, k: [0, -36] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [group(rect(0, 0, 18, 72, 9), FUR)],
    ao: 0,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };

  // Legs: anchored at the hip.
  const legLeft = {
    ddd: 0,
    ind: legLeftInd,
    ty: 4,
    nm: 'legLeft',
    parent: torsoInd,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: legRotation(0) },
      p: { a: 0, k: [-16, 44] },
      a: { a: 0, k: [0, -40] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [group(rect(0, 0, 22, 78, 10), FUR)],
    ao: 0,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };

  const legRight = {
    ddd: 0,
    ind: legRightInd,
    ty: 4,
    nm: 'legRight',
    parent: torsoInd,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: legRotation(4) }, // out-of-phase with the other leg
      p: { a: 0, k: [16, 44] },
      a: { a: 0, k: [0, -40] },
      s: { a: 0, k: [100, 100, 100] },
    },
    shapes: [group(rect(0, 0, 22, 78, 10), FUR)],
    ao: 0,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };

  // Render order: first in array = on top.
  //   head + face details on top of everything,
  //   pointing arm visible against the cartoon,
  //   torso covers shoulders, legs sit behind torso.
  return [head, armPoint, torso, armFree, legLeft, legRight];
}

// Build a Lottie composition holding only the articulated monkey. The cartoon
// is drawn manually onto the recording canvas with the same wobble math the
// CSS path uses — this avoids Lottie's image-asset loading machinery, which
// is the most brittle part of the canvas renderer (embedded data URLs aren't
// always decoded by the time DOMLoaded fires, leaving the cartoon blank).
function buildMonkeyComposition(): object {
  return {
    v: '5.7.4',
    fr: FPS,
    ip: 0,
    op: FRAMES,
    w: W,
    h: H,
    nm: 'monkey',
    ddd: 0,
    assets: [],
    layers: buildMonkeyLayers(1),
  };
}

// Mirrors the wobbleAt() math in recordWobble.ts so the cartoon's motion is
// identical between the two engines. Lottie's job is to add the monkey on
// top, not to replace any of the existing wobble.
function tri(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
}

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

  // Lazy-load lottie-web only when this engine is actually used. Pre-decode
  // the cartoon as an HTMLImageElement so it's ready for the very first
  // drawFrame call — no race with Lottie's asset loader.
  const [{ default: lottie }, picture] = await Promise.all([
    import('lottie-web'),
    loadImage(pictureUrl),
  ]);

  const animationData = buildMonkeyComposition();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Lottie-web's canvas renderer sizes its draw target from the container's
  // resolved layout box. We need real dimensions to exist in layout, but the
  // host element must not be visible to the user. `transform: translateX`
  // moves it off-screen while keeping its layout intact and its paints
  // running normally — `visibility: hidden` was the previous attempt and
  // appeared to suppress canvas updates in some browser versions.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = `${W}px`;
  host.style.height = `${H}px`;
  host.style.transform = 'translateX(-200vw)';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const anim = lottie.loadAnimation({
    container: host,
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid meet',
      clearCanvas: true,
      className: 'fs-lottie',
    },
  });

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

  // Wait until Lottie reports the animation as ready, then drive it frame by
  // frame so we can layer the pulsing badge on top before the next captured
  // frame is read by MediaRecorder. captureStream(FPS) samples whenever the
  // canvas paints; goToAndStop forces a paint per frame.
  await new Promise<void>((resolve) => {
    anim.addEventListener('DOMLoaded', () => resolve());
  });

  // Lottie creates its own canvas inside `host` after DOMLoaded fires. Locate
  // it once so we can blit from it onto the recording canvas each frame.
  const foundCanvas = host.querySelector('canvas');
  if (!(foundCanvas instanceof HTMLCanvasElement)) {
    host.remove();
    anim.destroy();
    throw new Error('lottie-web did not create an internal canvas');
  }
  const lottieCanvas: HTMLCanvasElement = foundCanvas;

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
    const frame = Math.min(FRAMES - 1, (elapsed / 1000) * FPS);
    const w = cartoonWobbleAt(elapsed);

    // 1. Cream background.
    ctx!.fillStyle = CREAM;
    ctx!.fillRect(0, 0, W, H);

    // 2. Cartoon — drawn manually with the same four-axis wobble math the
    //    CSS path uses. No Lottie involvement here.
    ctx!.save();
    ctx!.translate(picCx + w.dx, picCy + w.dy);
    ctx!.rotate(w.rot);
    ctx!.scale(w.scale, w.scale);
    ctx!.drawImage(picture, -picRenderSize / 2, -picRenderSize / 2, picRenderSize, picRenderSize);
    ctx!.restore();

    // 3. Monkey — Lottie advances its own canvas to the current frame, then
    //    we copy it onto the recording canvas. Lottie's canvas has a
    //    transparent background (clearCanvas: true), so only the monkey
    //    pixels blit on top of the cartoon.
    anim.goToAndStop(frame, true);
    ctx!.drawImage(lottieCanvas, 0, 0, W, H);

    // Pulsing source-attribution badge, mirroring the CSS .picture-wobble-pulse
    // class. Stamped after Lottie so it sits on top of the cartoon.
    const pulsePhase = ((elapsed % 600) / 600) * Math.PI * 2;
    const pulse = 1 + 0.12 * (0.5 - 0.5 * Math.cos(pulsePhase));
    const badgeCx = W / 2;
    const badgeY = H / 2 - 60 + (W - 80) / 2 + 70;
    ctx!.save();
    ctx!.translate(badgeCx, badgeY);
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

    if (elapsed >= DURATION_S * 1000) {
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
    anim.destroy();
    host.remove();
  }
}
