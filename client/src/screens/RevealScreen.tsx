// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import ProseText from '../components/ProseText';
import LogoStamp from '../components/LogoStamp';
import PictureFlourish from '../components/art/PictureFlourish';
import WaitingMascot from '../components/art/WaitingMascot';
import ErrorMascot from '../components/art/ErrorMascot';
import { hoursUntilUtcMidnight } from '../capReset';
import type {
  RevealPictureErrorCode,
  RevealPictureErrorPayload,
  RevealPictureReadyPayload,
  RevealStartPayload,
} from 'shared';

interface Props {
  reveal: RevealStartPayload;
  // Self-paced navigation to the end screen (spec §16 step 10).
  onContinue: () => void;
}

type PictureStatus = 'loading' | 'ready' | 'error';

// Picture generation runs automatically (spec §11). The "summoning" wait
// control only appears once generation has been running longer than this, so a
// fast result never flashes a spinner.
const WAIT_CONTROL_DELAY_MS = 3000;

export default function RevealScreen({ reveal, onContinue }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PictureStatus>('loading');
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCode, setErrorCode] = useState<RevealPictureErrorCode | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showWait, setShowWait] = useState(false);

  // Register listeners and kick off generation automatically on mount — there
  // is no manual "Generate Picture" button anymore (spec §8, §11).
  useEffect(() => {
    const onReady = (data: RevealPictureReadyPayload): void => {
      setPictureUrl(data.pictureUrl);
      setStatus('ready');
    };
    const onError = (data: RevealPictureErrorPayload): void => {
      setErrorMsg(data.message);
      setErrorCode(data.code ?? null);
      setStatus('error');
    };
    socket.on('reveal:pictureReady', onReady);
    socket.on('reveal:pictureError', onError);
    socket.emit('reveal:requestPicture');
    return () => {
      socket.off('reveal:pictureReady', onReady);
      socket.off('reveal:pictureError', onError);
    };
  }, []);

  // Reveal the funny wait control only once generation has run past the delay.
  useEffect(() => {
    setShowWait(false);
    if (status !== 'loading') return;
    const timer = window.setTimeout(() => setShowWait(true), WAIT_CONTROL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  function retry(): void {
    setErrorMsg('');
    setErrorCode(null);
    setStatus('loading');
    socket.emit('reveal:retryPicture');
  }

  // Cap-reached errors get the i18n'd "oven is full, new cartoons in ~N
  // hours" caption (item 4 of BUGS_AND_IMPROVEMENTS_02.md). Anything else
  // falls back to the server's English message or the existing i18n
  // default. Retry stays useful: a CAP_REACHED retry simply re-shows the
  // same caption until UTC midnight rolls over.
  const displayError =
    errorCode === 'CAP_REACHED'
      ? t('reveal.capReached', { hours: hoursUntilUtcMidnight() })
      : errorMsg || t('reveal.error');

  return (
    <div className="mx-auto max-w-md min-h-screen p-6 flex flex-col gap-6">
      <h2 className="font-display font-semibold text-2xl text-pink-500">
        {t('reveal.title')}
      </h2>

      <ProseText prose={reveal.prose} answers={reveal.answers} className="text-xl" />

      {status === 'ready' && pictureUrl ? (
        <div className="relative">
          <img
            src={pictureUrl}
            alt={t('reveal.pictureAlt')}
            onLoad={() => setImgLoaded(true)}
            className={`w-full rounded-xl shadow-lg transition-all duration-500 ease-out ${
              imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
          {imgLoaded && (
            <PictureFlourish className="pointer-events-none absolute inset-0 h-full w-full" />
          )}
          {imgLoaded && <LogoStamp />}
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <ErrorMascot className="h-28 w-28" />
          <p className="text-center text-gray-700">{displayError}</p>
          <button
            className="rounded bg-pink-500 px-6 py-3 font-display text-lg font-semibold text-white"
            onClick={retry}
          >
            {t('reveal.retry')}
          </button>
        </div>
      ) : showWait ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <WaitingMascot className="h-28 w-28" />
          <p className="text-gray-600">{t('reveal.spinner')}</p>
        </div>
      ) : null}

      <button
        className="mt-auto self-center py-2 font-display font-semibold text-pink-500 underline"
        onClick={onContinue}
      >
        {t('reveal.continue')}
      </button>
    </div>
  );
}
