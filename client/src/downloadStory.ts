// SPDX-License-Identifier: AGPL-3.0-only

// Composites a gallery story into a single PNG and triggers a browser download
// (spec §24 — item 14). Fully client-side: the picture is already a data URL
// and the prose is in the gallery payload, so there is no server round-trip.
//
// Item 6 of BUGS_AND_IMPROVEMENTS_02.md adds a "scan-to-clone" footer to the
// downloaded image: the upstream-project QR code, its URL printed below, and
// the verbatim content-responsibility notice (`footer.contentNotice` from the
// active locale). The disclaimer must travel with the image because the
// downloaded asset moves out of the in-app context where the source footer
// would otherwise carry it.

import i18n from './i18n/index.js';
import { SOURCE_URL } from './sourceUrl.js';

const WIDTH = 512;
const PAD = 28;
const PROSE_FONT = '22px Georgia, serif';
const PROSE_LINE_HEIGHT = 32;
const NAME_FONT = '16px system-ui, sans-serif';
const NAME_HEIGHT = 24;
const CREAM = '#fef3c7';
const INK = '#1f2937';
const PINK = '#ec4899';

// Footer (item 6 of vol02 BUGS_AND_IMPROVEMENTS).
const FOOTER_DIVIDER_PAD = 18;
const NOTICE_FONT = 'italic 13px Georgia, serif';
const NOTICE_LINE_HEIGHT = 18;
const NOTICE_COLOR = '#4b5563';
const QR_SIZE = 96;
const QR_TEXT_GAP = 14;
const SOURCE_LABEL_FONT = 'bold 13px system-ui, sans-serif';
const URL_FONT = '12px ui-monospace, "SF Mono", Consolas, monospace';
const URL_LINE_HEIGHT = 16;

// Greedy word-wrap against a measured context.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function safeFileName(nickname: string): string {
  const slug = nickname
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `funny-stories-${slug || 'story'}.png`;
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

// Renders a QR for `value` onto an offscreen canvas and returns it. Lazy
// `import('qrcode')` keeps the QR library out of the main bundle — it loads
// only when a player taps Download.
async function renderQrCanvas(value: string): Promise<HTMLCanvasElement> {
  const { default: QRCode } = await import('qrcode');
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, value, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: INK, light: CREAM },
  });
  return qrCanvas;
}

export async function downloadStoryImage(opts: {
  nickname: string;
  prose: string;
  pictureUrl: string | null;
}): Promise<void> {
  const { nickname, prose, pictureUrl } = opts;

  // Translated content-responsibility notice — must accompany the image
  // wherever it goes (item 6 of BUGS_AND_IMPROVEMENTS_02.md). Pulled from
  // the same i18n key the in-app footer uses, so the two stay in sync
  // automatically if either is ever edited.
  const notice = i18n.t('footer.contentNotice');
  const sourceLabel = i18n.t('footer.source');

  // Load the picture first (if any) so its drawn height is known.
  let picture: HTMLImageElement | null = null;
  if (pictureUrl) {
    const img = new Image();
    img.src = pictureUrl;
    await img.decode();
    picture = img;
  }
  const pictureHeight = picture ? WIDTH : 0;

  // QR code for the upstream repo — rendered to an offscreen canvas, then
  // drawn onto the composite below.
  const qrCanvas = await renderQrCanvas(SOURCE_URL);

  // Measure the wrapped prose and notice against a scratch context.
  const scratch = document.createElement('canvas').getContext('2d')!;
  scratch.font = PROSE_FONT;
  const proseLines = wrapText(scratch, prose, WIDTH - PAD * 2);
  scratch.font = NOTICE_FONT;
  const noticeLines = wrapText(scratch, notice, WIDTH - PAD * 2);

  // Footer block height — `notice` lines stacked, then a divider gap, then a
  // row of [QR | label + URL]. The QR is taller than the two text lines, so
  // QR_SIZE bounds the row height.
  const footerBlockHeight =
    noticeLines.length * NOTICE_LINE_HEIGHT + FOOTER_DIVIDER_PAD + QR_SIZE;

  const height =
    pictureHeight +
    PAD +
    proseLines.length * PROSE_LINE_HEIGHT +
    PAD +
    NAME_HEIGHT +
    FOOTER_DIVIDER_PAD +
    footerBlockHeight +
    PAD;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, WIDTH, height);
  if (picture) ctx.drawImage(picture, 0, 0, WIDTH, pictureHeight);

  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = PROSE_FONT;
  let y = pictureHeight + PAD;
  for (const line of proseLines) {
    ctx.fillText(line, PAD, y);
    y += PROSE_LINE_HEIGHT;
  }

  ctx.fillStyle = PINK;
  ctx.font = NAME_FONT;
  ctx.fillText(`— ${nickname}`, PAD, y + PAD);
  y += PAD + NAME_HEIGHT + FOOTER_DIVIDER_PAD;

  // Content-responsibility notice — italic, muted, wraps to as many lines as
  // needed at the composite width.
  ctx.fillStyle = NOTICE_COLOR;
  ctx.font = NOTICE_FONT;
  for (const line of noticeLines) {
    ctx.fillText(line, PAD, y);
    y += NOTICE_LINE_HEIGHT;
  }
  y += FOOTER_DIVIDER_PAD;

  // QR (left) + source label and URL stacked to its right, vertically
  // centred against the QR's height.
  ctx.drawImage(qrCanvas, PAD, y, QR_SIZE, QR_SIZE);
  const textX = PAD + QR_SIZE + QR_TEXT_GAP;
  const textBlockHeight = URL_LINE_HEIGHT * 2 + 4; // label + small gap + url
  const textTopY = y + Math.max(0, (QR_SIZE - textBlockHeight) / 2);

  ctx.fillStyle = INK;
  ctx.font = SOURCE_LABEL_FONT;
  ctx.fillText(sourceLabel, textX, textTopY);

  ctx.font = URL_FONT;
  ctx.fillText(SOURCE_URL, textX, textTopY + URL_LINE_HEIGHT + 4);

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, safeFileName(nickname));
      resolve();
    }, 'image/png');
  });
}
