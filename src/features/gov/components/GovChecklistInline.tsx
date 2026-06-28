import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { api } from '../api/client'
import { PortalWorkspace } from '../plugins/portal-workspace'
import {
  friendlyChecklistIntro,
  govDocLabel,
  nextStepHint,
} from '../../../lib/govDocumentLabels'
import {
  saveDocVault,
  verifyLocalDocument,
  type LocalDocVerification,
} from '../../../lib/documentVerify'
import type { CaseResponse, ResearchRequirementsResponse } from '@shared'

interface GovChecklistInlineProps {
  caseId: string
  intro?: string
  research?: ResearchRequirementsResponse | null
  languageCode?: string
  stateName?: string
  onError?: (message: string) => void
}

function researchLooksHealthy(research?: ResearchRequirementsResponse | null): boolean {
  if (!research?.sources?.length) return false
  return research.sources.some((s) => s.status === 'checked' || s.status === 'found')
}

function isPluginUnavailableError(message: string): boolean {
  return /not implemented|plugin.*not found|unavailable/i.test(message)
}

/** Opens HTTPS URLs from Capacitor WebView (window.open is often blocked on Android). */
function openExternalUrl(url: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export function GovChecklistInline({
  caseId,
  intro,
  research,
  languageCode = 'hinglish',
  stateName,
  onError,
}: GovChecklistInlineProps) {
  const [caseData, setCaseData] = useState<CaseResponse | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [verified, setVerified] = useState<Record<string, LocalDocVerification>>({})
  const [opening, setOpening] = useState(false)
  const [localError, setLocalError] = useState('')
  const [statusLine, setStatusLine] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocKeyRef = useRef<string | null>(null)

  useEffect(() => {
    api.getCase(caseId).then(setCaseData).catch((e) => onError?.(String(e)))
  }, [caseId, onError])

  async function openOfficialPortal() {
    setOpening(true)
    setLocalError('')
    setStatusLine('')
    try {
      const bundle = await api.createBrowseBundle(caseId)
      try {
        await PortalWorkspace.open({ bundle })
        setStatusLine(
          languageCode === 'hi'
            ? 'पोर्टल खुल गया — OTP और अपलोड वहीं करें।'
            : languageCode === 'hinglish'
              ? 'Portal khul gaya — OTP aur upload wahi karo.'
              : 'Portal opened — complete OTP and upload there.',
        )
      } catch (pluginErr) {
        const msg = pluginErr instanceof Error ? pluginErr.message : String(pluginErr)
        const fallbackUrl = bundle.start_url || caseData?.requirements.official_url
        if (isPluginUnavailableError(msg) && fallbackUrl) {
          openExternalUrl(fallbackUrl)
          setStatusLine(
            languageCode === 'hi'
              ? 'आधिकारिक साइट खुल गई। वहीं लॉगिन करें और दस्तावेज़ अपलोड करें।'
              : languageCode === 'hinglish'
                ? 'Official site khul gayi. Wahi login karo aur documents upload karo.'
                : 'Official site opened. Log in there and upload your documents.',
          )
          return
        }
        throw pluginErr
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open portal'
      const officialUrl = caseData?.requirements.official_url
      setLocalError(
        languageCode === 'hi'
          ? `पोर्टल नहीं खुल पाया।${officialUrl ? ' नीचे लिंक से सीधे सारथी खोलें।' : ' बाद में फिर कोशिश करें।'}`
          : languageCode === 'hinglish'
            ? `Portal nahi khul paya.${officialUrl ? ' Neeche link se seedha Sarathi kholo.' : ' Baad mein try karo.'}`
            : officialUrl
              ? 'Could not open in-app portal. Use the official link below.'
              : msg,
      )
      if (!isPluginUnavailableError(msg)) {
        onError?.(msg)
      }
    } finally {
      setOpening(false)
    }
  }

  function triggerFilePick(docKey: string) {
    pendingDocKeyRef.current = docKey
    fileInputRef.current?.click()
  }

  async function handleFileSelected(file: File | undefined) {
    const docKey = pendingDocKeyRef.current
    pendingDocKeyRef.current = null
    if (!file || !docKey) return
    setStatusLine(
      languageCode === 'hi'
        ? 'आपके फ़ोन पर जाँच हो रही है…'
        : 'Checking on your phone…',
    )
    const result = await verifyLocalDocument(file, docKey)
    setVerified((prev) => ({ ...prev, [docKey]: result }))
    saveDocVault(caseId, docKey, result)
    if (result.verified) {
      setChecked((prev) => ({ ...prev, [docKey]: true }))
    }
    setStatusLine(result.message)
  }

  if (!caseData) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-3 text-sm text-neutral-500">
        {languageCode === 'hi' ? 'दस्तावेज़ सूची लोड हो रही है…' : 'Loading document list…'}
      </div>
    )
  }

  const docs = caseData.requirements.required_documents
  const readyCount = docs.filter((k) => checked[k]).length
  const allReady = readyCount === docs.length
  const showResearch = researchLooksHealthy(research)
  const displayIntro =
    intro && !/could not reach live sources/i.test(intro)
      ? intro
      : friendlyChecklistIntro(languageCode, stateName)

  return (
    <div className="flex max-w-[92%] flex-col gap-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          void handleFileSelected(f)
          e.target.value = ''
        }}
      />

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-300">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
          Step 1 · {languageCode === 'hi' ? 'क्या चाहिए' : 'What you need'}
        </p>
        <p className="leading-relaxed">{displayIntro}</p>
      </div>

      <p className="rounded-xl border border-neutral-800/80 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-neutral-400">
        {nextStepHint(languageCode, readyCount, docs.length)}
      </p>

      {showResearch && research && (
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-emerald-600/80">
            {languageCode === 'hi' ? 'आधिकारिक स्रोत' : 'Official sources'}
          </p>
          <ul className="space-y-1">
            {research.sources
              .filter((s) => s.status === 'checked' || s.status === 'found')
              .map((source) => (
                <li key={source.url} className="text-[11px] text-neutral-400">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 underline decoration-neutral-600 underline-offset-2"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className="px-0.5 text-[10px] leading-relaxed text-neutral-600">
        {languageCode === 'hi'
          ? 'हम आपकी फ़ाइलें सर्वर पर नहीं रखते — सिर्फ़ आपके फ़ोन पर जाँच होती है।'
          : languageCode === 'hinglish'
            ? 'Hum aapki files server par save nahi karte — sirf phone par check hota hai.'
            : 'We never store your files on our servers — checks run only on your phone.'}
      </p>

      {docs.map((docKey) => {
        const label = govDocLabel(docKey, languageCode)
        const isChecked = Boolean(checked[docKey])
        const verification = verified[docKey]
        const canPickFile = docKey === 'address_proof' || docKey === 'identity_proof' || docKey === 'age_proof'

        return (
          <div
            key={docKey}
            className={`rounded-2xl border px-3.5 py-3 transition ${
              isChecked
                ? 'border-emerald-800/60 bg-emerald-950/25'
                : 'border-neutral-800 bg-neutral-950'
            }`}
          >
            <button
              type="button"
              onClick={() => setChecked((prev) => ({ ...prev, [docKey]: !prev[docKey] }))}
              className="flex w-full items-start gap-3 text-left text-sm"
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                  isChecked ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-neutral-600'
                }`}
              >
                {isChecked ? '✓' : ''}
              </span>
              <span className="min-w-0 flex-1 text-neutral-200">
                <span className="block font-medium">{label.question}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{label.hint}</span>
                <span className="mt-0.5 block text-[10px] text-neutral-600">{label.examples}</span>
              </span>
            </button>

            {canPickFile && (
              <button
                type="button"
                onClick={() => triggerFilePick(docKey)}
                className="mt-2.5 w-full rounded-xl border border-neutral-700 px-3 py-1.5 text-[11px] text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-200"
              >
                {languageCode === 'hi'
                  ? '📁 फ़ोन से फ़ाइल चुनें (जाँच के लिए)'
                  : languageCode === 'hinglish'
                    ? '📁 Phone se file chuno (verify ke liye)'
                    : '📁 Pick file from phone (verify only)'}
              </button>
            )}

            {verification && (
              <p
                className={`mt-2 text-[10px] leading-relaxed ${
                  verification.verified ? 'text-emerald-400/90' : 'text-amber-400/90'
                }`}
              >
                {verification.message}
              </p>
            )}
          </div>
        )
      })}

      {statusLine && (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-[11px] text-neutral-300">
          {statusLine}
        </p>
      )}

      {localError && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {localError}
        </p>
      )}

      <button
        type="button"
        disabled={opening}
        onClick={() => void openOfficialPortal()}
        className={`rounded-full border px-4 py-2.5 text-xs font-medium transition disabled:opacity-40 ${
          allReady
            ? 'border-white bg-white text-black hover:bg-neutral-200'
            : 'border-neutral-600 text-neutral-300 hover:border-neutral-400'
        }`}
      >
        {opening
          ? languageCode === 'hi'
            ? 'पोर्टल खुल रहा है…'
            : 'Opening portal…'
          : allReady
            ? languageCode === 'hi'
              ? 'अगला: आधिकारिक पोर्टल खोलें'
              : languageCode === 'hinglish'
                ? 'Agla step: official portal kholo'
                : 'Next: open official portal'
            : languageCode === 'hi'
              ? 'पोर्टल खोलें (जब तैयार हों)'
              : 'Open portal when ready'}
      </button>

      {caseData.requirements.official_url && (
        <a
          href={caseData.requirements.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-neutral-700 px-3 py-2 text-center text-[11px] text-neutral-300 underline decoration-neutral-600 underline-offset-2"
        >
          {languageCode === 'hi'
            ? 'सरकारी साइट सीधे खोलें (बैकअप लिंक)'
            : languageCode === 'hinglish'
              ? 'Government site seedha kholo (backup link)'
              : 'Open government site directly (backup link)'}
        </a>
      )}

      <p className="px-0.5 text-[10px] leading-relaxed text-neutral-600">
        {Capacitor.isNativePlatform()
          ? languageCode === 'hi'
            ? 'OTP, भुगतान और फ़ाइनल सबमिट आप खुद पोर्टल पर करेंगे।'
            : languageCode === 'hinglish'
              ? 'OTP, payment aur final submit aap khud portal par karoge.'
              : 'OTP, payment, and final submit stay with you on the portal.'
          : `Opens ${caseData.requirements.official_url} in your browser.`}
      </p>
    </div>
  )
}