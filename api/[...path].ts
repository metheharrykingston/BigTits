import { RAILWAY_API_URL } from './config'

export const config = {
  runtime: 'edge',
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
])

export default async function handler(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  const target = `${RAILWAY_API_URL}${incoming.pathname}${incoming.search}`

  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text()
  }

  try {
    const upstream = await fetch(target, init)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    })
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: 'Could not reach Railway API',
        hint: 'Verify the API service is deployed at bigtits-api-production.up.railway.app',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    )
  }
}