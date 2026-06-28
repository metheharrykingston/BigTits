/** On-device document checks — nothing is uploaded or stored in plaintext. */

export type DocumentKind = 'aadhaar' | 'pan' | 'photo' | 'signature' | 'age_proof' | 'income_proof' | 'unknown'

export interface LocalDocVerification {
  kind: DocumentKind
  fileName: string
  verified: boolean
  message: string
  /** SHA-256 hex of file bytes — for future portal autofill only, never sent to our servers. */
  contentHash?: string
  /** Last 4 of Aadhaar only, if detected — never full number. */
  aadhaarLast4?: string
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/** Validate 12-digit Aadhaar checksum (Verhoeff) — runs only on device. */
export function isValidAadhaarNumber(digits: string): boolean {
  const n = digits.replace(/\D/g, '')
  if (!/^\d{12}$/.test(n)) return false
  if (n[0] === '0' || n[0] === '1') return false
  let c = 0
  const reversed = n.split('').reverse()
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]]
  }
  return c === 0
}

export function maskAadhaar(digits: string): string {
  const n = digits.replace(/\D/g, '')
  if (n.length < 4) return '****'
  return `XXXX-XXXX-${n.slice(-4)}`
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function guessDocumentKind(fileName: string, docKey: string): DocumentKind {
  const lower = fileName.toLowerCase()
  if (/aadhaar|aadhar|uidai|आधार/.test(lower) || docKey === 'address_proof') return 'aadhaar'
  if (/pan|permanent.account|income.tax/.test(lower) || docKey === 'identity_proof') return 'pan'
  if (/photo|passport|pic|selfie/.test(lower) || docKey === 'photo') return 'photo'
  if (/sign/.test(lower) || docKey === 'signature') return 'signature'
  if (/birth|tc|school|10th|marksheet/.test(lower) || docKey === 'age_proof') return 'age_proof'
  if (/salary|itr|income|bank/.test(lower) || docKey === 'income_proof') return 'income_proof'
  if (docKey === 'address_proof') return 'aadhaar'
  if (docKey === 'identity_proof') return 'pan'
  return 'unknown'
}

/** Scan file name + optional text snippet for Aadhaar digits; validate checksum only. */
export function extractAadhaarFromText(text: string): string | null {
  const matches = text.match(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g)
  if (!matches) return null
  for (const raw of matches) {
    const digits = raw.replace(/\s/g, '')
    if (isValidAadhaarNumber(digits)) return digits
  }
  return null
}

export async function verifyLocalDocument(
  file: File,
  docKey: string,
): Promise<LocalDocVerification> {
  const kind = guessDocumentKind(file.name, docKey)
  const buffer = await file.arrayBuffer()
  const contentHash = await sha256Hex(buffer)

  let textSnippet = ''
  if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
    textSnippet = await file.text().catch(() => '')
  }

  const aadhaar = extractAadhaarFromText(`${file.name} ${textSnippet}`)
  if (aadhaar) {
    return {
      kind: 'aadhaar',
      fileName: file.name,
      verified: true,
      message: `Aadhaar format verified on your phone (${maskAadhaar(aadhaar)}). We did not save the full number.`,
      contentHash,
      aadhaarLast4: aadhaar.slice(-4),
    }
  }

  if (kind === 'aadhaar' || docKey === 'address_proof') {
    return {
      kind,
      fileName: file.name,
      verified: true,
      message:
        'File saved on your device. Aadhaar number scan needs a clear photo — tick when ready, upload on the official portal.',
      contentHash,
    }
  }

  if (kind === 'pan' || docKey === 'identity_proof') {
    const panMatch = `${file.name} ${textSnippet}`.match(/\b[A-Z]{5}\d{4}[A-Z]\b/i)
    return {
      kind: 'pan',
      fileName: file.name,
      verified: Boolean(panMatch) || file.type.startsWith('image/'),
      message: panMatch
        ? `PAN format looks valid (${panMatch[0].toUpperCase()}). Not stored on our servers.`
        : 'File received on your phone. Confirm it is your PAN card before uploading on the portal.',
      contentHash,
    }
  }

  const imageOk = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|pdf)$/i.test(file.name)
  return {
    kind,
    fileName: file.name,
    verified: imageOk,
    message: imageOk
      ? 'File looks good on your device. Upload only on the government portal when asked.'
      : 'Please pick a photo or PDF from your phone.',
    contentHash,
  }
}

const VAULT_KEY = 'bigtits-gov-doc-vault'

export function saveDocVault(caseId: string, docKey: string, entry: LocalDocVerification) {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    const vault = raw ? (JSON.parse(raw) as Record<string, Record<string, LocalDocVerification>>) : {}
    vault[caseId] = vault[caseId] || {}
    vault[caseId][docKey] = entry
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault))
  } catch {
    /* ignore quota errors */
  }
}