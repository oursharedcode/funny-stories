// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TimerBar from '../components/TimerBar';
import SubmitConfirm from '../components/art/SubmitConfirm';
import { socket } from '../socket';

interface RoundData {
  roundNumber: number;
  question: string;
  deadline: number;
}

interface Props {
  round: RoundData;
}

const ROUND_DURATION_MS = 60_000;
const ANSWER_MAX_LENGTH = 70;

export default function RoundScreen({ round }: Props) {
  const { t } = useTranslation();
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
      <textarea
        ref={taRef}
        className="w-full p-3 rounded border border-amber-300 text-lg h-40 resize-none"
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
