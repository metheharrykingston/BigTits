/**
 * Browser API base URL.
 * Default: same-origin relative paths so Vite (dev) and Vercel (prod) proxies work.
 * Only set VITE_API_URL when you intentionally bypass the proxy (e.g. direct Railway).
 */
const EXPLICIT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (EXPLICIT) return `${EXPLICIT}${normalized}`
  return normalized
}

export function apiHint(): string {
  if (EXPLICIT) return `API: ${EXPLICIT}`
  if (import.meta.env.PROD) return 'API: Vercel proxy → Railway'
  return 'API: Vite proxy → http://127.0.0.1:3001 (run npm run dev from repo root)'
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path)
  try {
    return await fetch(url, init)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`${msg} — ${apiHint()}`)
  }
}

export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid JSON from API'
        : `API error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''} — ${apiHint()}`,
    )
  }
}