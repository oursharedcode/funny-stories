// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import WaitingMascot from '../components/art/WaitingMascot';
import { snappy } from '../styles/motion';

interface WaitingData {
  submitted: number;
  total: number;
}

interface Props {
  waiting: WaitingData;
}

export default function WaitingScreen({ waiting }: Props) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md min-h-screen p-6 flex flex-col items-center justify-center gap-6">
      <WaitingMascot className="h-32 w-32" />
      <h2 className="font-display font-semibold text-3xl text-pink-500">
        {t('waiting.title')}
      </h2>
      <motion.p
        key={waiting.submitted}
        className="text-gray-700 text-xl"
        initial={{ scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={snappy}
      >
        {t('waiting.progress', { submitted: waiting.submitted, total: waiting.total })}
      </motion.p>
      <p className="text-gray-500 text-sm">{t('waiting.ellipsis')}</p>
    </div>
  );
}
