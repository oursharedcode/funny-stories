// SPDX-License-Identifier: AGPL-3.0-only

// Local-only page that generates the AI cartoon for the EXACT demo reveal
// story, via the dev Worker endpoint, and lets you download the result.
// Kept separate from the recorded /?test=demo run so generation is a manual
// button press (it consumes one Cloudflare Neuron) and never auto-fires.
//
// Requires the server running with a configured Worker (CLOUDFLARE_WORKER_URL
// + CLOUDFLARE_WORKER_SECRET). Usage:
//   npm run dev
//   open http://localhost:5173/?test=demopic

import { useEffect, useState } from 'react';

const SERVER_BASE =
  window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;

// The exact reveal story from TestDemoScreen (questions 2 & 5 are Oliver's).
const STORY = {
  language: 'en',
  answers: [
    'A grumpy wizard',
    'A confused robot',
    'in a crowded supermarket',
    'at midnight',
    'eating hot pizza',
    'to win a golden trophy',
    'everyone started dancing',
  ],
};

type Status = 'idle' | 'generating' | 'done' | 'error';

function extensionFor(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  const sub = (m?.[1] ?? 'png').toLowerCase();
  return sub === 'jpeg' ? 'jpg' : sub;
}

export default function TestDemoImageScreen(): JSX.Element {
  const [imagePrompt, setImagePrompt] = useState('(loading…)');
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Build (but don't generate) the prompt on load — no Neuron used.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${SERVER_BASE}/test/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...STORY, generate: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'prompt build failed');
        setImagePrompt(data.imagePrompt);
      } catch (err) {
        setImagePrompt('(failed to build prompt)');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  async function generate(): Promise<void> {
    setStatus('generating');
    setErrorMsg('');
    setPictureUrl(null);
    try {
      const res = await fetch(`${SERVER_BASE}/test/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...STORY, generate: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        const tail = data.workerUrl ? ` [workerUrl=${data.workerUrl}]` : '';
        throw new Error((data.error ?? 'generation failed') + tail);
      }
      setImagePrompt(data.imagePrompt);
      setPictureUrl(data.pictureUrl);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-xl min-h-screen p-6 flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold text-pink-500">
        Demo story — AI cartoon
      </h1>

      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-sm">Story</h2>
        <p className="font-prose text-gray-800">
          A grumpy wizard and A confused robot were in a crowded supermarket at midnight. They
          eating hot pizza to win a golden trophy. In the end, everyone started dancing.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-sm">imagePrompt (sent to Worker)</h2>
        <pre className="whitespace-pre-wrap break-words rounded border border-gray-300 bg-gray-50 p-3 text-xs font-mono">
          {imagePrompt}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded bg-pink-500 px-6 py-3 font-display text-lg font-semibold text-white disabled:opacity-50"
          onClick={generate}
          disabled={status === 'generating'}
        >
          {status === 'generating' ? 'Generating…' : 'Generate via Worker (1 Neuron)'}
        </button>

        {pictureUrl && (
          <a
            className="rounded border-2 border-pink-500 px-6 py-3 font-display text-lg font-semibold text-pink-500"
            href={pictureUrl}
            download={`demo-story-cartoon.${extensionFor(pictureUrl)}`}
          >
            Download picture
          </a>
        )}
      </div>

      {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

      {pictureUrl && (
        <img src={pictureUrl} alt="AI cartoon of the demo story" className="w-full rounded-xl shadow-lg" />
      )}
    </div>
  );
}
