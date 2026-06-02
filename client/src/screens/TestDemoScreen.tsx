// SPDX-License-Identifier: AGPL-3.0-only

// Developer-only scripted demo for screen-recording host gameplay.
// Activated by visiting /?test=demo. It renders the Home + Lobby visuals
// (no socket, no server) and drives them through a timed SCRIPT so you can
// capture a clean walkthrough video.
//
// To extend the demo: add steps to the SCRIPT array below. Each step runs
// in order; durations are in milliseconds. Reload the page to replay.
//
//   open http://localhost:5173/?test=demo

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Wordmark from '../components/art/Wordmark';
import SourceFooter from '../components/SourceFooter';
import PlayerList from '../components/PlayerList';
import QRCode from '../components/QRCode';
import { LANGUAGES } from '../languages';
import { splitProse } from '../prose';
import { SOURCE_URL } from '../sourceUrl';
import type { Language, Player } from 'shared';

const ROOM_CODE = 'PARTY7';

// The reveal story. Slots are 0-indexed (the prose template's {0}..{6}); in
// the player-facing 1-indexed sense, question 2 and question 5 are Oliver's
// own answers from the round scenes — the rest come from other players.
const REVEAL_ANSWERS = [
  'A grumpy wizard', //        0 · Who?
  'A confused robot', //       1 · And who else?   (Oliver — question 2)
  'in a crowded supermarket', //2 · Where?
  'at midnight', //            3 · When?
  'eating hot pizza', //       4 · What did they do? (Oliver — question 5)
  'to win a golden trophy', // 5 · What for?
  'everyone started dancing', //6 · What happened in the end?
];
const REVEAL_PROSE =
  'A grumpy wizard and A confused robot were in a crowded supermarket at midnight. ' +
  'They eating hot pizza to win a golden trophy. In the end, everyone started dancing.';

// ── The demo script ─────────────────────────────────────────────────────
// Edit freely.
//   cycleLanguages – rotate the highlighted language (and the whole UI) for a while
//   setLanguage    – settle on one language
//   type           – type text into the nickname field, char by char
//   clickCreate    – flash "Create room" then switch to the Lobby screen
//   addPlayer      – a player slides into the lobby list (first one is the host)
//   clickStart     – flash "Start Game" (only meaningful once 3 players are in)
//   answer         – switch to the round screen, show a question, type its answer
//   reveal         – switch to the "Here's your story" screen and jump each answer
//   wait           – pause
type Step =
  | { type: 'cycleLanguages'; durationMs: number; stepMs: number }
  | { type: 'setLanguage'; code: Language }
  | { type: 'type'; field: 'nickname'; text: string; perCharMs: number }
  | { type: 'clickCreate' }
  | { type: 'addPlayer'; nickname: string }
  | { type: 'clickStart' }
  | { type: 'answer'; index: number; question: string; text: string; perCharMs: number }
  | { type: 'reveal' }
  | { type: 'clickContinue' } // scroll the reveal's Continue into view, press it, go to end
  | { type: 'endJumps' } //     jump the end-screen label + 3 buttons, one by one
  | { type: 'credits' } //      final screen: 5 controls jump 1..5 (last for 3s)
  | { type: 'wait'; durationMs: number };

