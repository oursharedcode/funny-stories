// SPDX-License-Identifier: AGPL-3.0-only

// Standalone test page for the image Worker. Two hard-coded stories (RU and
// EN) — for each one, the server-built imagePrompt is fetched on load
// (no Neuron used) and shown above its own Generate button.
//
// Usage:
//   npm run dev
//   open http://localhost:5173/?test=image

import { useEffect, useState } from 'react';

const SERVER_BASE =
  window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;

interface StorySpec {
  title: string;
  language: string;
  answers: string[];
}

const STORIES: StorySpec[] = [
  {
    title: 'Russian story (ru)',
    language: 'ru',
    answers: [
      'кот',
      'кот',
      'на крыше',
      'зимой',
      'пили воду',
      'чтобы поспать',
      'мартышки уехали на автобусе',
    ],
  },
  {
    title: 'English story (en)',
    language: 'en',
    answers: [
      'A cat',
      'A cat',
      'on the roof',
      'in the winter',
      'drank hot water',
      'money',
      'the monkeys left on the bus',
    ],
  },
];

type Status = 'idle' | 'generating' | 'done' | 'error';

interface PanelState {
  imagePrompt: string;
  pictureUrl: string | null;
  status: Status;
  errorMsg: string;
}

const INITIAL_PANEL: PanelState = {
  imagePrompt: '(loading…)',
  pictureUrl: null,
  status: 'idle',
  errorMsg: '',
};

function StoryPanel({ spec }: { spec: StorySpec }): JSX.Element {
  const [state, setState] = useState<PanelState>(INITIAL_PANEL);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${SERVER_BASE}/test/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: spec.answers,
            language: spec.language,
            generate: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'prompt build failed');
        setState((s) => ({ ...s, imagePrompt: data.imagePrompt }));
      } catch (err) {
        setState((s) => ({
          ...s,
          imagePrompt: '(failed to build prompt)',
          errorMsg: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
  }, [spec]);

  async function generate(): Promise<void> {
    setState((s) => ({ ...s, status: 'generating', errorMsg: '', pictureUrl: null }));
    try {
      const res = await fetch(`${SERVER_BASE}/test/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: spec.answers,
          language: spec.language,
          generate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const tail = data.workerUrl ? ` [workerUrl=${data.workerUrl}]` : '';
        throw new Error((data.error ?? 'generation failed') + tail);
      }
      setState({
        imagePrompt: data.imagePrompt,
        pictureUrl: data.pictureUrl,
        status: 'done',
        errorMsg: '',
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        errorMsg: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-300 p-4">
      <h2 className="font-display text-xl font-semibold text-pink-500">{spec.title}</h2>

      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-sm">Answers</h3>
        <ol className="list-decimal pl-6 text-sm">
          {spec.answers.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-sm">imagePrompt (sent to Worker)</h3>
        <pre className="whitespace-pre-wrap break-words rounded border border-gray-300 bg-gray-50 p-3 text-xs font-mono">
          {state.imagePrompt}
        </pre>
      </div>

      <button
        className="self-start rounded bg-pink-500 px-6 py-3 font-display text-lg font-semibold text-white disabled:opacity-50"
        onClick={generate}
        disabled={state.status === 'generating'}
      >
        {state.status === 'generating' ? 'Generating…' : 'Generate via Worker (1 Neuron)'}
      </button>

      {state.errorMsg && <p className="text-red-600 text-sm">{state.errorMsg}</p>}

      {state.pictureUrl && (
        <img src={state.pictureUrl} alt="generated" className="w-full rounded-xl shadow-lg" />
      )}
    </section>
  );
}

export default function TestImageScreen(): JSX.Element {
  return (
    <div className="mx-auto max-w-xl min-h-screen p-6 flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-pink-500">Worker image test</h1>
      {STORIES.map((s) => (
        <StoryPanel key={s.language} spec={s} />
      ))}
    </div>
  );
}
