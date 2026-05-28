// SPDX-License-Identifier: AGPL-3.0-only

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { goofy } from '../../styles/motion';

// The wordmark — Fredoka in brand pink, slightly tilted, bounces in on mount
// (DESIGN_SYSTEM §5). The text is per-language via the home.title i18n key:
// "Funny Stories" in English, "ЧЕПУ-ХА-ХА" in Russian.

interface Props {
  className?: string;
}

export default function Wordmark({ className = '' }: Props) {
  const { t } = useTranslation();
  return (
    <motion.h1
      className={`font-display font-bold text-5xl md:text-6xl text-pink-500 ${className}`}
      initial={{ scale: 0.3, rotate: -14, opacity: 0 }}
      animate={{ scale: 1, rotate: -4, opacity: 1 }}
      transition={goofy}
    >
      {t('home.title')}
    </motion.h1>
  );
}