const SCRIPT: Step[] = [
  // First screen: the start screen, rotating list of languages.
  { type: 'cycleLanguages', durationMs: 7000, stepMs: 575 },
  // Settle on English before typing.
  { type: 'setLanguage', code: 'en' },
  { type: 'wait', durationMs: 500 },
  // Typing in "Pick a nickname".
  { type: 'type', field: 'nickname', text: 'Host - Oliver', perCharMs: 500 },
  { type: 'wait', durationMs: 800 },
  // Clicking "Create room" [3 seconds] → new screen (the Lobby).
  { type: 'clickCreate' },
  { type: 'wait', durationMs: 2700 },
  // Players appear one by one.
  { type: 'addPlayer', nickname: 'Host - Oliver' },
  { type: 'wait', durationMs: 2000 },
  { type: 'addPlayer', nickname: 'second player - Olivia' },
  { type: 'wait', durationMs: 2000 },
  { type: 'addPlayer', nickname: 'third player - Lucas' },
  // "Start Game" button enabling [1 second].
  { type: 'wait', durationMs: 1000 },
  // Press "Start Game".
  { type: 'clickStart' },
  // Playing questions/answers — switch to the next screen [1 second].
  { type: 'wait', durationMs: 1000 },
  // The seven questions, in order. Each answer types in, then holds.
  { type: 'answer', index: 0, question: 'Who?', text: 'A smiling cat', perCharMs: 110 },
  { type: 'wait', durationMs: 3000 },
  { type: 'answer', index: 1, question: 'And who else?', text: 'A confused robot', perCharMs: 110 },
  { type: 'wait', durationMs: 3000 },
  { type: 'answer', index: 2, question: 'Where?', text: 'On a fluffy cloud', perCharMs: 110 },
  { type: 'wait', durationMs: 2000 },
  { type: 'answer', index: 3, question: 'When?', text: 'in the terribly cold winter', perCharMs: 110 },
  { type: 'wait', durationMs: 4000 },
  { type: 'answer', index: 4, question: 'What did they do?', text: 'eating hot pizza', perCharMs: 110 },
  { type: 'wait', durationMs: 3000 },
  { type: 'answer', index: 5, question: 'What for?', text: 'for extra stickers', perCharMs: 110 },
  { type: 'wait', durationMs: 2000 },
  { type: 'answer', index: 6, question: 'What happened in the end?', text: 'A bouncy parade !!', perCharMs: 110 },
  { type: 'wait', durationMs: 3000 },
  // "Here's your story" [7 seconds] — each of the 7 answers jumps in order, 1s each.
  { type: 'reveal' },
  { type: 'wait', durationMs: 1500 },
  // Scroll to "Continue" and click it [2 seconds] → host end screen.
  { type: 'clickContinue' },
  // End screen: label then each button jumps, one by one, 1 second each.
  { type: 'endJumps' },
  { type: 'wait', durationMs: 1500 },
  // Final screen [7 seconds]: 5 controls jump 1..5; the last lingers 3 seconds.
  { type: 'credits' },
];

