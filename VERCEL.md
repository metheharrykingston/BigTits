# Vercel + Railway deployment

Your services:

| Service | URL |
|---------|-----|
| API | `https://bigtits-api-production.up.railway.app` |
| Core | `https://bigtits-core-production.up.railway.app` |
| Frontend | Vercel |

The Vercel proxy defaults to the API URL above. You do **not** need to set
`RAILWAY_API_URL` on Vercel unless you change the API domain.

## Fix required on Railway API

The API is currently pointing at `http://localhost:8000` for Core. Update the
**API service** variables on Railway:

```text
PYTHON_CORE_URL=https://bigtits-core-production.up.railway.app
```

Or, if both services are in the same Railway project with private networking:

```text
PYTHON_CORE_URL=http://${{core.RAILWAY_PRIVATE_DOMAIN}}:8000
```

Also recommended:

```text
HOST=0.0.0.0
PUBLIC_API_URL=https://bigtits-api-production.up.railway.app
PREVIEW_MODE=static
GENERATED_DIR=/data/generated
ENABLE_LIVE_PREVIEWS=true
ENABLE_EXECUTE_PROXY=false
```

`PUBLIC_API_URL` lets the API return mobile-friendly preview links like
`https://bigtits-api-production.up.railway.app/preview/your-project/`
instead of `http://localhost:5175`.

Attach a volume at `/data` on the API service so generated projects persist.

After saving variables, redeploy the API service. Then:

```bash
curl https://bigtits-api-production.up.railway.app/ready
```

Should return `"status":"ready"` with a healthy core.

## Core service variables

Repository: `metheharrykingston/bigtits-core`

```text
PORT=8000
HOST=0.0.0.0
RELOAD=false
ENABLE_SHELL_EXECUTOR=false
XAI_API_KEY=your-xai-key
XAI_MODEL=grok-3
```

Core is healthy at `https://bigtits-core-production.up.railway.app/health`.

## Frontend on Vercel

Repository: `metheharrykingston/BigTits` (this app)

No env vars required by default — the serverless proxy uses
`bigtits-api-production.up.railway.app` automatically.

Redeploy Vercel after pushing. The header status should show **Online** once
the API `PYTHON_CORE_URL` fix is applied.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Status shows **Degraded** | API can't reach Core — fix `PYTHON_CORE_URL` on Railway API |
| Status shows **Offline** | API service down or wrong URL |
| Generation fails | Core needs `XAI_API_KEY`; API needs volume at `/data` |

## Local development

```bash
npm run dev   # from monorepo root
```

Vite proxies `/api` to `http://localhost:3001`. No Railway env vars needed.