import { RAILWAY_API_URL } from './config'

export const config = {
  runtime: 'edge',
}

export default async function handler(): Promise<Response> {
  try {
    const res = await fetch(`${RAILWAY_API_URL}/ready`, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    return Response.json({
      status: res.ok ? 'ready' : 'degraded',
      api: true,
      core: res.ok,
      apiUrl: RAILWAY_API_URL,
      ...data,
    })
  } catch (err) {
    return Response.json({
      status: 'unreachable',
      message: 'Railway API is not responding',
      api: false,
      core: false,
      apiUrl: RAILWAY_API_URL,
      details: err instanceof Error ? err.message : String(err),
    })
  }
}