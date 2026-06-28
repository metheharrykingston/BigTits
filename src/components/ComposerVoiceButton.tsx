import { useEffect, useState } from 'react'
import {
  listenOnce,
  voiceAvailable,
  voiceLangForUser,
  type VoiceLanguage,
} from '../features/gov/voice/voiceService'

interface ComposerVoiceButtonProps {
  countryCode: string
  languageCode: string
  disabled?: boolean
  onTranscript: (text: string) => void
  onError?: (message: string) => void
  onListeningChange?: (listening: boolean) => void
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? 'text-red-300' : 'text-neutral-400'}
    >
      <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" />
    </svg>
  )
}

export function ComposerVoiceButton({
  countryCode,
  languageCode,
  disabled,
  onTranscript,
  onError,
  onListeningChange,
}: ComposerVoiceButtonProps) {
  const [listening, setListening] = useState(false)
  const [sttAvailable, setSttAvailable] = useState(true)

  const voiceLang: VoiceLanguage = voiceLangForUser(countryCode, languageCode)
  const listeningLabel =
    languageCode === 'hi' || languageCode === 'hinglish' ? 'सुन रहे हैं…' : 'Listening…'

  useEffect(() => {
    void voiceAvailable().then(({ stt }) => setSttAvailable(stt))
  }, [])

  async function handleListen() {
    if (disabled || listening || !sttAvailable) return
    setListening(true)
    onListeningChange?.(true)
    try {
      const text = await listenOnce(voiceLang)
      if (text.trim()) onTranscript(text.trim())
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Voice input failed')
    } finally {
      setListening(false)
      onListeningChange?.(false)
    }
  }

  if (!sttAvailable) return null

  return (
    <button
      type="button"
      onClick={handleListen}
      disabled={disabled || listening}
      className={`voice-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
        listening
          ? 'voice-btn-active border-red-500/60 bg-red-500/10'
          : 'border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900'
      }`}
      aria-label={listening ? listeningLabel : 'Voice input'}
      title={listening ? listeningLabel : 'Tap to speak'}
    >
      <MicIcon active={listening} />
    </button>
  )
}