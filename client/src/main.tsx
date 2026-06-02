// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import TestShareScreen from './screens/TestShareScreen';
import TestImageScreen from './screens/TestImageScreen';
import TestDemoScreen from './screens/TestDemoScreen';
import TestDemoImageScreen from './screens/TestDemoImageScreen';
import { installSwReloadListener } from './swReload';
import './i18n';
import './styles/index.css';

installSwReloadListener();

// Developer-only test harness for the share-video recorders. Activated by
// visiting /?test=share — renders a minimal page that runs either recorder
// against a placeholder cartoon, bypassing the whole socket / room / game
// flow. Branching at this level (instead of inside <App>) keeps App's
// hooks ordering clean and skips the socket connection entirely.
const testParam = new URLSearchParams(window.location.search).get('test');

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(
  <React.StrictMode>
    {testParam === 'share' ? (
      <TestShareScreen />
    ) : testParam === 'image' ? (
      <TestImageScreen />
    ) : testParam === 'demo' ? (
      <TestDemoScreen />
    ) : testParam === 'demopic' ? (
      <TestDemoImageScreen />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
