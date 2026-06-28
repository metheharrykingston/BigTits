export interface CountryOption {
  code: string
  name: string
  flag: string
  defaultLanguage: string
}

export interface LanguageOption {
  code: string
  name: string
  nativeName: string
}

export interface UserPreferences {
  countryCode: string
  languageCode: string
  learnFromChatHistory: boolean
  termsAccepted: boolean
  onboardingComplete: boolean
  /** Email that completed onboarding — re-prompt if a different user signs in. */
  profileEmail?: string
}

export interface LocaleContext {
  countryCode: string
  countryName: string
  languageCode: string
  languageName: string
  learnFromChatHistory: boolean
}

const STORAGE_KEY = 'bigtits-user-preferences'

export const COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳', defaultLanguage: 'en' },
  { code: 'US', name: 'United States', flag: '🇺🇸', defaultLanguage: 'en' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultLanguage: 'en' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', defaultLanguage: 'ar' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', defaultLanguage: 'en' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', defaultLanguage: 'en' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', defaultLanguage: 'en' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', defaultLanguage: 'de' },
  { code: 'FR', name: 'France', flag: '🇫🇷', defaultLanguage: 'fr' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', defaultLanguage: 'ja' },
]

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
]

const DEFAULT_PREFERENCES: UserPreferences = {
  countryCode: 'IN',
  languageCode: 'en',
  learnFromChatHistory: true,
  termsAccepted: false,
  onboardingComplete: false,
}

export function getCountry(code: string): CountryOption {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0]
}

export function getLanguage(code: string): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]
}

