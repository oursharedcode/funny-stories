// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import EndMascots from '../components/art/EndMascots';
import RoomGallery from '../components/RoomGallery';
import QRCode from '../components/QRCode';
import { SOURCE_URL } from '../sourceUrl';
import { APP_VERSION, BUILD_DATE } from '../version';
import type { LobbyState } from '../App';
import type { GalleryReadyPayload } from 'shared';

interface Props {
  lobby: LobbyState;
  // socket.ids of non-bot players who have toggled "ready" (spec §5).
  readyIds: string[];
  // True once the host has ended the game — controls are hidden, terminal view.
  gameOver: boolean;
  // The shared room gallery, or null until the host shares it (spec §24).
  gallery: GalleryReadyPayload | null;
}

export default function EndScreen({ lobby, readyIds, gameOver, gallery }: Props) {
  const { t } = useTranslation();

  const isHost = lobby.socketId === lobby.hostId;
  const nonBots = lobby.players.filter((p) => !p.isBot);
  const nonHostNonBots = nonBots.filter((p) => p.id !== lobby.hostId);
  const enoughPlayers = nonBots.length >= 3;
  const allReady = nonHostNonBots.every((p) => readyIds.includes(p.id));
  const canRestart = enoughPlayers && allReady;
  const iAmReady = readyIds.includes(lobby.socketId);

  function restart(): void {
    socket.emit('game:restart');
  }
  function finish(): void {
    socket.emit('game:end');
  }
  function toggleReady(): void {
    socket.emit('game:ready', { ready: !iAmReady });
  }
  function shareGallery(): void {
    socket.emit('gallery:share');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <img
        src="/monkeys-on-bus.png"
        alt=""
        className="h-[50vh] w-full object-cover"
      />

      <div className="flex flex-col items-center gap-4 p-6">
        <EndMascots className="-mt-16 h-24 w-36" />
        {/* Item 8 of BUGS_AND_IMPROVEMENTS_02.md — "Игра окончена" felt
            premature while the gallery / restart flow was still ahead. The
            screen now reads "Rounds are over" until the host's Finish Game
            action flips gameOver, at which point it becomes the terminal
            "Game is over". */}
        <h2 className="font-display text-3xl font-bold text-pink-500">
          {gameOver ? t('end.title') : t('end.roundsOver')}
        </h2>

        {gallery ? (
          <RoomGallery entries={gallery.entries} wobbleEngine={lobby.wobbleEngine} />
        ) : isHost && !gameOver ? (
          <button
            className="w-full rounded bg-pink-500 py-3 font-display text-xl font-semibold text-white"
            onClick={shareGallery}
          >
            {t('gallery.share')}
          </button>
        ) : null}

        {gameOver ? null : isHost ? (
          <>
            <button
              className="w-full rounded bg-pink-500 py-3 font-display text-xl font-semibold text-white disabled:bg-gray-300 disabled:text-gray-500"
              disabled={!canRestart}
              onClick={restart}
            >
              {t('end.oneMoreGame')}
            </button>
            {!canRestart && (
              <p className="text-center text-sm text-gray-600">
                {!enoughPlayers ? t('end.needPlayers') : t('end.waitingForReady')}
              </p>
            )}
            <button
              className="w-full rounded border-2 border-pink-500 bg-white py-3 font-display text-xl font-semibold text-pink-500"
              onClick={finish}
            >
              {t('end.finishGame')}
            </button>
          </>
        ) : gallery === null ? (
          // Item 11 of BUGS_AND_IMPROVEMENTS_02.md — the ready toggle is
          // gated on the gallery being visible to the joiner. Before
          // gallery:share fires, "ready for a new game?" feels premature —
          // players haven't seen the current game's pictures yet. Show the
          // existing waiting-for-host message instead.
          <p className="text-center text-sm text-gray-600">{t('end.waitingForHost')}</p>
        ) : (
          <>
            <button
              className={`w-full rounded py-3 font-display text-xl font-semibold text-white ${
                iAmReady ? 'bg-green-500' : 'bg-pink-500'
              }`}
              onClick={toggleReady}
            >
              {iAmReady ? t('end.readyActive') : t('end.ready')}
            </button>
            {iAmReady && (
              <p className="text-center text-sm text-gray-600">{t('end.waitingForHost')}</p>
            )}
          </>
        )}

        {lobby.donateUrl && (
          <a
            href={lobby.donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-sm text-gray-500 underline"
          >
            {t('endScreen.supportServer')}
          </a>
        )}

        {/* Mirrors the downloadable picture's footer (downloadStory.ts):
            content-responsibility notice, then QR + source label + URL. */}
        <footer className="mt-6 flex w-full flex-col items-center gap-3 text-center text-xs text-gray-500">
          <p className="px-2 italic text-gray-600">{t('footer.contentNotice')}</p>
          <div className="flex items-center gap-3">
            <QRCode value={SOURCE_URL} size={96} />
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-semibold text-gray-700">
                {t('footer.source')}
              </span>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-xs text-gray-700 underline"
              >
                {SOURCE_URL}
              </a>
            </div>
          </div>
          <p className="text-gray-400">
            v{APP_VERSION} · {BUILD_DATE}
          </p>
        </footer>
      </div>
    </div>
  );
}
