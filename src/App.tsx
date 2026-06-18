import { useEffect, useRef, useState } from 'react'
import './index.css'

interface CreateResponse {
  success: boolean
  stage?: string
  prompt?: string
  intent?: {
    message?: string
    [key: string]: unknown
  }
  generate?: Record<string, unknown>
  projectPath?: string
  relativePath?: string
  previewUrl?: string
  previewPort?: number
  nextSteps?: string[]
  error?: string
}

const EXAMPLE_PROMPTS = [
  { label: 'Cafe website', prompt: 'Create a website for my cafe' },
  { label: 'SaaS landing', prompt: 'Build a modern landing page for a SaaS product' },
  { label: 'Portfolio', prompt: 'Make a personal portfolio website' },
  { label: 'Dashboard', prompt: 'A simple React dashboard' },
]

const PIPELINE_STEPS = [
  'Connecting',
  'Understanding intent',
  'Generating project',
  'Installing dependencies',
  'Finalizing',
]

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

type BackendStatus = 'checking' | 'ready' | 'degraded' | 'unreachable' | 'unconfigured'

interface StatusResponse {
  status: BackendStatus
  message?: string
  hint?: string
  api?: boolean
  core?: boolean
}

const STATUS_LABELS: Record<BackendStatus, string> = {
  checking: 'Checking',
  ready: 'Online',
  degraded: 'Degraded',
  unreachable: 'Offline',
  unconfigured: 'Setup',
}

const RAILWAY_API_HOST = 'bigtits-api-production.up.railway.app'

function isLocalPreviewUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)
}

function getPreviewSrc(url?: string): string | null {
  if (!url || isLocalPreviewUrl(url)) return null

  try {
    const parsed = new URL(url)
    if (parsed.hostname === RAILWAY_API_HOST && parsed.pathname.startsWith('/preview/')) {
      return `/api/preview${parsed.pathname.slice('/preview'.length)}${parsed.search}`
    }
    return url
  } catch {
    return isLocalPreviewUrl(url) ? null : url
  }
}

function getExternalPreviewUrl(url?: string): string | null {
  if (!url || isLocalPreviewUrl(url)) return null
  return url
}