export function languagesForCountry(countryCode: string): LanguageOption[] {
  const country = getCountry(countryCode)
  const preferred = new Set<string>([country.defaultLanguage, 'en'])
  if (countryCode === 'IN') {
    ;['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa'].forEach((c) => preferred.add(c))
  }
  if (countryCode === 'AE') {
    preferred.add('ar')
  }
  if (countryCode === 'US' || countryCode === 'CA') {
    preferred.add('es')
  }
  return LANGUAGES.filter((l) => preferred.has(l.code))
}

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    return {
      countryCode: parsed.countryCode || DEFAULT_PREFERENCES.countryCode,
      languageCode: parsed.languageCode || DEFAULT_PREFERENCES.languageCode,
      learnFromChatHistory:
        typeof parsed.learnFromChatHistory === 'boolean'
          ? parsed.learnFromChatHistory
          : DEFAULT_PREFERENCES.learnFromChatHistory,
      termsAccepted: Boolean(parsed.termsAccepted),
      onboardingComplete: Boolean(parsed.onboardingComplete),
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function saveUserPreferences(prefs: UserPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function clearUserPreferences() {
  localStorage.removeItem(STORAGE_KEY)
}

export function buildLocaleContext(prefs: UserPreferences): LocaleContext {
  const country = getCountry(prefs.countryCode)
  const isHinglish = prefs.languageCode === 'hinglish'
  const language = isHinglish
    ? { code: 'hinglish', name: 'Hinglish', nativeName: 'Hinglish' }
    : getLanguage(prefs.languageCode)
  return {
    countryCode: country.code,
    countryName: country.name,
    languageCode: language.code,
    languageName: language.name,
    learnFromChatHistory: prefs.learnFromChatHistory,
  }
}

export function localeApiPayload(prefs: UserPreferences) {
  const ctx = buildLocaleContext(prefs)
  const isHinglish = prefs.languageCode === 'hinglish'
  return {
    country_code: ctx.countryCode,
    country_name: ctx.countryName,
    language_code: isHinglish ? 'hinglish' : ctx.languageCode,
    language_name: isHinglish ? 'Hinglish' : ctx.languageName,
    learn_from_chat_history: ctx.learnFromChatHistory,
  }
}

export function needsLocaleOnboarding(prefs: UserPreferences, email: string): boolean {
  if (!prefs.onboardingComplete) return true
  if (prefs.profileEmail && prefs.profileEmail !== email.trim().toLowerCase()) return true
  return false
}

/** Roman Hindi / Hinglish words in Latin script (mujhe, chahiye, banana, etc.) */
const ROMANIZED_HINDI_RE =
  /\b(mujhe|mujhko|chahiye|chaiye|chaahiye|karna|karana|banana|banwana|banao|banwani|hai|hain|ho|hoon|hun|ka|ki|ke|ko|se|mein|main|mera|meri|mere|aap|tum|kya|kaise|kab|kahan|kyun|kyunki|aur|nahi|nahin|nahee|haan|han|ji|bhai|dost|yeh|ye|woh|wo|koi|sab|thoda|bahut|bohot|accha|theek|sahi|galat|kaun|kis|kitna|kitni|konsa|kaunsa|chalo|dekho|sunno|batao|bataiye|karo|kijiye|lena|dena|leni|apna|apni|apne|uska|uski|unke|hum|humko|hamko|tumko|aapko|samjha|samjhao|bata|batao|kripya|please|chahie)\b/gi

const SCRIPT_LANGUAGE_HINTS: { test: RegExp; code: string }[] = [
  { test: /[\u0900-\u097F]/, code: 'hi' },
  { test: /[\u0980-\u09FF]/, code: 'bn' },
  { test: /[\u0B80-\u0BFF]/, code: 'ta' },
  { test: /[\u0C00-\u0C7F]/, code: 'te' },
  { test: /[\u0A80-\u0AFF]/, code: 'gu' },
  { test: /[\u0C80-\u0CFF]/, code: 'kn' },
  { test: /[\u0D00-\u0D7F]/, code: 'ml' },
  { test: /[\u0A00-\u0A7F]/, code: 'pa' },
  { test: /[\u0600-\u06FF]/, code: 'ar' },
  { test: /[\u3040-\u30FF]/, code: 'ja' },
]

const EXPLICIT_SWITCH_RE =
  /\b(speak|reply|respond|answer|write|continue)\s+(in|using)\s+([a-z\u0900-\u097F\u0B80-\u0BFF\u0980-\u09FF]+)/i

const LANGUAGE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  LANGUAGES.flatMap((l) => [
    [l.name.toLowerCase(), l.code],
    [l.nativeName.toLowerCase(), l.code],
    [l.code, l.code],
  ]),
)

function countRomanizedHindiWords(text: string): number {
  const matches = text.match(ROMANIZED_HINDI_RE)
  return matches ? matches.length : 0
}

/** Detect language from message content (script, Hinglish, or explicit). */
export function detectMessageLanguage(
  message: string,
  countryCode = 'IN',
): string | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  const explicit = trimmed.match(EXPLICIT_SWITCH_RE)
  if (explicit?.[3]) {
    const target = explicit[3].trim().toLowerCase()
    if (target === 'hinglish') return 'hinglish'
    const code = LANGUAGE_NAME_TO_CODE[target]
    if (code) return code
  }

  for (const hint of SCRIPT_LANGUAGE_HINTS) {
    if (hint.test.test(trimmed)) return hint.code
  }

  const hinglishHits = countRomanizedHindiWords(trimmed)
  if (hinglishHits >= 2) return 'hinglish'
  if (hinglishHits >= 1 && countryCode === 'IN') return 'hinglish'

  return null
}

/** Detect if the user switched language in chat (explicit request, script, or Hinglish). */
export function detectLanguageSwitch(
  message: string,
  currentLanguageCode: string,
  countryCode = 'IN',
): string | null {
  const detected = detectMessageLanguage(message, countryCode)
  if (!detected || detected === currentLanguageCode) return null
  if (currentLanguageCode === 'hinglish' && detected === 'hi') return null
  return detected
}

export const TERMS_TEXT = `BigTits AGI — Terms of Use

1. Service. BigTits AGI helps you build websites, marketing content, and navigate government paperwork guidance. It is an assistant, not a lawyer, accountant, or government authority.

2. Accuracy. Responses may be incomplete or wrong. Always verify official requirements on government portals before submitting applications.

3. Privacy. Your chat history stays on this device unless you enable learning from chat history for personalised outputs. We do not ask you to upload identity documents to our servers for government flows.

4. Personalisation. When "Learn from chat history" is on, we use your past messages in this app to tailor future replies. You can turn this off anytime in Settings.

5. Acceptable use. Do not use the app for illegal activity, harassment, or submitting false information to authorities.

6. Changes. We may update these terms; continued use after updates means acceptance.

By continuing, you agree to these terms.`