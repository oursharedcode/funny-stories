// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import BotAvatar from './art/BotAvatar';
import { snappy } from '../styles/motion';
import type { Player } from 'shared';

interface Props {
  players: Player[];
  hostId: string;
}

export default function PlayerList({ players, hostId }: Props) {
  const { t } = useTranslation();
  return (
    <ul className="bg-white rounded divide-y divide-amber-200">
      {players.map((p, i) => (
        <motion.li
          key={p.id}
          className="p-3 flex justify-between items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...snappy, delay: i * 0.05 }}
        >
          <span className={`flex items-center gap-2 ${p.isBot ? 'opacity-60' : ''}`}>
            {p.isBot && <BotAvatar className="h-5 w-5 shrink-0" />}
            {p.nickname}
          </span>
          {p.id === hostId && (
            <span className="text-xs text-pink-500 font-semibold">{t('lobby.host')}</span>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
