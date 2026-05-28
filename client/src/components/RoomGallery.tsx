// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProseText from './ProseText';
import LogoStamp from './LogoStamp';
import { downloadStoryImage } from '../downloadStory';
import type { GalleryEntry } from 'shared';

interface Props {
  entries: GalleryEntry[];
}

// The shared room gallery (spec §24): every story + its picture, browsed one at
// a time. Bot slots and ungenerated stories show a no-picture placeholder.
export default function RoomGallery({ entries }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  if (entries.length === 0) return null;
  // entries can be re-broadcast as late pictures arrive; keep the index valid.
  const safeIndex = Math.min(index, entries.length - 1);
  const entry = entries[safeIndex]!;

  function step(delta: number): void {
    setIndex((safeIndex + delta + entries.length) % entries.length);
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
        <div className="relative">
          <img
            src={entry.pictureUrl}
            alt={t('gallery.pictureAlt', { nickname: entry.nickname })}
            className="w-full rounded-lg shadow"
          />
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
