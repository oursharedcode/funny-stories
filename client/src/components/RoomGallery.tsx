// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProseText from './ProseText';
import LogoStamp from './LogoStamp';
import { downloadStoryImage } from '../downloadStory';
import { isVideoRecordingSupported, recordWobbleVideo } from '../recordWobble';
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

  if (entries.length === 0) return null;
  // entries can be re-broadcast as late pictures arrive; keep the index valid.
  const safeIndex = Math.min(index, entries.length - 1);
  const entry = entries[safeIndex]!;

  function step(delta: number): void {
    setIndex((safeIndex + delta + entries.length) % entries.length);
  }

  async function shareVideo(): Promise<void> {
    if (!entry.pictureUrl || recording) return;
    setRecording(true);
    try {
      // Lottie is the opt-in path — its ~250 KB stays out of the main bundle
      // until a user with `engine === 'lottie'` actually taps share. CSS is
      // the default and incurs no extra import.
      if (wobbleEngine === 'lottie') {
        const { recordWobbleVideoLottie } = await import('../recordWobbleLottie');
        await recordWobbleVideoLottie({
          nickname: entry.nickname,
          prose: entry.prose,
          pictureUrl: entry.pictureUrl,
        });
      } else {
        await recordWobbleVideo({
          nickname: entry.nickname,
          prose: entry.prose,
          pictureUrl: entry.pictureUrl,
        });
      }
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

      <button
        className="w-full rounded border border-amber-300 bg-white px-4 py-3 font-semibold text-pink-500"
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

      {entry.pictureUrl && videoSupported && (
        <button
          className="w-full rounded border border-amber-300 bg-white px-4 py-3 font-semibold text-pink-500 disabled:cursor-wait disabled:opacity-60"
          disabled={recording}
          onClick={() => void shareVideo()}
        >
          {recording ? t('gallery.recording') : t('gallery.shareVideo')}
        </button>
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
