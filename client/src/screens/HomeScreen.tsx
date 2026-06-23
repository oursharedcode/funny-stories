// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import Wordmark from '../components/art/Wordmark';
import QRCode from '../components/QRCode';
import SourceFooter from '../components/SourceFooter';
import { LANGUAGES, isLanguage } from '../languages';
import type { LobbyState } from '../App';
import type { Language, StatsPayload } from 'shared';

interface Props {
  onJoined: (state: LobbyState) => void;
}

// The Home screen has two modes (spec §8). A `?room=` URL parameter — carried by
// every invite link and QR code — means the visitor is joining a specific room;
// its absence means they are creating one. There is no manual room-code entry.
export default function HomeScreen({ onJoined }: Props) {
  const { t, i18n } = useTranslation();

  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room')?.toUpperCase() ?? '';
  const urlLang = params.get('lang');

  const [mode, setMode] = useState<'create' | 'join'>(urlRoom ? 'join' : 'create');
  const [nickname, setNickname] = useState('');
  const [language, setLanguage] = useState<Language>(isLanguage(urlLang) ? urlLang : 'en');
  const [error, setError] = useState<string | null>(null);
  const [roomGone, setRoomGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  // A joiner who explicitly cycles the UI language must keep that choice — it
  // must not be clobbered by the room's content language on join (see join()).
  const [uiLangTouched, setUiLangTouched] = useState(false);

  // When the invite link carries the room language (`?room=CODE&lang=ru`),
  // render the join screen in that language immediately rather than waiting for
  // the join ack to arrive.
  useEffect(() => {
    if (isLanguage(urlLang)) void i18n.changeLanguage(urlLang);
  }, [urlLang, i18n]);

  // Create mode is the host's screen (spec §8) — fetch server stats once so
  // the host sees the open-room counter and the day's image usage (§13, §15),
  // then subscribe to stats:update so the counter ticks visibly when other
  // rooms generate pictures or open/close (§26, item 22 of
  // BUGS_AND_IMPROVEMENTS_01.md).
  useEffect(() => {
    if (mode !== 'create') return;
    socket.emit('stats:get', (s) => setStats(s));
    const onStatsUpdate = (s: StatsPayload): void => setStats(s);
    socket.on('stats:update', onStatsUpdate);
    return () => {
      socket.off('stats:update', onStatsUpdate);
    };
  }, [mode]);

  function switchLanguage(lang: Language): void {
    setLanguage(lang);
    void i18n.changeLanguage(lang);
  }

  // Joiner-only UI-language control (spec §8): a small button that cycles the
  // interface language to the next registry entry on each press, independent of
  // the room's content language — the host fixed that and the joiner can't
  // change it. This only touches i18n display, never the `language` content
  // state used by the host's room:create payload.
  function cycleUiLanguage(): void {
    setUiLangTouched(true);
    const idx = LANGUAGES.findIndex((opt) => opt.code === i18n.language);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
    void i18n.changeLanguage(next.code);
  }

  const uiLang = LANGUAGES.find((opt) => opt.code === i18n.language) ?? LANGUAGES[0];

  function create(): void {
    setError(null);
    setBusy(true);
    socket.emit('room:create', { nickname: nickname.trim(), language }, (ack) => {
      setBusy(false);
      onJoined({
        roomCode: ack.roomCode,
        socketId: ack.socketId,
        hostId: ack.socketId,
        language,
        players: [{ id: ack.socketId, nickname: nickname.trim(), isBot: false }],
        donateUrl: null,
        wobbleEngine: 'lottie',
      });
    });
  }

  function join(): void {
    setError(null);
    setRoomGone(false);
    setBusy(true);
    socket.emit('room:join', { roomCode: urlRoom, nickname: nickname.trim() }, (ack) => {
      setBusy(false);
      if ('error' in ack) {
        // A stale or recycled link points at a room that no longer exists —
        // show a clear message and the escape hatch instead of a terse error.
        if (ack.error.code === 'ROOM_NOT_FOUND') {
          setRoomGone(true);
        } else {
          setError(t(`errors.${ack.error.code}`, { defaultValue: ack.error.message }));
        }
        return;
      }
      // Default the joiner's UI to the room's content language — unless they
      // explicitly cycled to a different one on this screen, which we preserve.
      if (!uiLangTouched) void i18n.changeLanguage(ack.language);
      onJoined({
        roomCode: urlRoom,
        socketId: ack.socketId,
        hostId: ack.hostId,
        language: ack.language,
        players: ack.players,
        donateUrl: null,
        // Placeholder — the lobby:update fired by the server right after
        // join will overwrite this with the host's actual choice.
        wobbleEngine: 'lottie',
      });
    });
  }

  // Stale-link escape hatch: leave Join mode for Create mode. Strips the
  // `?room=` / `?lang=` parameters so a refresh doesn't return to the dead link.
  function startOver(): void {
    window.history.replaceState(null, '', window.location.pathname);
    setError(null);
    setRoomGone(false);
    setMode('create');
  }

  const nicknameValid = nickname.trim().length >= 3 && nickname.trim().length <= 20;

  return (
    <div className="mx-auto max-w-md min-h-screen p-6 flex flex-col items-center justify-center gap-6">
      <Wordmark />
      <p className="text-gray-700 text-center">{t('home.subtitle')}</p>

      {mode === 'create' && (
        <>
          {/* Scrollable language list. With 11+ options the static list ran the
              page off-screen on a phone; clamp the visible height so 2.5 rows
              show at once and the cut-off third row hints at more below. Each
              row is ~64px (px-4 + py-3 around a text-base label + text-2xl
              flag), so max-h-40 (160px) lands the third row at ~50%. */}
          <div
            className="w-full flex flex-col gap-2 max-h-40 overflow-y-auto pr-1"
            role="group"
            aria-label="Language"
          >
            {LANGUAGES.map((opt) => (
              <button
                key={opt.code}
                aria-pressed={language === opt.code}
                className={`flex items-center gap-3 rounded px-4 py-3 font-semibold flex-shrink-0 ${
                  language === opt.code
                    ? 'bg-pink-500 text-white'
                    : 'bg-white border border-amber-300 text-gray-800'
                }`}
                onClick={() => switchLanguage(opt.code)}
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
            onChange={(e) => setNickname(e.target.value)}
          />

          <button
            className="w-full py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl disabled:bg-gray-300 disabled:text-gray-500"
            disabled={!nicknameValid || busy}
            onClick={create}
          >
            {t('home.create')}
          </button>

          {stats && (
            <div className="text-sm text-gray-600 text-center">
              <p>{t('home.openRooms', { count: stats.openRooms })}</p>
              <p>
                {t('home.imagesToday', {
                  total: stats.imagesLimit,
                })}
              </p>
            </div>
          )}
        </>
      )}

      {mode === 'join' && roomGone && (
        <div className="w-full flex flex-col items-center gap-4">
          <p className="text-center text-gray-700">{t('home.roomGone')}</p>
          <button
            className="w-full py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl"
            onClick={startOver}
          >
            {t('home.createNew')}
          </button>
        </div>
      )}

      {mode === 'join' && !roomGone && (
        <>
          {/* Joiner-only UI-language toggle (spec §8). Small, self-contained
              button: each tap advances to the next language; the joiner stops
              pressing when the interface reads the way they want. */}
          <button
            type="button"
            className="self-end flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700"
            onClick={cycleUiLanguage}
            aria-label={t('home.uiLanguage')}
            title={t('home.uiLanguage')}
          >
            <span className="text-lg" aria-hidden="true">
              {uiLang.flag}
            </span>
            <span>{uiLang.name}</span>
          </button>

          <div className="w-full text-center">
            <p className="text-sm text-gray-600">{t('home.joining')}</p>
            <p className="font-display font-bold text-4xl text-pink-500 tracking-widest">
              {urlRoom}
            </p>
          </div>

          {/* Mirror the lobby's QR pattern: show the same join link as a QR
              so a joiner can pass their phone to nearby friends instead of
              re-typing the room code or chasing a fresh link. The encoded
              URL preserves `?lang=` when present, matching LobbyScreen. */}
          <div className="flex flex-col items-center gap-2 bg-white p-4 rounded">
            <QRCode
              value={`${window.location.origin}/?room=${urlRoom}${
                urlLang ? `&lang=${urlLang}` : ''
              }`}
              size={160}
            />
            <p className="text-xs text-gray-600">{t('lobby.qrCaption')}</p>
          </div>

          <input
            className="w-full p-3 rounded border border-amber-300 text-lg"
            placeholder={t('home.nicknamePlaceholder')}
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
          />

          <button
            className="w-full py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl disabled:bg-gray-300 disabled:text-gray-500"
            disabled={!nicknameValid || busy}
            onClick={join}
          >
            {t('home.join')}
          </button>

          {error && (
            <div className="w-full flex flex-col items-center gap-3">
              <p className="text-red-500 text-center">{error}</p>
              <button
                className="w-full py-3 rounded bg-white border-2 border-pink-500 text-pink-500 font-display font-semibold text-xl"
                onClick={startOver}
              >
                {t('home.createNew')}
              </button>
            </div>
          )}
        </>
      )}

      <SourceFooter sourceQr={mode === 'create'} />
    </div>
  );
}
