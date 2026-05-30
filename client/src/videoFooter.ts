// SPDX-License-Identifier: AGPL-3.0-only

// Shared attribution footer for the share-as-video recorders. Mirrors the
// footer baked into the downloadable still (downloadStory.ts):
//   - content-responsibility notice (italic, gray, wrapped)
//   - QR code on the left, source label + URL stacked to its right
//
// Used by recordWobble.ts (CSS engine) and recordWobbleLottie.ts (Lottie
// engine) so the two recorded WebM outputs carry the same attribution
// block as the PNG download. Keeps the i18n notice in sync with the
// in-app SourceFooter via the same `footer.contentNotice` key.

import i18n from './i18n/index.js';
import { SOURCE_URL } from './sourceUrl.js';

const QR_SIZE = 120;
const QR_TEXT_GAP = 18;
const PAD = 40;
const NOTICE_FONT = 'italic 20px Georgia, serif';
const NOTICE_LINE_HEIGHT = 28;
const NOTICE_COLOR = '#4b5563';
const SOURCE_LABEL_FONT = 'bold 24px system-ui, sans-serif';
const URL_FONT = '20px ui-monospace, "SF Mono", Consolas, monospace';
const URL_LINE_HEIGHT = 26;
const NOTICE_TO_QR_GAP = 14;
const INK = '#1f2937';
const CREAM = '#fef3c7';

// Lazy-imports `qrcode` (already in deps via downloadStory.ts) so the library
// loads only when a recorder runs, not on every page render.
export async function renderQrCanvas(value: string): Promise<HTMLCanvasElement> {
  const { default: QRCode } = await import('qrcode');
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, value, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: INK, light: CREAM },
  });
  return qrCanvas;
}

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

// Returns the total height the attribution block occupies given the canvas
// width — useful for layout planning in the caller (knowing how far to push
// other elements out of the way).
export function measureAttributionHeight(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
): number {
  const notice = i18n.t('footer.contentNotice');
  ctx.font = NOTICE_FONT;
  const noticeLines = wrapText(ctx, notice, canvasWidth - PAD * 2);
  return noticeLines.length * NOTICE_LINE_HEIGHT + NOTICE_TO_QR_GAP + QR_SIZE;
}

// Renders the notice + QR + label/URL block with its top edge at `topY`.
// Same content the downloadable PNG carries, scaled up for the 720×1280
// video canvas.
export function drawAttribution(
  ctx: CanvasRenderingContext2D,
  qrCanvas: HTMLCanvasElement,
  opts: { topY: number; canvasWidth: number },
): void {
  const { topY, canvasWidth } = opts;
  const notice = i18n.t('footer.contentNotice');
  const sourceLabel = i18n.t('footer.source');

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let y = topY;

  // Content-responsibility notice — wrapped to the available width.
  ctx.font = NOTICE_FONT;
  const noticeLines = wrapText(ctx, notice, canvasWidth - PAD * 2);
  ctx.fillStyle = NOTICE_COLOR;
  for (const line of noticeLines) {
    ctx.fillText(line, PAD, y);
    y += NOTICE_LINE_HEIGHT;
  }
  y += NOTICE_TO_QR_GAP;

  // QR code on the left, source label + URL stacked to the right and
  // vertically centred against the QR's height.
  ctx.drawImage(qrCanvas, PAD, y, QR_SIZE, QR_SIZE);
  const textX = PAD + QR_SIZE + QR_TEXT_GAP;
  const textBlockHeight = URL_LINE_HEIGHT * 2 + 6;
  const textTopY = y + Math.max(0, (QR_SIZE - textBlockHeight) / 2);

  ctx.fillStyle = INK;
  ctx.font = SOURCE_LABEL_FONT;
  ctx.fillText(sourceLabel, textX, textTopY);

  ctx.font = URL_FONT;
  ctx.fillText(SOURCE_URL.replace(/^https?:\/\//, ''), textX, textTopY + URL_LINE_HEIGHT + 6);
}
