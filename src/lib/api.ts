/**
 * Browser API base URL.
 * Default: same-origin relative paths so Vite (dev) and Vercel (prod) proxies work.
 * Only set VITE_API_URL when you intentionally bypass the proxy (e.g. direct Railway).
 */
const EXPLICIT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const AUTH_TOKEN_KEY = 'bigtits-auth-token'

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

export function getAuthToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || ''
}

export function setAuthToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    return
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path)
  const token = getAuthToken()
  const headers = new Headers(init?.headers || undefined)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  try {
    return await fetch(url, {
      ...init,
      headers,
    })
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
