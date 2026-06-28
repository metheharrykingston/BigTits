import { useMemo, useState } from 'react'
import {
  COUNTRIES,
  TERMS_TEXT,
  getCountry,
  getLanguage,
  languagesForCountry,
  type UserPreferences,
} from '../lib/userPreferences'

interface SettingsPanelProps {
  open: boolean
  preferences: UserPreferences
  userName: string
  userEmail: string
  onClose: () => void
  onSave: (prefs: UserPreferences) => void
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-neutral-200">{label}</p>
        {description && (
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-violet-500' : 'bg-neutral-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}

export function SettingsPanel({
  open,
  preferences,
  userName,
  userEmail,
  onClose,
  onSave,
}: SettingsPanelProps) {
  const [countryCode, setCountryCode] = useState(preferences.countryCode)
  const [languageCode, setLanguageCode] = useState(preferences.languageCode)
  const [learnFromChatHistory, setLearnFromChatHistory] = useState(preferences.learnFromChatHistory)
  const [showTerms, setShowTerms] = useState(false)

  const languages = useMemo(() => languagesForCountry(countryCode), [countryCode])

  if (!open) return null

  const handleCountryChange = (code: string) => {
    setCountryCode(code)
    const available = languagesForCountry(code)
    if (!available.some((l) => l.code === languageCode)) {
      setLanguageCode(getCountry(code).defaultLanguage)
    }
  }

  const handleSave = () => {
    onSave({
      ...preferences,
      countryCode,
      languageCode,
      learnFromChatHistory,
    })
    onClose()
  }

  const country = getCountry(countryCode)
  const language = getLanguage(languageCode)

  return (
    <>
      <button
        type="button"
        aria-label="Close settings"
        className="fixed inset-0 z-40 bg-black/70"
        onClick={onClose}
      />
      <aside
        className="settings-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-medium text-white">Settings</h2>
            <p className="text-xs text-neutral-500">Language, region, and privacy</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 hover:text-white"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="scroll-area min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Account
            </p>
            <div className="rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3">
              <p className="text-sm font-medium text-neutral-200">{userName}</p>
              <p className="text-xs text-neutral-500">{userEmail}</p>
            </div>
          </section>

          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Region &amp; language
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-neutral-500">Country</span>
                <select
                  value={countryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-neutral-600"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-neutral-500">Communication language</span>
                <select
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-neutral-600"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] leading-relaxed text-neutral-600">
                Active: {country.flag} {country.name} · {language.nativeName}. Change anytime — or
                type in another language in chat and we will follow your lead.
              </p>
            </div>
          </section>

          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Personalisation
            </p>
            <Toggle
              checked={learnFromChatHistory}
              onChange={setLearnFromChatHistory}
              label="Learn from your chat history"
              description="When on, past messages in this app help tailor future replies. Stays on this device."
            />
          </section>

          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Legal
            </p>
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="w-full rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3 text-left text-sm text-neutral-300 hover:border-neutral-600"
            >
              Terms &amp; Conditions
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
              Government paperwork guidance is informational only — always verify on official portals.
            </p>
          </section>
        </div>

        <footer className="shrink-0 border-t border-neutral-800 px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Save changes
          </button>
        </footer>
      </aside>

      {showTerms && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4">
          <div className="max-h-[80svh] w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
            <div className="border-b border-neutral-800 px-5 py-4">
              <h3 className="text-lg font-medium text-white">Terms &amp; Conditions</h3>
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
                className="w-full rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}