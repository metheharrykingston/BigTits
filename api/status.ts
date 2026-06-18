export const config = {
  runtime: 'edge',
}

export default async function handler(): Promise<Response> {
  const base = process.env.RAILWAY_API_URL?.replace(/\/$/, '')
  if (!base) {
    return Response.json({
      status: 'unconfigured',
      message: 'Set RAILWAY_API_URL in Vercel',
      api: false,
      core: false,
    })
  }

  try {
    const res = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    return Response.json({
      status: res.ok ? 'ready' : 'degraded',
      api: true,
      core: res.ok,
      ...data,
    })
  } catch (err) {
    return Response.json({
      status: 'unreachable',
      message: 'Railway API is not responding',
      api: false,
      core: false,
      details: err instanceof Error ? err.message : String(err),
    })
  }
}