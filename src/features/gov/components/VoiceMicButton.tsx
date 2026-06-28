import { useState } from 'react';
import { listenOnce, type VoiceLanguage } from '../voice/voiceService';

type Props = {
  lang?: VoiceLanguage;
  label?: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

export function VoiceMicButton({
  lang = 'hi-IN',
  label = 'बोलिए',
  onTranscript,
  onError,
}: Props) {
  const [listening, setListening] = useState(false);

  async function handleListen() {
    setListening(true);
    try {
      const text = await listenOnce(lang);
      onTranscript(text);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Voice input failed');
    } finally {
      setListening(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-voice ${listening ? 'btn-voice-active' : ''}`}
      onClick={handleListen}
      disabled={listening}
      aria-label={label}
    >
      {listening ? '🎙 सुन rahe hain…' : `🎙 ${label}`}
    </button>
  );
}