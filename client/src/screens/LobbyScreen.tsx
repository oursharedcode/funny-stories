// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import PlayerList from '../components/PlayerList';
import QRCode from '../components/QRCode';
import { hoursUntilUtcMidnight, isCapReached } from '../capReset';
import type { LobbyState } from '../App';
import type { StatsPayload } from 'shared';

interface Props {
  lobby: LobbyState;
  onLeave: () => void;
}

export default function LobbyScreen({ lobby, onLeave }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  // Subscribe to the live stats broadcast (spec §26) so the lobby reflects
  // the daily cap state in real time — item 4 of BUGS_AND_IMPROVEMENTS_02.md.
  // Everyone in the lobby (host and guests alike) sees the cap-reached
  // banner when the day's image allowance has been spent, so nobody is
  // surprised mid-game when the cartoons stop appearing at reveal.
  useEffect(() => {
    socket.emit('stats:get', (s) => setStats(s));
    const onStatsUpdate = (s: StatsPayload): void => setStats(s);
    socket.on('stats:update', onStatsUpdate);
    return () => {
      socket.off('stats:update', onStatsUpdate);
    };
  }, []);

  // Carry the room language so the invitee's join screen renders in it from the
  // first paint (HomeScreen reads `?lang=`). The QR code encodes the same URL.
  const joinUrl = `${window.location.origin}/?room=${lobby.roomCode}&lang=${lobby.language}`;
  const isHost = lobby.socketId === lobby.hostId;
  const canStart = lobby.players.length >= 3;
  const capReached = isCapReached(stats);

  function copyLink(): void {
    const flash = (): void => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(joinUrl).then(flash, fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy(): void {
      const ta = document.createElement('textarea');
      ta.value = joinUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flash();
    }
  }

  function leave(): void {
    socket.emit('room:leave');
    onLeave();
  }

  function startGame(): void {
    // Lottie is the only supported wobble engine — the Home-screen toggle was
    // removed, so every room renders + records with Lottie for host and
    // joiners alike. The server stores it on the room and broadcasts it via
    // lobby:update.
    socket.emit('game:start', { wobbleEngine: 'lottie' });
  }

  return (
    <div className="mx-auto max-w-md min-h-screen p-6 flex flex-col gap-4">
      <div className="text-center">
        <p className="text-sm text-gray-600">{t('lobby.roomCodeLabel')}</p>
        <p className="font-display font-bold text-5xl text-pink-500 tracking-widest">
          {lobby.roomCode}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 bg-white p-4 rounded">
        <QRCode value={joinUrl} size={160} />
        <p className="text-xs text-gray-600">{t('lobby.qrCaption')}</p>
      </div>

      <button
        className="py-2 rounded bg-white border border-amber-300 font-semibold"
        onClick={copyLink}
      >
        {copied ? t('lobby.copied') : t('lobby.copyLink')}
      </button>

      <PlayerList players={lobby.players} hostId={lobby.hostId} />

      {capReached && (
        <div
          className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          <p>{t('lobby.capReached', { hours: hoursUntilUtcMidnight() })}</p>
          {isHost && <p className="mt-1 text-amber-800">{t('lobby.capReachedHost')}</p>}
        </div>
      )}

      {isHost ? (
        <button
          className="py-3 rounded bg-pink-500 text-white font-display font-semibold text-xl disabled:bg-gray-300 disabled:text-gray-500"
          disabled={!canStart}
          title={!canStart ? t('lobby.startDisabled') : ''}
          onClick={startGame}
        >
          {t('lobby.startGame')}
        </button>
      ) : (
        <p className="text-center text-gray-600">{t('lobby.waitingForHost')}</p>
      )}

      <button className="py-2 text-gray-600 underline self-center" onClick={leave}>
        {t('lobby.leave')}
      </button>
    </div>
  );
}
