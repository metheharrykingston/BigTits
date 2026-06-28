import { useState } from 'react';
import { speak, type VoiceLanguage } from '../voice/voiceService';

type Props = {
  text: string;
  lang?: VoiceLanguage;
  label?: string;
};

export function SpeakButton({ text, lang = 'hi-IN', label = 'सुनिए' }: Props) {
  const [speaking, setSpeaking] = useState(false);

  async function handleSpeak() {
    setSpeaking(true);
    try {
      await speak(text, lang);
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-speak"
      onClick={handleSpeak}
      disabled={speaking || !text.trim()}
    >
      {speaking ? '🔊…' : `🔊 ${label}`}
    </button>
  );
}