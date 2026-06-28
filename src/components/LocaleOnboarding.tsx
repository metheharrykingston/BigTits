import { useMemo, useState } from 'react'
import {
  COUNTRIES,
  TERMS_TEXT,
  getCountry,
  languagesForCountry,
  type UserPreferences,
} from '../lib/userPreferences'

interface LocaleOnboardingProps {
  initial: UserPreferences
  userName: string
  onComplete: (prefs: UserPreferences) => void
}

export function LocaleOnboarding({ initial, userName, onComplete }: LocaleOnboardingProps) {
  const [countryCode, setCountryCode] = useState(initial.countryCode)
  const [languageCode, setLanguageCode] = useState(
    initial.languageCode || getCountry(initial.countryCode).defaultLanguage,
  )
  const [learnFromChatHistory, setLearnFromChatHistory] = useState(initial.learnFromChatHistory)
  const [termsAccepted, setTermsAccepted] = useState(initial.termsAccepted)
  const [showTerms, setShowTerms] = useState(false)

  const languages = useMemo(() => languagesForCountry(countryCode), [countryCode])
  const country = getCountry(countryCode)

  const handleCountryChange = (code: string) => {
    setCountryCode(code)
    const nextCountry = getCountry(code)
    const available = languagesForCountry(code)
    if (!available.some((l) => l.code === languageCode)) {
      setLanguageCode(nextCountry.defaultLanguage)
    }
  }

  const canContinue = termsAccepted && countryCode && languageCode

  return (
    <div className="flex h-svh items-center justify-center bg-black px-4 text-white">
      <div className="login-card w-full max-w-md rounded-[28px] border border-neutral-800 bg-neutral-950 p-6 shadow-2xl animate-fade-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-black text-sm font-semibold text-white">
            AGI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Hi {userName.split(/\s+/)[0] || 'there'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            Tell us your country and language so we can reply in your language and tailor government
            guidance to your region.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-500">
              Country
            </span>
            <select
              value={countryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-neutral-600"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-500">
              Language to communicate
            </span>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-neutral-600"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">
              We will use {country.flag} {country.name} context and reply in your chosen language
              unless you switch in chat or Settings.
            </p>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3">
            <input
              type="checkbox"
              checked={learnFromChatHistory}
              onChange={(e) => setLearnFromChatHistory(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-600 bg-neutral-900"
            />
            <span className="text-sm leading-relaxed text-neutral-300">
              App learns from your chat history for personalised outputs
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-600 bg-neutral-900"
            />
            <span className="text-sm leading-relaxed text-neutral-300">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-violet-300 underline underline-offset-2 hover:text-violet-200"
              >
                Terms &amp; Conditions
              </button>
            </span>
          </label>
        </div>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() =>
            onComplete({
              countryCode,
              languageCode,
              learnFromChatHistory,
              termsAccepted: true,
              onboardingComplete: true,
            })
          }
          className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start chatting
        </button>
      </div>

      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Terms and Conditions"
        >
          <div className="max-h-[80svh] w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
            <div className="border-b border-neutral-800 px-5 py-4">
              <h2 className="text-lg font-medium text-white">Terms &amp; Conditions</h2>
            </div>
            <div className="scroll-area max-h-[60svh] overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-400">
                {TERMS_TEXT}
              </pre>
            </div>
            <div className="border-t border-neutral-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="w-full rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-200 hover:border-neutral-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}