// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TimerBar from '../components/TimerBar';
import SubmitConfirm from '../components/art/SubmitConfirm';
import { socket } from '../socket';
import { LANGUAGES } from '../languages';
import type { Language } from 'shared';

interface RoundData {
  roundNumber: number;
  question: string;
  deadline: number;
}

interface Props {
  round: RoundData;
  // Room content language — the language the story is written/moderated in,
  // fixed by the host. Used for the joiner-only indicator below.
  language: Language;
  isHost: boolean;
}

const ROUND_DURATION_MS = 60_000;
const ANSWER_MAX_LENGTH = 70;

export default function RoundScreen({ round, language, isHost }: Props) {
  const { t, i18n } = useTranslation();
  const storyLang = LANGUAGES.find((opt) => opt.code === language);

  // Dual-display gloss (spec §8/§9): when a joiner has set the UI language to
  // something other than the room's content language, show the question in
  // their UI language as a small secondary line beneath the primary
  // (room-language) prompt. The primary stays in the room language because the
  // answer must be written in it; the gloss only aids comprehension. The
  // per-language question set mirrors the authoritative server copy (the only
  // one ever sent in `round:start`); it lives in client i18n alongside the
  // other UI strings and is keyed by round index.
  const glossQuestions = i18n.getResource(i18n.language, 'translation', 'questions') as
    | string[]
    | undefined;
  const questionGloss =
    i18n.language !== language ? glossQuestions?.[round.roundNumber] : undefined;
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAnswer('');
    setSubmitted(false);
    taRef.current?.focus();
  }, [round.roundNumber]);

  function submit(): void {
    if (submitted) return;
    setSubmitted(true);
    socket.emit('round:submit', { answer });
  }

  // Item 9 of BUGS_AND_IMPROVEMENTS_02.md — block explicit submission of an
  // empty (or whitespace-only) answer. The bot stand-in / timer-expiry path
  // is unchanged: a player who doesn't submit at all still gets a stand-in
  // filled in. This rule only governs the manual Submit affordance.
  const canSubmit = answer.trim().length >= 1;

  const counterColor =
    answer.length >= 70 ? 'text-red-500' : answer.length >= 60 ? 'text-amber-600' : 'text-gray-600';

  return (
    <div className="mx-auto max-w-md min-h-screen p-6 flex flex-col gap-4 pt-6">
      <TimerBar deadline={round.deadline} duration={ROUND_DURATION_MS} />
      <p className="text-xs text-gray-600">
        {t('round.progress', { current: round.roundNumber + 1, total: 7 })}
      </p>
      <h2 className="font-display font-semibold text-3xl">{round.question}</h2>
      {/* Secondary gloss in the joiner's UI language (spec §8/§9). */}
      {questionGloss && <p className="text-base italic text-gray-500">{questionGloss}</p>}
      {/* Constant story-language indicator, joiners only (spec §8). The host
          picked this language so they already know it; the joiner gets a quiet
          reminder of which language to write their answer in. */}
      {!isHost && storyLang && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-lg" aria-hidden="true">
            {storyLang.flag}
          </span>
          <span>
            {t('round.storyLanguage')}: {storyLang.name}
          </span>
        </div>
      )}
      {/* Answer font bumped 70% from text-lg (1.125rem → 1.9125rem) so typed
          words are large and legible across every language. */}
      <textarea
        ref={taRef}
        className="w-full p-3 rounded border border-amber-300 text-[1.9125rem] h-40 resize-none"
        placeholder={t('round.placeholder')}
        value={answer}
        maxLength={ANSWER_MAX_LENGTH}
        disabled={submitted}
        onChange={(e) => setAnswer(e.target.value)}
        autoFocus
      />
      <div className={`text-right text-sm ${counterColor}`}>
        {answer.length} / {ANSWER_MAX_LENGTH}
      </div>
      <button
        className="py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl disabled:bg-gray-300 disabled:text-gray-500"
        disabled={submitted || !canSubmit}
        onClick={submit}
      >
        {submitted ? t('round.submitted') : t('round.submit')}
      </button>

      {submitted && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <SubmitConfirm className="h-40 w-40" />
        </div>
      )}
    </div>
  );
}
