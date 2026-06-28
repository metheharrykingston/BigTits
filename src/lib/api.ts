import { Capacitor } from '@capacitor/core'

/**
 * Browser API base URL.
 * Default: same-origin relative paths so Vite (dev) and Vercel (prod) proxies work.
 * Capacitor release builds have no proxy — they call the hosted API directly.
 */
const RAILWAY_API_DEFAULT = 'https://bigtits-api-production.up.railway.app'
const AUTH_TOKEN_KEY = 'bigtits-auth-token'

/** Host machine address for native dev builds (emulator cannot use 127.0.0.1 for the API). */
export function capacitorDevHost(): string | null {
  if (!Capacitor.isNativePlatform() || !import.meta.env.DEV) return null
  if (Capacitor.getPlatform() === 'android') return '10.0.2.2'
  if (Capacitor.getPlatform() === 'ios') return '127.0.0.1'
  return null
}

function resolveApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const devHost = capacitorDevHost()
  if (devHost) return `http://${devHost}:3001`
  if (Capacitor.isNativePlatform()) {
    return RAILWAY_API_DEFAULT
  }
  return ''
}

const API_BASE = resolveApiBase()

export function usesRemoteApi(): boolean {
  return API_BASE.length > 0
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (API_BASE) return `${API_BASE}${normalized}`
  return normalized
}

export function apiStatusPath(): string {
  // Vercel serves /api/status; Railway and local API use /ready.
  if (API_BASE || import.meta.env.DEV) return '/ready'
  if (import.meta.env.PROD) return '/api/status'
  return '/ready'
}

export function govApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_GOV_API_BASE_URL || '').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const devHost = capacitorDevHost()
  if (devHost) return `http://${devHost}:8001/api/v1`
  return '/gov-api'
}

export function apiHint(): string {
  if (capacitorDevHost()) {
    return `API: ${API_BASE} (emulator → host; run: npm run on)`
  }
  if (API_BASE) return `API: ${API_BASE}`
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

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase()
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')
}

export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    if (res.ok && looksLikeHtml(text)) {
      throw new Error(
        `API returned the app page instead of JSON — start the backend or set VITE_API_URL. ${apiHint()}`,
      )
    }
    throw new Error(
      res.ok
        ? `Invalid JSON from API${text ? `: ${text.slice(0, 120)}` : ''} — ${apiHint()}`
        : `API error ${res.status}${text ? `: ${text.slice(0, 200)}` : ''} — ${apiHint()}`,
    )
  }
}