export default function TestDemoScreen(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [screen, setScreen] = useState<
    'home' | 'lobby' | 'round' | 'reveal' | 'end' | 'credits'
  >('home');
  const [language, setLanguage] = useState<Language>('en');
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [createPressed, setCreatePressed] = useState(false);
  const [startPressed, setStartPressed] = useState(false);
  const [round, setRound] = useState<{ index: number; question: string }>({
    index: 0,
    question: '',
  });
  const [answer, setAnswer] = useState('');
  // Which highlighted answer (in document order) is currently "jumping" on the
  // reveal screen; -1 = none enlarged.
  const [jumping, setJumping] = useState(-1);
  // The AI cartoon fades in after the answers finish jumping.
  const [showPicture, setShowPicture] = useState(false);
  // End screen: which element (0=label, 1..3=buttons) is jumping; -1 = none.
  const [endJump, setEndJump] = useState(-1);
  // Credits screen: which control (0..4) is jumping; -1 = none.
  const [creditJump, setCreditJump] = useState(-1);
  const [continuePressed, setContinuePressed] = useState(false);
  const langRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const continueRef = useRef<HTMLButtonElement>(null);

  // Keep the highlighted language visible inside the scrollable list.
  useEffect(() => {
    langRefs.current[language]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [language]);

  // Run the SCRIPT once on mount. The `cancelled` flag stops any pending
  // step if the component unmounts mid-playback (StrictMode double-invoke).
  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    async function run(): Promise<void> {
      for (const step of SCRIPT) {
        if (cancelled) return;
        switch (step.type) {
          case 'cycleLanguages': {
            const end = Date.now() + step.durationMs;
            let i = 0;
            while (Date.now() < end && !cancelled) {
              const opt = LANGUAGES[i % LANGUAGES.length]!;
              setLanguage(opt.code);
              void i18n.changeLanguage(opt.code);
              i += 1;
              await sleep(step.stepMs);
            }
            break;
          }
          case 'setLanguage':
            setLanguage(step.code);
            void i18n.changeLanguage(step.code);
            break;
          case 'type':
            for (let k = 1; k <= step.text.length; k += 1) {
              if (cancelled) return;
              setNickname(step.text.slice(0, k));
              await sleep(step.perCharMs);
            }
            break;
          case 'clickCreate':
            setCreatePressed(true);
            await sleep(250);
            setCreatePressed(false);
            setScreen('lobby');
            break;
          case 'addPlayer':
            setPlayers((prev) => [
              ...prev,
              { id: `p${prev.length}`, nickname: step.nickname, isBot: false },
            ]);
            break;
          case 'clickStart':
            setStartPressed(true);
            await sleep(250);
            setStartPressed(false);
            break;
          case 'answer':
            setScreen('round');
            setRound({ index: step.index, question: step.question });
            setAnswer('');
            await sleep(400); // let the fresh question read before typing
            for (let k = 1; k <= step.text.length; k += 1) {
              if (cancelled) return;
              setAnswer(step.text.slice(0, k));
              await sleep(step.perCharMs);
            }
            break;
          case 'reveal':
            setScreen('reveal');
            setJumping(-1);
            setShowPicture(false);
            await sleep(500);
            // Each answer jumps up then settles back — one second per answer.
            for (let i = 0; i < REVEAL_ANSWERS.length; i += 1) {
              if (cancelled) return;
              setJumping(i);
              await sleep(600);
              setJumping(-1);
              await sleep(400);
            }
            // The cartoon fades in once the story has finished animating.
            await sleep(300);
            setShowPicture(true);
            break;
          case 'clickContinue':
            continueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(900); // let the scroll settle
            setContinuePressed(true);
            await sleep(300);
            setContinuePressed(false);
            await sleep(500);
            setScreen('end');
            setEndJump(-1);
            break;
          case 'endJumps':
            await sleep(500);
            // label (0) then the three buttons (1,2,3) — one second each.
            for (let i = 0; i < 4; i += 1) {
              if (cancelled) return;
              setEndJump(i);
              await sleep(600);
              setEndJump(-1);
              await sleep(400);
            }
            break;
          case 'credits':
            setScreen('credits');
            setCreditJump(-1);
            await sleep(300);
            // Controls 1..4 jump for 1s each; control 5 lingers for 3s.
            for (let i = 0; i < 5; i += 1) {
              if (cancelled) return;
              setCreditJump(i);
              if (i === 4) {
                await sleep(3000); // last control held longer
              } else {
                await sleep(600);
                setCreditJump(-1);
                await sleep(400);
              }
            }
            setCreditJump(-1);
            break;
          case 'wait':
            await sleep(step.durationMs);
            break;
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [i18n]);

  const nicknameValid = nickname.trim().length >= 3 && nickname.trim().length <= 20;
  const joinUrl = `${window.location.origin}/?room=${ROOM_CODE}&lang=${language}`;
  const hostId = players[0]?.id ?? '';
  const canStart = players.length >= 3;

  // ── Final / credits screen ─────────────────────────────────────────────
  // Five controls jump in order 1..5 (driven by `creditJump`); the last
  // lingers ~3s. Custom for the demo, not a real gameplay screen.
  if (screen === 'credits') {
    const jump = (i: number): string =>
      `origin-center transition-transform duration-300 ${creditJump === i ? 'scale-110' : 'scale-100'}`;
    return (
      <PhoneFrame>
        <div className="mx-auto max-w-md min-h-full p-6 flex flex-col justify-center gap-5">
          <button
            className={`w-full py-3 rounded bg-pink-500 text-white font-display font-semibold text-lg ${jump(0)}`}
          >
            {t('end.oneMoreGame')}
          </button>
          <button
            className={`w-full py-3 rounded bg-white border-2 border-pink-500 text-pink-500 font-display font-semibold text-lg ${jump(1)}`}
          >
            {t('end.finishGame')}
          </button>
          <p className={`text-center text-xs text-gray-500 px-2 ${jump(2)}`}>
            {t('footer.contentNotice')}
          </p>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 text-xs text-gray-500 ${jump(3)}`}
          >
            <span className="rounded bg-white p-1">
              <QRCode value={SOURCE_URL} size={40} />
            </span>
            <span className="underline">{t('footer.source')}</span>
          </a>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-center text-xs text-pink-500 underline break-all ${jump(4)}`}
          >
            {SOURCE_URL}
          </a>
        </div>
      </PhoneFrame>
    );
  }

  // ── End screen (host) ──────────────────────────────────────────────────
  // Custom host end screen for the demo: a "Rounds are over" label and three
  // action buttons that jump one by one (driven by `endJump`).
  if (screen === 'end') {
    const jump = (i: number): string =>
      `origin-center transition-transform duration-300 ${endJump === i ? 'scale-110' : 'scale-100'}`;
    return (
      <PhoneFrame>
        <div className="mx-auto max-w-md min-h-full p-6 flex flex-col justify-center gap-6">
          <h2 className={`text-center font-display font-semibold text-3xl text-pink-500 ${jump(0)}`}>
            Rounds are over
          </h2>
          <button
            className={`w-full py-3 rounded bg-pink-500 text-white font-display font-semibold text-lg ${jump(1)}`}
          >
            Download story and still picture
          </button>
          <button
            className={`w-full py-3 rounded bg-white border-2 border-pink-500 text-pink-500 font-display font-semibold text-lg ${jump(2)}`}
          >
            Share as 5 seconds video
          </button>
          <button
            className={`w-full py-3 rounded bg-white border-2 border-pink-500 text-pink-500 font-display font-semibold text-lg ${jump(3)}`}
          >
            Share the room's pictures
          </button>
        </div>
      </PhoneFrame>
    );
  }

  // ── Reveal screen ──────────────────────────────────────────────────────
  // Mirrors RevealScreen's "Here's your story" header + highlighted prose.
  // Each highlighted answer scales up then back, in order, driven by `jumping`.
  if (screen === 'reveal') {
    return (
      <PhoneFrame>
        <div className="mx-auto max-w-md min-h-full p-6 flex flex-col gap-6">
          <h2 className="font-display font-semibold text-2xl text-pink-500">
            {t('reveal.title')}
          </h2>
          <StoryProse prose={REVEAL_PROSE} answers={REVEAL_ANSWERS} jumping={jumping} />
          <img
            src="/demo-story-cartoon.jpg"
            alt={t('reveal.pictureAlt')}
            className={`w-full rounded-xl shadow-lg transition-all duration-500 ease-out ${
              showPicture ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
          <button
            ref={continueRef}
            className={`mt-auto self-center py-2 font-display font-semibold text-pink-500 underline transition-transform ${
              continuePressed ? 'scale-95' : ''
            }`}
          >
            {t('reveal.continue')}
          </button>
        </div>
      </PhoneFrame>
    );
  }

  // ── Round screen ───────────────────────────────────────────────────────
  // Mirrors RoundScreen's markup (with a contained timer bar instead of the
  // real fixed-position one, which would escape the phone frame).
  if (screen === 'round') {
    return (
      <PhoneFrame>
        <div className="mx-auto max-w-md min-h-full p-6 flex flex-col gap-4 pt-6">
          <div className="h-2 w-full overflow-hidden rounded bg-amber-200">
            <div className="h-full bg-emerald-500" style={{ width: '80%' }} />
          </div>
          <p className="text-xs text-gray-600">
            {t('round.progress', { current: round.index + 1, total: 7 })}
          </p>
          <h2 className="font-display font-semibold text-3xl">{round.question}</h2>
          <textarea
            className="w-full p-3 rounded border border-amber-300 text-lg h-40 resize-none"
            placeholder={t('round.placeholder')}
            value={answer}
            maxLength={70}
            readOnly
          />
          <div className="text-right text-sm text-gray-600">{answer.length} / 70</div>
          <button
            className="py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl disabled:bg-gray-300 disabled:text-gray-500"
            disabled={answer.trim().length < 1}
          >
            {t('round.submit')}
          </button>
        </div>
      </PhoneFrame>
    );
  }

  // ── Lobby screen ───────────────────────────────────────────────────────
  // Mirrors LobbyScreen's host view so the recording looks identical.
  if (screen === 'lobby') {
    return (
      <PhoneFrame>
        <div className="mx-auto max-w-md min-h-full p-6 flex flex-col gap-4">
        <div className="text-center">
          <p className="text-sm text-gray-600">{t('lobby.roomCodeLabel')}</p>
          <p className="font-display font-bold text-5xl text-pink-500 tracking-widest">
            {ROOM_CODE}
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 bg-white p-4 rounded">
          <QRCode value={joinUrl} size={160} />
          <p className="text-xs text-gray-600">{t('lobby.qrCaption')}</p>
        </div>

        <button className="py-2 rounded bg-white border border-amber-300 font-semibold">
          {t('lobby.copyLink')}
        </button>

        <PlayerList players={players} hostId={hostId} />

        <button
          className={`py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl transition-transform disabled:bg-gray-300 disabled:text-gray-500 ${
            startPressed ? 'scale-95' : ''
          }`}
          disabled={!canStart}
        >
          {t('lobby.startGame')}
        </button>

        <button className="py-2 text-gray-600 underline self-center">{t('lobby.leave')}</button>
        </div>
      </PhoneFrame>
    );
  }

  // ── Home (start) screen ──────────────────────────────────────────────────
  // Mirrors HomeScreen's create-mode markup.
  return (
    <PhoneFrame>
      <div className="mx-auto max-w-md min-h-full p-6 flex flex-col items-center justify-center gap-6">
      <Wordmark />
      <p className="text-gray-700 text-center">{t('home.subtitle')}</p>

      <div
        className="w-full flex flex-col gap-2 max-h-40 overflow-y-auto pr-1"
        role="group"
        aria-label="Language"
      >
        {LANGUAGES.map((opt) => (
          <button
            key={opt.code}
            ref={(el) => {
              langRefs.current[opt.code] = el;
            }}
            aria-pressed={language === opt.code}
            className={`flex items-center gap-3 rounded px-4 py-3 font-semibold flex-shrink-0 ${
              language === opt.code
                ? 'bg-pink-500 text-white'
                : 'bg-white border border-amber-300 text-gray-800'
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {opt.flag}
            </span>
            <span>{opt.name}</span>
          </button>
        ))}
      </div>

      <input
        className="w-full p-3 rounded border border-amber-300 text-lg"
        placeholder={t('home.nicknamePlaceholder')}
        value={nickname}
        maxLength={20}
        readOnly
      />

      <button
        className={`w-full py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl transition-transform disabled:bg-gray-300 disabled:text-gray-500 ${
          createPressed ? 'scale-95' : ''
        }`}
        disabled={!nicknameValid}
      >
        {t('home.create')}
      </button>

        <SourceFooter sourceQr />
      </div>
    </PhoneFrame>
  );
}

// ── Pseudo Android phone frame ─────────────────────────────────────────────
// A purely cosmetic device mockup around the game so the recording looks like
// it's happening on a phone: black bezel, status bar with a centered punch-hole
// camera, and a bottom gesture pill. The screen area scrolls independently.
function PhoneFrame({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
      <div
        className="relative rounded-[2.75rem] bg-black p-3 shadow-2xl"
        style={{ width: 390, height: 'min(844px, 94vh)' }}
      >
        {/* Screen — brand-cream background with the game's static doodle layer. */}
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.25rem] bg-amber-100">
          <DemoDoodle />
          {/* Android status bar */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-2.5 pb-1 text-[12px] font-semibold text-gray-900">
            <span>9:41</span>
            {/* centered punch-hole camera */}
            <span className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-black ring-2 ring-gray-800" />
            <span className="flex items-center gap-1.5">
              {/* signal */}
              <svg width="16" height="11" viewBox="0 0 16 11" className="fill-current" aria-hidden="true">
                <rect x="0" y="7" width="3" height="4" rx="0.5" />
                <rect x="5" y="4" width="3" height="7" rx="0.5" />
                <rect x="10" y="0" width="3" height="11" rx="0.5" />
              </svg>
              {/* wifi */}
              <svg width="15" height="12" viewBox="0 0 24 24" className="fill-current" aria-hidden="true">
                <path d="M12 18a2 2 0 100 4 2 2 0 000-4zm0-5a6 6 0 00-4.3 1.8l1.5 1.4A4 4 0 0112 16a4 4 0 012.8 1.2l1.5-1.4A6 6 0 0012 13zm0-5C9 8 6.3 9.2 4.4 11.1l1.4 1.4A9 9 0 0112 10a9 9 0 016.2 2.5l1.4-1.4A11 11 0 0012 8z" />
              </svg>
              {/* battery */}
              <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
                <rect x="0.5" y="1" width="21" height="10" rx="2.5" className="fill-none stroke-current" />
                <rect x="2.5" y="3" width="15" height="6" rx="1" className="fill-current" />
                <rect x="23" y="4" width="2.5" height="4" rx="1" className="fill-current" />
              </svg>
            </span>
          </div>

          {/* scrollable app area */}
          <div className="relative z-10 flex-1 overflow-y-auto">{children}</div>

          {/* gesture-navigation pill */}
          <div className="relative z-10 flex justify-center py-2">
            <span className="h-1 w-28 rounded-full bg-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Contained version of the game's BackgroundDoodle — the real one is
// fixed/full-viewport, which would escape the phone frame. Same squiggles,
// same 0.1 opacity, absolutely positioned to fill the phone screen only.
function DemoDoodle(): JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none">
        <g stroke="#1f2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.1">
          <path d="M28 78 q14 -22 28 0 t28 0 t28 0" />
          <path d="M312 132 q12 20 24 0 t24 0" />
          <path d="M52 372 q18 -24 36 0 t36 0" />
          <path d="M286 520 q14 22 28 0 t28 0" />
          <path d="M40 250 q16 18 32 0" />
          <path d="M260 690 q15 -20 30 0 t30 0" />
          <path d="M338 632 a20 20 0 1 1 -12 -17 a12 12 0 1 1 -7 11 a5 5 0 1 1 -3 -6" />
          <path d="M74 596 l7 15 l16 1 l-12 11 l4 16 l-15 -9 l-15 9 l4 -16 l-12 -11 l16 -1 z" />
          <circle cx="206" cy="208" r="7" />
          <circle cx="150" cy="724" r="9" />
          <circle cx="356" cy="372" r="6" />
        </g>
      </svg>
    </div>
  );
}

// Story prose with the player answers highlighted (like ProseText), plus a
// per-answer "jump": the highlighted phrase whose document order matches
// `jumping` scales up; all others stay at normal size.
function StoryProse({
  prose,
  answers,
  jumping,
}: {
  prose: string;
  answers: string[];
  jumping: number;
}): JSX.Element {
  const segments = splitProse(prose, answers);
  let highlightIndex = -1;
  return (
    <p className="font-prose leading-relaxed text-gray-800 text-xl">
      {segments.map((seg, i) => {
        if (!seg.highlight) return <span key={i}>{seg.text}</span>;
        highlightIndex += 1;
        const active = highlightIndex === jumping;
        return (
          <span
            key={i}
            className={`inline-block origin-center font-bold text-pink-600 transition-transform duration-300 ${
              active ? 'scale-150' : 'scale-100'
            }`}
          >
            {seg.text}
          </span>
        );
      })}
    </p>
  );
}