async function checkBackendStatus(): Promise<StatusResponse> {
  try {
    const url = import.meta.env.PROD ? '/api/status' : (API_URL ? `${API_URL}/ready` : '/ready')
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()

    if (import.meta.env.PROD) {
      return data as StatusResponse
    }

    return {
      status: res.ok ? 'ready' : 'degraded',
      api: true,
      core: res.ok,
      message: res.ok ? undefined : 'Python Core is not responding',
    }
  } catch {
    return {
      status: 'unreachable',
      message: import.meta.env.PROD
        ? 'Cannot reach backend — set RAILWAY_API_URL on Vercel'
        : 'Start the backend with npm run dev from the repo root',
    }
  }
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  )
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const [result, setResult] = useState<CreateResponse | null>(null)
  const [error, setError] = useState('')
  const [errorHint, setErrorHint] = useState('')
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendMessage, setBackendMessage] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const previewSrc = getPreviewSrc(result?.previewUrl)
  const externalPreviewUrl = getExternalPreviewUrl(result?.previewUrl)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const result = await checkBackendStatus()
      if (cancelled) return
      setBackendStatus(result.status)
      setBackendMessage(result.message || result.hint || '')
    }

    poll()
    const interval = setInterval(poll, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [prompt])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const runDemo = async (finalPrompt: string) => {
    if (!finalPrompt.trim() || isLoading) return

    setIsLoading(true)
    setError('')
    setErrorHint('')
    setResult(null)
    setActiveStep(0)
    setSubmittedPrompt(finalPrompt.trim())
    setStatus('Connecting to API')

    try {
      await new Promise(r => setTimeout(r, 220))
      setActiveStep(1)
      setStatus('Understanding intent')

      const res = await fetch(`${API_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt.trim() }),
      })

      setActiveStep(2)
      setStatus('Generating project')
      const data = await res.json() as CreateResponse & { hint?: string }

      if (!res.ok || !data.success) {
        setError(data.error || data.intent?.message || 'Generation failed')
        setErrorHint(
          data.hint ||
            (res.status === 503
              ? 'Set RAILWAY_API_URL in Vercel to your Railway API URL, then redeploy.'
              : 'Check that both Railway services (API + Core) are running.'),
        )
        setStatus('')
        return
      }

      setActiveStep(4)
      setStatus('Done')
      setResult(data)
      setPrompt('')
    } catch {
      setError('Could not connect to the generator')
      setErrorHint(
        import.meta.env.PROD
          ? 'Set RAILWAY_API_URL in your Vercel project settings, then redeploy.'
          : 'Run npm run dev from the repo root to start Core + API + frontend together.',
      )
    } finally {
      setIsLoading(false)
      setStatus('')
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    runDemo(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const selectExample = (example: string) => {
    setPrompt(example)
    setTimeout(() => runDemo(example), 60)
  }

  const reset = () => {
    setResult(null)
    setError('')
    setErrorHint('')
    setPrompt('')
    setStatus('')
    setSubmittedPrompt('')
    setActiveStep(0)
  }

  const showComposer = !result

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-black text-white">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center border border-neutral-700">
            <span className="text-[10px] font-bold tracking-tighter">BT</span>
          </div>
          <span className="text-sm font-medium tracking-tight text-neutral-200">BigTits</span>
        </div>

        <div
          className="flex items-center gap-2 text-[11px] text-neutral-500"
          title={backendMessage || STATUS_LABELS[backendStatus]}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full bg-white ${
              backendStatus === 'ready' ? 'opacity-100' : 'opacity-30 animate-pulse-dot'
            }`}
          />
          {STATUS_LABELS[backendStatus]}
        </div>
      </header>

      {/* Setup banner */}
      {backendStatus === 'unconfigured' && !result && (
        <div className="shrink-0 border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-center text-xs text-neutral-400">
          Set <code className="font-mono text-neutral-300">RAILWAY_API_URL</code> in Vercel, then redeploy.
        </div>
      )}

      {/* Main stage */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="scroll-area flex min-h-0 flex-1 flex-col">
          {/* Idle */}
          {!result && !isLoading && !error && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 animate-fade-in">
              <h1 className="mb-2 text-center text-2xl font-medium tracking-tight text-white md:text-[28px]">
                What should we build?
              </h1>
              <p className="max-w-md text-center text-sm leading-relaxed text-neutral-500">
                Describe a project in plain language. We generate the full codebase and preview it live.
              </p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-1 flex-col px-6 py-8 animate-fade-in">
              <div className="mx-auto w-full max-w-xl">
                <p className="mb-6 text-sm text-neutral-500">{submittedPrompt}</p>

                <div className="mb-6 flex items-center gap-3">
                  <div className="h-4 w-4 animate-spin-slow rounded-full border border-neutral-700 border-t-white" />
                  <p className="text-sm text-neutral-300">{status || 'Working'}</p>
                </div>

                <div className="space-y-2 border-l border-neutral-800 pl-4">
                  {PIPELINE_STEPS.map((step, i) => {
                    const done = i < activeStep
                    const active = i === activeStep
                    return (
                      <p
                        key={step}
                        className={`text-sm ${
                          active ? 'text-white' : done ? 'text-neutral-500' : 'text-neutral-700'
                        }`}
                      >
                        {step}
                      </p>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 animate-fade-in">
              <div className="w-full max-w-xl border border-neutral-800 p-5">
                <p className="text-sm text-white">{error}</p>
                {errorHint && (
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{errorHint}</p>
                )}
                <button
                  onClick={() => { setError(''); setErrorHint('') }}
                  className="mt-4 text-xs text-neutral-400 underline underline-offset-2 hover:text-white"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && result.success && result.projectPath && (
            <div className="flex min-h-0 flex-1 flex-col animate-fade-in">
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-2.5">
                <div>
                  <p className="text-sm text-white">Project ready</p>
                  <p className="text-xs text-neutral-500">Generated and saved to disk</p>
                </div>
                <div className="flex items-center gap-2">
                  {previewSrc && (
                    <>
                      <button
                        onClick={() => {
                          const href = previewSrc.startsWith('/')
                            ? `${window.location.origin}${previewSrc}`
                            : previewSrc
                          window.open(href, '_blank')
                        }}
                        className="flex items-center gap-1.5 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
                      >
                        <ExternalLinkIcon />
                        Open
                      </button>
                      {!import.meta.env.PROD && (
                        <button
                          onClick={async () => {
                            if (!result.projectPath) return
                            await fetch(`${API_URL}/api/preview/stop`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ projectPath: result.projectPath }),
                            })
                            setResult({ ...result, previewUrl: undefined })
                          }}
                          className="border border-neutral-800 px-2.5 py-1 text-xs text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
                        >
                          Stop
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={reset}
                    className="border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
                  >
                    New
                  </button>
                </div>
              </div>

              {previewSrc && !isMobile ? (
                <iframe
                  src={previewSrc}
                  className="min-h-0 flex-1 w-full border-0 bg-white"
                  title="Live project preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              ) : previewSrc && isMobile ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                  <p className="text-sm text-neutral-300">Preview is ready</p>
                  <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                    Tap below to view your generated site full screen.
                  </p>
                  <button
                    onClick={() => {
                      window.location.href = previewSrc.startsWith('/')
                        ? previewSrc
                        : previewSrc
                    }}
                    className="w-full max-w-xs border border-white px-4 py-3 text-sm text-white hover:bg-neutral-900"
                  >
                    View preview
                  </button>
                  {externalPreviewUrl && (
                    <button
                      onClick={() => window.open(externalPreviewUrl, '_blank')}
                      className="text-xs text-neutral-500 underline underline-offset-2"
                    >
                      Open in browser
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  {result.previewUrl && isLocalPreviewUrl(result.previewUrl) ? (
                    <>
                      <p className="text-sm text-neutral-300">Project generated successfully</p>
                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
                        Local preview URLs only work on this machine. Deploy to production or open the app on desktop with{' '}
                        <code className="font-mono text-xs text-neutral-400">npm run dev</code>.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-4 text-sm text-neutral-400">Preview not running</p>
                      <button
                        onClick={async () => {
                          if (!result.projectPath) return
                          const res = await fetch(`${API_URL}/api/preview/start`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectPath: result.projectPath }),
                          })
                          const data = await res.json()
                          if (data.success && data.previewUrl) {
                            setResult({ ...result, previewUrl: data.previewUrl, previewPort: data.port })
                          } else {
                            alert(data.error || 'Could not start preview.')
                          }
                        }}
                        className="border border-neutral-600 px-4 py-2 text-sm text-white hover:bg-neutral-900"
                      >
                        Launch preview
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer — pinned bottom */}
        {showComposer && (
          <div className="shrink-0 border-t border-neutral-800 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
              <div className="input-shell flex items-end gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-2 transition-colors">
                <textarea
                  ref={textareaRef}
                  className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:outline-none"
                  placeholder="Describe what you want to build..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="send-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-black"
                  aria-label="Generate"
                >
                  <ArrowUpIcon />
                </button>
              </div>

              {!isLoading && !error && (
                <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => selectExample(ex.prompt)}
                      className="rounded-full border border-neutral-800 px-2.5 py-1 text-[11px] text-neutral-500 transition hover:border-neutral-600 hover:text-neutral-300"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default App