// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProseText from './ProseText';
import LogoStamp from './LogoStamp';
import ShareButton from './ShareButton';
import { buildStoryImageFile, downloadStoryImage } from '../downloadStory';
import { buildWobbleVideoFile, isVideoRecordingSupported } from '../recordWobble';
import { canShareFiles, downloadFile, shareFiles } from '../share';
import type { GalleryEntry, WobbleEngine } from 'shared';

interface Props {
  entries: GalleryEntry[];
  // Engine to use for the Share-as-video recorder. Comes from the room's
  // host choice (broadcast via lobby:update) so every player records with
  // the same engine instead of consulting their own per-device preference.
  wobbleEngine: WobbleEngine;
}

// The shared room gallery (spec §24): every story + its picture, browsed one at
// a time. Bot slots and ungenerated stories show a no-picture placeholder.
export default function RoomGallery({ entries, wobbleEngine }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const videoSupported = isVideoRecordingSupported();
  // Whether to offer the native-share buttons. Web Share with files is present
  // on mobile + Chromium desktop and absent on desktop Firefox; there the
  // download buttons alone remain. It's a static browser capability.
  const shareSupported = canShareFiles();

  if (entries.length === 0) return null;
  // entries can be re-broadcast as late pictures arrive; keep the index valid.
  const safeIndex = Math.min(index, entries.length - 1);
  const entry = entries[safeIndex]!;

  function step(delta: number): void {
    setIndex((safeIndex + delta + entries.length) % entries.length);
  }

  // Short title/text that ride along with the shared file where the platform
  // surfaces them (e.g. the suggested message). The file is the real payload.
  function shareMeta(): { title: string; text: string } {
    return {
      title: t('home.title'),
      text: t('gallery.storyBy', { nickname: entry.nickname }),
    };
  }

  // Native-share the still image; fall back to a download if the platform
  // declines the file (so the button is never a dead end).
  async function shareImage(): Promise<void> {
    const file = await buildStoryImageFile({
      nickname: entry.nickname,
      prose: entry.prose,
      pictureUrl: entry.pictureUrl,
    });
    if ((await shareFiles([file], shareMeta())) === 'unsupported') downloadFile(file);
  }

  // Records the 5-second clip with the room's engine and returns the file.
  // Lottie stays a lazy import — its ~250 KB only loads when a player with that
  // engine actually records, whether they download or share.
  async function buildVideoFile(pictureUrl: string): Promise<File> {
    if (wobbleEngine === 'lottie') {
      const { buildWobbleVideoFileLottie } = await import('../recordWobbleLottie');
      return buildWobbleVideoFileLottie({
        nickname: entry.nickname,
        prose: entry.prose,
        pictureUrl,
      });
    }
    return buildWobbleVideoFile({
      nickname: entry.nickname,
      prose: entry.prose,
      pictureUrl,
    });
  }

  async function downloadVideo(): Promise<void> {
    if (!entry.pictureUrl || recording) return;
    setRecording(true);
    try {
      downloadFile(await buildVideoFile(entry.pictureUrl));
    } finally {
      setRecording(false);
    }
  }

  async function shareVideo(): Promise<void> {
    if (!entry.pictureUrl || recording) return;
    setRecording(true);
    try {
      const file = await buildVideoFile(entry.pictureUrl);
      if ((await shareFiles([file], shareMeta())) === 'unsupported') downloadFile(file);
    } finally {
      setRecording(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4">
      <h3 className="font-display text-xl font-semibold text-pink-500">
        {t('gallery.title')}
      </h3>

      <p className="text-sm text-gray-600">
        {t('gallery.storyBy', { nickname: entry.nickname })}
      </p>

      {entry.pictureUrl ? (
        // Three stacked wrappers each carry one of the four CSS-keyframe
        // wobble axes; the innermost img carries the pulse-free transform.
        // The recorded WebM mirrors this composition in recordWobble.ts.
        <div className="relative">
          <div className="picture-wobble-drift">
            <div className="picture-wobble-jiggle">
              <div className="picture-wobble-zoom">
                <img
                  src={entry.pictureUrl}
                  alt={t('gallery.pictureAlt', { nickname: entry.nickname })}
                  className="w-full rounded-lg shadow"
                />
              </div>
            </div>
          </div>
          <LogoStamp />
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50">
          <p className="text-sm text-gray-500">{t('gallery.noPicture')}</p>
        </div>
      )}

      <ProseText prose={entry.prose} answers={entry.answers} className="text-lg" />

      {/* Download the still image, with a native Share button on its right
          (supported browsers only). */}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded border border-amber-300 bg-white px-4 py-3 font-semibold text-pink-500"
          onClick={() =>
            void downloadStoryImage({
              nickname: entry.nickname,
              prose: entry.prose,
              pictureUrl: entry.pictureUrl,
            })
          }
        >
          {entry.pictureUrl ? t('gallery.download') : t('gallery.downloadStoryOnly')}
        </button>
        {shareSupported && (
          <ShareButton label={t('gallery.shareButton')} onClick={() => void shareImage()} />
        )}
      </div>

      {entry.pictureUrl && videoSupported && (
        // Download the 5-second video, with a native Share button on its right
        // (supported browsers only).
        <div className="flex gap-2">
          <button
            className="flex-1 rounded border border-amber-300 bg-white px-4 py-3 font-semibold text-pink-500 disabled:cursor-wait disabled:opacity-60"
            disabled={recording}
            onClick={() => void downloadVideo()}
          >
            {recording ? t('gallery.recording') : t('gallery.downloadVideo')}
          </button>
          {shareSupported && (
            <ShareButton
              label={t('gallery.shareButton')}
              disabled={recording}
              onClick={() => void shareVideo()}
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          className="rounded bg-white px-5 py-3 font-semibold text-pink-500"
          onClick={() => step(-1)}
          aria-label={t('gallery.prev')}
        >
          ◀
        </button>
        <span className="text-sm text-gray-600">
          {t('gallery.counter', { index: safeIndex + 1, total: entries.length })}
        </span>
        <button
          className="rounded bg-white px-5 py-3 font-semibold text-pink-500"
          onClick={() => step(1)}
          aria-label={t('gallery.next')}
        >
          ▶
        </button>
      </div>
    </section>
  );
}
