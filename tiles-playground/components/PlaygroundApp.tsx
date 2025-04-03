'use client';

import App from './App';
import {SettingsContext} from '@/context/SettingsContext';
import {FlashMessageContext} from '@/context/FlashMessageContext';

export default function PlaygroundApp(): JSX.Element {
  return (
    <SettingsContext>
      <FlashMessageContext>
        <App />
      </FlashMessageContext>
    </SettingsContext>
  );
}