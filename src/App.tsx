import { useEffect, useRef, useState } from 'react'
import { CampaignPanel, type AgentResponse } from './CampaignPanel'
import { FileWriterPanel } from './FileWriterPanel'
import './index.css'

interface CreateResponse extends AgentResponse {
  kind?: 'website' | 'agent' | string
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
}

const SESSION_KEY = 'bigtits-agent-session'

const EXAMPLE_PROMPTS = [
  { label: 'Meta ad campaign', prompt: 'Make a meta ad campaign for my coffee shop targeting local customers' },
  { label: 'Electronic store', prompt: 'Build an electronic store website' },
  { label: 'Furniture shop', prompt: 'Create a furniture store website' },
  { label: 'Cafe website', prompt: 'Create a website for my cafe' },
  { label: 'Portfolio', prompt: 'Make a personal portfolio website' },
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

function isLocalPreviewUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)
}

function getPreviewSrc(url?: string): string | null {
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
  const [result, setResult] = useState<CreateResponse | null>(null)
  const [error, setError] = useState('')
  const [errorHint, setErrorHint] = useState('')
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendMessage, setBackendMessage] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [flushFiles, setFlushFiles] = useState(false)
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '')
  const [isPublishing, setIsPublishing] = useState(false)
  const pendingResultRef = useRef<CreateResponse | null>(null)
  const loadStartedAtRef = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isAgentResult = result?.kind === 'agent' || result?.route_type === 'create' || result?.route_type === 'publish'
  const previewSrc = isAgentResult ? null : getPreviewSrc(result?.previewUrl)

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
    setFlushFiles(false)
    pendingResultRef.current = null
    setError('')
    setErrorHint('')
    setResult(null)
    setSubmittedPrompt(finalPrompt.trim())
    loadStartedAtRef.current = Date.now()

    let generationSucceeded = false

    try {
      const res = await fetch(`${API_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt.trim(),
          session_id: sessionId || undefined,
        }),
      })

      const data = await res.json() as CreateResponse & { hint?: string }

      if (!res.ok || !data.success) {
        setError(data.error || data.intent?.message || 'Generation failed')
        setErrorHint(
          data.hint ||
            (res.status === 503
              ? 'Set RAILWAY_API_URL in Vercel to your Railway API URL, then redeploy.'
              : 'Check that both Railway services (API + Core) are running.'),
        )
        return
      }

      if (data.session_id) {
        setSessionId(data.session_id)
        localStorage.setItem(SESSION_KEY, data.session_id)
      }

      const isAgent = data.kind === 'agent' || data.route_type === 'create' || data.route_type === 'publish'

      generationSucceeded = true
      pendingResultRef.current = data

      if (isAgent) {
        setResult((prev) => ({
          ...prev,
          ...data,
          campaign: data.campaign || prev?.campaign,
        }))
        setIsLoading(false)
        setSubmittedPrompt(finalPrompt.trim())
        setPrompt('')
        return
      }

      setFlushFiles(true)
      setPrompt('')
    } catch {
      setError('Could not connect to the generator')
      setErrorHint(
        import.meta.env.PROD
          ? 'Set RAILWAY_API_URL in your Vercel project settings, then redeploy.'
          : 'Run npm run dev from the repo root to start Core + API + frontend together.',
      )
    } finally {
      if (!generationSucceeded) {
        setIsLoading(false)
        setFlushFiles(false)
      }
    }
  }

  const handleFileWriterFinish = () => {
    const minDuration = 2200
    const elapsed = Date.now() - loadStartedAtRef.current
    const remaining = Math.max(0, minDuration - elapsed)

    window.setTimeout(() => {
      const ready = pendingResultRef.current
      if (ready) setResult(ready)
      pendingResultRef.current = null
      setIsLoading(false)
      setFlushFiles(false)
    }, remaining)
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

  const publishCampaign = async () => {
    if (!sessionId || isPublishing) return
    setIsPublishing(true)
    setError('')
    setErrorHint('')

    try {
      const res = await fetch(`${API_URL}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'publish this campaign',
          session_id: sessionId,
        }),
      })
      const data = await res.json() as CreateResponse
      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Publish failed')
        return
      }
      setResult({ ...result, ...data, kind: 'agent', campaign: result?.campaign || data.campaign })
    } catch {
      setError('Could not connect to publish endpoint')
    } finally {
      setIsPublishing(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError('')
    setErrorHint('')
    setPrompt('')
    setSubmittedPrompt('')
    setFlushFiles(false)
    setSessionId('')
    localStorage.removeItem(SESSION_KEY)
  }

  const showComposer = !result || isAgentResult

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
                Build websites, create Meta ad campaigns with 5 creatives, or say &ldquo;publish this campaign&rdquo; to push live via connectors.
              </p>
            </div>
          )}

          {/* File writer — runs while API generates */}
          {isLoading && (
            <div className="flex min-h-0 flex-1 flex-col animate-fade-in">
              <p className="shrink-0 px-4 pt-4 text-center text-xs text-neutral-600">
                {submittedPrompt}
              </p>
              <FileWriterPanel
                prompt={submittedPrompt}
                active={isLoading}
                flush={flushFiles}
                onFinish={handleFileWriterFinish}
              />
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

          {/* Agent result — Meta campaign draft or publish */}
          {result && result.success && isAgentResult && (
            <CampaignPanel
              result={result}
              sessionId={sessionId}
              onPublish={publishCampaign}
              onReset={reset}
              isPublishing={isPublishing}
            />
          )}

          {/* Website result */}
          {result && result.success && result.projectPath && !isAgentResult && (
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

              {previewSrc && isMobile ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                  <p className="text-sm text-neutral-300">Preview is ready</p>
                  <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                    Tap below to view your generated site full screen.
                  </p>
                  <a
                    href={previewSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full max-w-xs border border-white px-4 py-3 text-sm text-white hover:bg-neutral-900"
                  >
                    View preview
                  </a>
                </div>
              ) : previewSrc ? (
                <iframe
                  src={previewSrc}
                  className="min-h-0 flex-1 w-full border-0 bg-white"
                  title="Live project preview"
                  allow="fullscreen"
                />
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
                  placeholder="Build a site, make a meta ad, or publish a campaign..."
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