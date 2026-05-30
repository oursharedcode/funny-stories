// SPDX-License-Identifier: AGPL-3.0-only

// Standalone test page for the Share-as-video recorders. Bypasses the entire
// game flow (no socket, no rooms, no rounds) so a developer can iterate on
// the WebM output without playing through three players and seven rounds.
//
// Usage:
//   npm run dev
//   open http://localhost:5173/?test=share
//
// Click a button, wait ~5 seconds, the browser downloads the WebM. The
// placeholder cartoon is the bundled /monkeys-on-bus.png — same shape and
// rough size as a Flux Schnell output, so the layout is representative.

import { useState } from 'react';
import { recordWobbleVideo } from '../recordWobble';

type Status = 'idle' | 'recording-css' | 'recording-lottie' | 'done' | 'error';

const PLACEHOLDER_PICTURE_URL = '/monkeys-on-bus.png';
const TEST_NICKNAME = 'TestPlayer';

export default function TestShareScreen(): JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function runCss(): Promise<void> {
    setStatus('recording-css');
    setErrorMsg('');
    try {
      await recordWobbleVideo({
        nickname: TEST_NICKNAME,
        pictureUrl: PLACEHOLDER_PICTURE_URL,
      });
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  async function runLottie(): Promise<void> {
    setStatus('recording-lottie');
    setErrorMsg('');
    try {
      // Match RoomGallery's dispatch path so we exercise the same code the
      // production gallery does (including the lazy chunk-split).
      const { recordWobbleVideoLottie } = await import('../recordWobbleLottie');
      await recordWobbleVideoLottie({
        nickname: TEST_NICKNAME,
        pictureUrl: PLACEHOLDER_PICTURE_URL,
      });
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  const busy = status === 'recording-css' || status === 'recording-lottie';

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <h1 className="font-display text-2xl font-bold text-pink-500">Share-video test</h1>
      <p className="text-sm text-gray-700">
        Standalone harness for the WebM recorders. Bypasses the game flow.
      </p>

      <div className="rounded-lg border border-amber-200 bg-white p-2">
        <img
          src={PLACEHOLDER_PICTURE_URL}
          alt="Placeholder cartoon used as the recorder's source"
          className="w-full rounded"
        />
        <p className="mt-1 text-center text-xs text-gray-500">
          Placeholder cartoon (monkeys-on-bus.png)
        </p>
      </div>

      <button
        className="w-full rounded bg-pink-500 py-3 font-display text-lg font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        disabled={busy}
        onClick={() => void runCss()}
      >
        {status === 'recording-css' ? 'Recording CSS engine…' : 'Record CSS engine (5 s)'}
      </button>

      <button
        className="w-full rounded border-2 border-pink-500 bg-white py-3 font-display text-lg font-semibold text-pink-500 disabled:cursor-wait disabled:opacity-60"
        disabled={busy}
        onClick={() => void runLottie()}
      >
        {status === 'recording-lottie' ? 'Recording Lottie engine…' : 'Record Lottie engine (5 s)'}
      </button>

      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <p>
          <span className="font-semibold">Status:</span>{' '}
          {status === 'idle' && 'Ready.'}
          {status === 'recording-css' && 'Recording 5 s with CSS engine. Hold tight.'}
          {status === 'recording-lottie' && 'Recording 5 s with Lottie engine. Hold tight.'}
          {status === 'done' && 'Done — check your Downloads folder.'}
          {status === 'error' && (
            <span className="text-red-600">Error: {errorMsg || 'unknown'}</span>
          )}
        </p>
        <p className="mt-2 text-xs text-gray-600">
          The expected output is a 720×1280 (9:16) WebM, 5 seconds long. CSS engine produces
          the wobbling cartoon only; Lottie engine adds the walking + pointing + falling
          monkey on top.
        </p>
      </div>

      <a className="mt-auto self-center text-sm text-gray-500 underline" href="/">
        Back to the game
      </a>
    </div>
  );
}
