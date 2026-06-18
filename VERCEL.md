# Vercel + Railway deployment

The frontend on Vercel talks to the API on Railway through a serverless proxy.
You do **not** need `VITE_API_URL` unless you want the browser to call Railway
directly.

## 1. Deploy Core on Railway

Repository: `metheharrykingston/bigtits-core`

```text
PORT=8000
HOST=0.0.0.0
RELOAD=false
ENABLE_SHELL_EXECUTOR=false
XAI_API_KEY=your-xai-key
XAI_MODEL=grok-3
```

- No public domain required
- Service name should be `core` (used by API private networking)

## 2. Deploy API on Railway

Repository: `metheharrykingston/bigtits-api`

```text
HOST=0.0.0.0
PYTHON_CORE_URL=http://${{core.RAILWAY_PRIVATE_DOMAIN}}:8000
GENERATED_DIR=/data/generated
CORS_ORIGINS=https://your-app.vercel.app
ENABLE_EXECUTE_PROXY=false
ENABLE_LIVE_PREVIEWS=false
```

- Generate a **public Railway domain** for this service
- Attach a volume mounted at `/data`
- Copy the public URL (e.g. `https://bigtits-api-production.up.railway.app`)

## 3. Deploy frontend on Vercel

Repository: this app (`metheharrykingston/BigTits`)

### Vercel environment variable

| Name | Value | Environments |
|------|-------|--------------|
| `RAILWAY_API_URL` | Your Railway API public URL (no trailing slash) | Production, Preview |

Example:

```text
RAILWAY_API_URL=https://bigtits-api-production.up.railway.app
```

Leave `VITE_API_URL` unset. The Vercel proxy at `/api/*` forwards requests to
Railway server-side, so CORS is not an issue.

### Redeploy

After setting `RAILWAY_API_URL`, redeploy the Vercel project. The status pill in
the app header should turn green when both API and Core are healthy.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Backend not configured" | Set `RAILWAY_API_URL` on Vercel and redeploy |
| "Could not reach Railway API" | Check Railway API service logs; confirm the public URL |
| "Core unreachable" (degraded status) | Check Core service on Railway; verify `PYTHON_CORE_URL` uses `${{core.RAILWAY_PRIVATE_DOMAIN}}` |
| Generation works locally but not in prod | Railway API volume + Core `XAI_API_KEY` must be set |

## Local development

```bash
# From monorepo root
npm run dev
```

Vite proxies `/api` to `http://localhost:3001`. No Vercel or Railway env vars needed.