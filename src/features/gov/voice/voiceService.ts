import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export type VoiceLanguage = 'hi-IN' | 'en-IN' | 'en-US';

const DEFAULT_LANG: VoiceLanguage = 'hi-IN';

/** Map app language/country prefs to speech recognition locale. */
export function voiceLangForUser(countryCode: string, languageCode: string): VoiceLanguage {
  if (languageCode === 'hi' || languageCode === 'hinglish') return 'hi-IN';
  if (countryCode === 'IN') return 'en-IN';
  if (countryCode === 'US' || countryCode === 'CA') return 'en-US';
  return 'en-US';
}

export function voicePromptForLang(lang: VoiceLanguage): string {
  if (lang === 'hi-IN') return 'बोलिए…';
  return 'Speak now…';
}

type WebSpeechResultEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};

type WebSpeechErrorEvent = {
  error: string;
};

type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: WebSpeechResultEvent) => void) | null;
  onerror: ((event: WebSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function webRecognitionCtor(): (new () => WebSpeechRecognition) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export async function voiceAvailable(): Promise<{ stt: boolean; tts: boolean }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { available } = await SpeechRecognition.available();
      return { stt: available, tts: true };
    } catch {
      return { stt: false, tts: true };
    }
  }
  return {
    stt: webRecognitionCtor() !== null,
    tts: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
}

export async function ensureMicPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return webRecognitionCtor() !== null;
  }
  const check = await SpeechRecognition.checkPermissions();
  if (check.speechRecognition === 'granted') return true;
  const req = await SpeechRecognition.requestPermissions();
  return req.speechRecognition === 'granted';
}

export async function listenOnce(lang: VoiceLanguage = DEFAULT_LANG): Promise<string> {
  const ok = await ensureMicPermission();
  if (!ok) throw new Error('Microphone permission denied');

  if (Capacitor.isNativePlatform()) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let listenerHandle: { remove: () => Promise<void> } | null = null;

      const finish = (result: string | Error) => {
        if (settled) return;
        settled = true;
        void SpeechRecognition.stop().catch(() => undefined);
        void listenerHandle?.remove();
        if (result instanceof Error) reject(result);
        else resolve(result);
      };

      void SpeechRecognition.addListener('partialResults', (data) => {
        const text = data.matches?.[0]?.trim();
        if (text) finish(text);
      }).then((handle) => {
        listenerHandle = handle;
        return SpeechRecognition.start({
          language: lang,
          maxResults: 3,
          prompt: voicePromptForLang(lang),
          partialResults: true,
          popup: true,
        });
      }).catch((err) => {
        finish(err instanceof Error ? err : new Error(String(err)));
      });

      window.setTimeout(() => {
        finish(new Error('Listening timed out — try again'));
      }, 30_000);
    });
  }

  const Ctor = webRecognitionCtor();
  if (!Ctor) throw new Error('Speech recognition not supported in this browser');

  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) resolve(text);
      else reject(new Error('No speech detected'));
    };
    rec.onerror = (event) => reject(new Error(event.error || 'Speech recognition failed'));
    rec.onend = () => {};
    rec.start();
  });
}

export async function speak(
  text: string,
  lang: VoiceLanguage = DEFAULT_LANG,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.speak({
      text: trimmed,
      lang,
      rate: 0.95,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
    });
    return;
  }

  if (!('speechSynthesis' in window)) {
    throw new Error('Text-to-speech not supported in this browser');
  }

  await new Promise<void>((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(trimmed);
    utter.lang = lang;
    utter.rate = 0.95;
    utter.onend = () => resolve();
    utter.onerror = () => reject(new Error('Text-to-speech failed'));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

export async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.stop();
    return;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function profileSummaryForSpeech(
  profile: Record<string, string | undefined | null>,
  keys: string[],
): string {
  const labels: Record<string, string> = {
    full_name: 'naam',
    father_name: 'pita ka naam',
    dob: 'janam tithi',
    mobile: 'mobile number',
    email: 'email',
    address_line1: 'pata',
    district: 'jila',
    state: 'rajya',
    pincode: 'pin code',
    purpose: 'maqsad',
    annual_income: 'saalana aamdani',
    vehicle_class: 'gaadi ki category',
  };

  const parts: string[] = [];
  for (const key of keys) {
    const value = profile[key];
    if (!value) continue;
    const label = labels[key] ?? key.replaceAll('_', ' ');
    parts.push(`${label}: ${value}`);
  }
  if (parts.length === 0) return 'Abhi koi jaankari nahi mili.';
  return parts.join('. ') + '. Kya yeh sahi hai?';
}