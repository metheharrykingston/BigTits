import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { api } from '../api/client'
import { PortalWorkspace } from '../plugins/portal-workspace'
import type { CaseResponse, ResearchRequirementsResponse } from '@shared'

const DOC_HINTS: Record<string, string> = {
  age_proof: 'Birth certificate, school leaving certificate, or passport',
  address_proof: 'Aadhaar, utility bill, or ration card (as per state rules)',
  photo: 'Passport-size photo on white background',
  signature: 'Clear scan or photo of your signature',
  identity_proof: 'Aadhaar, PAN, or voter ID',
  income_proof: 'Salary slip, ITR, or employer certificate',
}

interface GovChecklistInlineProps {
  caseId: string
  intro?: string
  research?: ResearchRequirementsResponse | null
  onError?: (message: string) => void
}

export function GovChecklistInline({ caseId, intro, research, onError }: GovChecklistInlineProps) {
  const [caseData, setCaseData] = useState<CaseResponse | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [opening, setOpening] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    api.getCase(caseId).then(setCaseData).catch((e) => onError?.(String(e)))
  }, [caseId, onError])

  async function openOfficialPortal() {
    setOpening(true)
    setLocalError('')
    try {
      const bundle = await api.createBrowseBundle(caseId)
      await PortalWorkspace.open({ bundle })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open portal'
      setLocalError(msg)
      onError?.(msg)
    } finally {
      setOpening(false)
    }
  }

  if (!caseData) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-3 text-sm text-neutral-500">
        Loading official requirements…
      </div>
    )
  }

  const docs = caseData.requirements.required_documents
  const readyCount = docs.filter((k) => checked[k]).length
  const officialUrl = caseData.requirements.official_url

  return (
    <div className="flex max-w-[92%] flex-col gap-2.5">
      {intro && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-300">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
            Assistant
          </p>
          <p className="leading-relaxed">{intro}</p>
        </div>
      )}

      {research && research.sources.length > 0 && (
        <div className="rounded-2xl border border-neutral-800/80 bg-black/40 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Web sources checked
          </p>
          <ul className="space-y-1.5">
            {research.sources.map((source) => (
              <li key={source.url} className="text-[11px] leading-snug">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-300 underline decoration-neutral-600 underline-offset-2 hover:text-white"
                >
                  {source.title}
                </a>
                <span className="ml-1 text-neutral-600">· {source.status}</span>
              </li>
            ))}
          </ul>
          {research.notes && (
            <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">{research.notes}</p>
          )}
        </div>
      )}

      <p className="px-0.5 text-[11px] leading-relaxed text-neutral-500">
        We do not collect or store your documents. Keep files on your device and upload only on the
        official government portal when prompted.
      </p>

      {docs.map((docKey) => {
        const label = docKey.replaceAll('_', ' ')
        const hint = DOC_HINTS[docKey]
        const isChecked = Boolean(checked[docKey])
        return (
          <button
            key={docKey}
            type="button"
            onClick={() => setChecked((prev) => ({ ...prev, [docKey]: !prev[docKey] }))}
            className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm transition ${
              isChecked
                ? 'border-emerald-800/60 bg-emerald-950/25 text-emerald-100'
                : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600'
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                isChecked ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-neutral-600'
              }`}
            >
              {isChecked ? '✓' : ''}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block capitalize">{label}</span>
              {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
            </span>
          </button>
        )
      })}

      {localError && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {localError}
        </p>
      )}

      <button
        type="button"
        disabled={opening}
        onClick={() => void openOfficialPortal()}
        className="rounded-full border border-white px-3 py-2 text-xs text-white transition hover:bg-neutral-900 disabled:opacity-40"
      >
        {opening
          ? 'Opening portal…'
          : readyCount === docs.length
            ? 'Open official portal — upload there'
            : 'Open official portal when ready'}
      </button>

      <p className="px-0.5 text-[10px] leading-relaxed text-neutral-600">
        {Capacitor.isNativePlatform()
          ? 'Opens Sarathi / e-District inside the app. OTP, payment, and final submit stay with you.'
          : `Opens ${officialUrl} in your browser.`}
      </p>
    </div>
  )
}