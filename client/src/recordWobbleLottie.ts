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

// Build a Lottie composition that wobbles a single image asset on four axes:
// scale (zoom), position (drift), rotation (jiggle). The "speech bubble pulse"
// is composed onto the canvas after Lottie renders each frame, since pulsing
// text overlays are cheaper to draw than to encode as Lottie text layers.
function buildWobbleAnimation(picDataUrl: string, picSize: number): object {
  const picX = W / 2;
  const picY = H / 2 - 60; // bias up to leave room for the badge

  // Drift path — six waypoints around the centre over 150 frames.
  const driftKeys = kf([
    { t: 0, s: [picX - 6, picY + 4] },
    { t: 37, s: [picX + 6, picY - 3] },
    { t: 75, s: [picX + 4, picY + 5] },
    { t: 112, s: [picX - 5, picY - 4] },
    { t: 150, s: [picX - 6, picY + 4] },
  ]);

  // Zoom — 100 → 105 → 100 every 72 frames (≈ 2.4 s in the CSS keyframes).
  const zoomKeys = kf([
    { t: 0, s: [100, 100] },
    { t: 36, s: [105, 105] },
    { t: 72, s: [100, 100] },
    { t: 108, s: [105, 105] },
    { t: 150, s: [100, 100] },
  ]);

  // Jiggle — ±1.4° every 48 frames (≈ 1.6 s).
  const jiggleKeys = kf([
    { t: 0, s: [-1.4] },
    { t: 24, s: [1.4] },
    { t: 48, s: [-0.8] },
    { t: 72, s: [1.2] },
    { t: 96, s: [-1.0] },
    { t: 120, s: [1.4] },
    { t: 150, s: [-1.4] },
  ]);

  return {
    v: '5.7.4',
    fr: FPS,
    ip: 0,
    op: FRAMES,
    w: W,
    h: H,
    nm: 'wobble',
    ddd: 0,
    assets: [
      {
        id: 'pic_0',
        w: picSize,
        h: picSize,
        u: '',
        p: picDataUrl,
        e: 1, // embedded data URL
      },
    ],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 2, // image layer
        nm: 'cartoon',
        refId: 'pic_0',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 1, k: jiggleKeys },
          p: { a: 1, k: driftKeys },
          a: { a: 0, k: [picSize / 2, picSize / 2, 0] },
          s: { a: 1, k: zoomKeys },
        },
        ao: 0,
        ip: 0,
        op: FRAMES,
        st: 0,
        bm: 0,
      },
    ],
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

async function fetchAsDataUrl(src: string): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cx = c.getContext('2d');
  if (!cx) throw new Error('Canvas 2D context unavailable');
  cx.drawImage(img, 0, 0);
  return { dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
}

export async function recordWobbleVideoLottie(opts: {
  nickname: string;
  pictureUrl: string;
}): Promise<void> {
  const { nickname, pictureUrl } = opts;
  const mime = pickMime();
  if (!mime) throw new Error('MediaRecorder not supported in this browser');

  // Lazy-load lottie-web only when this engine is actually used.
  const [{ default: lottie }, picture] = await Promise.all([
    import('lottie-web'),
    fetchAsDataUrl(pictureUrl),
  ]);

  // Cartoons are square in the spec — assume so for layout. If they're not,
  // Lottie will still render at the asset's intrinsic aspect inside the layer.
  const picSize = picture.w;
  const animationData = buildWobbleAnimation(picture.dataUrl, picSize);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Lottie-web's canvas renderer sizes its draw target from the container's
  // layout box, not from CSS width/height. Off-screen positioning
  // (`left: -99999px`) sometimes resolves to a zero-dimension box, leaving
  // the WebM with the cream background but no cartoon. `visibility: hidden`
  // keeps the element laid out at full 720×1280 while staying invisible.
  //
  // Earlier this module tried to share our recording context via
  // `rendererSettings.context`; that path is brittle across lottie-web
  // versions. Instead, lottie owns its own internal canvas, and we copy
  // from it onto the recording canvas each frame.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = `${W}px`;
  host.style.height = `${H}px`;
  host.style.visibility = 'hidden';
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

  function drawFrame(now: number): void {
    const elapsed = now - start;
    const frame = Math.min(FRAMES - 1, (elapsed / 1000) * FPS);

    // Advance the Lottie composition into its own internal canvas.
    anim.goToAndStop(frame, true);

    // Cream background, then the Lottie frame copied across. drawImage scales
    // automatically if the source canvas resolution differs from the target.
    ctx!.fillStyle = CREAM;
    ctx!.fillRect(0, 0, W, H);
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
