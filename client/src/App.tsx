// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import RoundScreen from './screens/RoundScreen';
import WaitingScreen from './screens/WaitingScreen';
import RevealScreen from './screens/RevealScreen';
import EndScreen from './screens/EndScreen';
import BackgroundDoodle from './components/art/BackgroundDoodle';
import { snappy } from './styles/motion';
import { socket } from './socket';
import type {
  ErrorPayload,
  GalleryReadyPayload,
  GameRestartReadyPayload,
  Language,
  LobbyUpdatePayload,
  Player,
  PlayerLostPayload,
  RevealStartPayload,
  RoundStartPayload,
  RoundWaitingPayload,
} from 'shared';

export type GamePhase = 'home' | 'lobby' | 'writing' | 'waiting' | 'reveal' | 'end';

export interface LobbyState {
  roomCode: string;
  socketId: string;
  hostId: string;
  language: Language;
  players: Player[];
  // Deployer's "Support this server" link, or null when unset (spec §20).
  donateUrl: string | null;
}

export default function App() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<GamePhase>('home');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [round, setRound] = useState<RoundStartPayload | null>(null);
  const [waiting, setWaiting] = useState<RoundWaitingPayload | null>(null);
  const [reveal, setReveal] = useState<RevealStartPayload | null>(null);
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gallery, setGallery] = useState<GalleryReadyPayload | null>(null);
  // Nickname of a player lost after the §7 grace window; drives the host's
  // notice banner (spec §12). Only the host's client ever receives the event.
  const [lostPlayer, setLostPlayer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onRoundStart = (data: RoundStartPayload): void => {
      setRound(data);
      setWaiting(null);
      setReveal(null);
      setReadyIds([]);
      setGallery(null);
      setLostPlayer(null);
      setPhase('writing');
    };
    const onRoundWaiting = (data: RoundWaitingPayload): void => {
      setWaiting(data);
      setPhase('waiting');
    };
    const onRevealStart = (data: RevealStartPayload): void => {
      setReveal(data);
      setRound(null);
      setWaiting(null);
      setPhase('reveal');
    };
    const onLobbyUpdate = (data: LobbyUpdatePayload): void => {
      setLobby((prev) =>
        prev
          ? { ...prev, players: data.players, hostId: data.hostId, donateUrl: data.donateUrl }
          : prev,
      );
    };
    const onRestartReady = (data: GameRestartReadyPayload): void => {
      setReadyIds(data.readyIds);
    };
    const onGameOver = (): void => {
      setGameOver(true);
      setLostPlayer(null);
      setPhase('end');
    };
    const onGalleryReady = (data: GalleryReadyPayload): void => {
      setGallery(data);
    };
    const onPlayerLost = (data: PlayerLostPayload): void => {
      setLostPlayer(data.nickname);
    };
    const onError = (data: ErrorPayload): void => {
      // Localize via the error code; fall back to the server's message text.
      setError(t(`errors.${data.code}`, { defaultValue: data.message }));
      window.setTimeout(() => setError(null), 3000);
    };
    socket.on('round:start', onRoundStart);
    socket.on('round:waiting', onRoundWaiting);
    socket.on('reveal:start', onRevealStart);
    socket.on('lobby:update', onLobbyUpdate);
    socket.on('game:restartReady', onRestartReady);
    socket.on('game:over', onGameOver);
    socket.on('gallery:ready', onGalleryReady);
    socket.on('player:lost', onPlayerLost);
    socket.on('error', onError);
    return () => {
      socket.off('round:start', onRoundStart);
      socket.off('round:waiting', onRoundWaiting);
      socket.off('reveal:start', onRevealStart);
      socket.off('lobby:update', onLobbyUpdate);
      socket.off('game:restartReady', onRestartReady);
      socket.off('game:over', onGameOver);
      socket.off('gallery:ready', onGalleryReady);
      socket.off('player:lost', onPlayerLost);
      socket.off('error', onError);
    };
  }, []);

  // "Create a new room" on the host notice (spec §12): end the current game
  // for everyone (game:end → game:over → room deleted), then reload to a fresh
  // Create-mode Home screen.
  function createNewRoom(): void {
    socket.emit('game:end');
    window.location.assign('/');
  }

  let body: JSX.Element;
  if (phase === 'end' && lobby) {
    body = (
      <EndScreen lobby={lobby} readyIds={readyIds} gameOver={gameOver} gallery={gallery} />
    );
  } else if (phase === 'reveal' && reveal) {
    body = <RevealScreen reveal={reveal} onContinue={() => setPhase('end')} />;
  } else if (phase === 'writing' && round) {
    body = <RoundScreen round={round} />;
  } else if (phase === 'waiting' && waiting) {
    body = <WaitingScreen waiting={waiting} />;
  } else if (phase === 'lobby' && lobby) {
    body = (
      <LobbyScreen
        lobby={lobby}
        onLeave={() => {
          setLobby(null);
          setPhase('home');
        }}
      />
    );
  } else {
    body = (
      <HomeScreen
        onJoined={(state) => {
          setLobby(state);
          setPhase('lobby');
        }}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <BackgroundDoodle />
      <div className="relative min-h-screen overflow-x-hidden">
        {/* Forward slide-fade per spec §17: new screen in from the left,
            old screen out to the right. */}
        <AnimatePresence initial={false}>
          <motion.div
            key={phase}
            className="absolute inset-0 overflow-y-auto"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={snappy}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-red-500 px-4 py-2 text-white shadow"
        >
          {error}
        </div>
      )}
      {lostPlayer && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-50 flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-3 rounded-xl border-2 border-pink-500 bg-white p-4 shadow-lg"
        >
          <p className="text-center font-semibold text-gray-800">
            {t('playerLost.label', { nickname: lostPlayer })}
          </p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded bg-pink-500 py-3 font-semibold text-white"
              onClick={() => setLostPlayer(null)}
            >
              {t('playerLost.ignore')}
            </button>
            <button
              className="flex-1 rounded border-2 border-pink-500 bg-white py-3 font-semibold text-pink-500"
              onClick={createNewRoom}
            >
              {t('playerLost.newRoom')}
            </button>
          </div>
        </div>
      )}
    </MotionConfig>
  );
}
