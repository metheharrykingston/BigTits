import { useState } from 'react'
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
  { label: 'Bakery site', prompt: 'Website for a local bakery' },
]

const PIPELINE_STEPS = [
  { id: 'connect', label: 'Connecting to API' },
  { id: 'intent', label: 'Understanding intent' },
  { id: 'generate', label: 'Generating project' },
  { id: 'install', label: 'Installing dependencies' },
  { id: 'ready', label: 'Launching preview' },
]

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75L19 15z" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function LoaderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-[spin-slow_0.8s_linear_infinite]">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
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

  const runDemo = async (finalPrompt: string) => {
    if (!finalPrompt.trim() || isLoading) return

    setIsLoading(true)
    setError('')
    setResult(null)
    setActiveStep(0)
    setStatus('Connecting to Node API...')

    try {
      setActiveStep(0)
      await new Promise(r => setTimeout(r, 220))

      setActiveStep(1)
      setStatus('Detecting your intention with the Python Core...')

      const res = await fetch(`${API_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt.trim() }),
      })

      setActiveStep(2)
      const data: CreateResponse = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || data.intent?.message || 'Generation failed. Is the Python Core running?')
        setStatus('')
        return
      }

      setActiveStep(4)
      setStatus('Project ready! Files copied + dependencies installed.')
      setResult(data)
      setPrompt('')
    } catch {
      setError('Could not connect to the generator. Please make sure the backend services are running.')
    } finally {
      setIsLoading(false)
      setStatus('')
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    runDemo(prompt)
  }

  const selectExample = (example: string) => {
    setPrompt(example)
    setTimeout(() => runDemo(example), 60)
  }

  const reset = () => {
    setResult(null)
    setError('')
    setPrompt('')
    setStatus('')
    setActiveStep(0)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507]">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[120px] animate-float" />
        <div className="absolute -right-24 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[100px] animate-float-delayed" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-600/10 blur-[100px] animate-pulse-glow" />
        <div className="absolute inset-0 grid-bg opacity-60" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
            <SparkleIcon />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">BigTits</span>
        </div>
        <div className="flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          AI Builder
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20 pt-8 md:px-8 md:pt-14">
        {/* Hero */}
        {!result && (
          <header className="mb-10 text-center animate-fade-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-violet-300">
              <SparkleIcon />
              <span>Describe it. We build it.</span>
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.25rem]">
              Build anything with{' '}
              <span className="text-gradient animate-gradient">intelligence</span>
            </h1>
            <p className="mx-auto max-w-lg text-base leading-relaxed text-zinc-400 md:text-lg">
              Tell us what you want in plain English. We generate a complete, editable project with a live preview — instantly.
            </p>
          </header>
        )}

        {/* Prompt card */}
        {!result && (
          <form onSubmit={handleSubmit} className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="prompt-glow glass-strong rounded-2xl p-1 transition-all duration-300">
              <div className="rounded-[14px] bg-[#0c0c10]/80 p-5 md:p-6">
                <label className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                  <span className="h-px w-4 bg-violet-500/50" />
                  Your vision
                </label>

                <textarea
                  className="mb-4 w-full resize-none bg-transparent text-base leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none md:text-lg"
                  placeholder="A modern website for my cafe with menu, hours, and online ordering..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isLoading}
                  rows={3}
                />

                <div className="mb-5 flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => selectExample(ex.prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-40"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="btn-glow flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-semibold text-white md:text-base"
                >
                  {isLoading ? (
                    <>
                      <LoaderIcon />
                      Building your project…
                    </>
                  ) : (
                    <>
                      Generate Project
                      <ArrowRightIcon />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Pipeline loading */}
        {isLoading && (
          <div className="mt-8 animate-fade-up">
            <div className="glass-strong rounded-2xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
                  <LoaderIcon />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{status || 'Working...'}</p>
                  <p className="text-xs text-zinc-500">This may take a moment while dependencies install</p>
                </div>
              </div>

              <div className="space-y-2">
                {PIPELINE_STEPS.map((step, i) => {
                  const done = i < activeStep
                  const active = i === activeStep
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                        active ? 'bg-violet-500/10' : done ? 'opacity-60' : 'opacity-30'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                          done
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : active
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'bg-white/5 text-zinc-600'
                        }`}
                      >
                        {done ? <CheckIcon /> : active ? <LoaderIcon /> : i + 1}
                      </div>
                      <span className={`text-sm ${active ? 'text-white' : 'text-zinc-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 animate-fade-up rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-sm font-semibold text-red-300">Something went wrong</p>
            <p className="mt-1.5 text-sm leading-relaxed text-red-400/80">
              {error}. The generator services may not be running — try launching a preview from a previous result, or refresh and try again.
            </p>
          </div>
        )}

        {/* Success + preview */}
        {result && result.success && result.projectPath && (
          <div className="animate-fade-up">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckIcon />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white md:text-2xl">Your project is ready</h2>
                <p className="text-sm text-zinc-500">Generated and saved — edit anytime</p>
              </div>
            </div>

            {result.previewUrl ? (
              <div className="glass-strong overflow-hidden rounded-2xl">
                {/* Browser chrome */}
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-500/60" />
                      <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
                      <span className="h-3 w-3 rounded-full bg-green-500/60" />
                    </div>
                    <div className="ml-3 hidden rounded-md bg-white/5 px-3 py-1 font-mono text-xs text-zinc-500 sm:block">
                      {result.previewUrl}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(result.previewUrl, '_blank')}
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <ExternalLinkIcon />
                      Open tab
                    </button>
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
                      className="rounded-lg border border-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Stop
                    </button>
                  </div>
                </div>

                <iframe
                  src={result.previewUrl}
                  className="block h-[min(620px,65svh)] w-full bg-white"
                  title="Live project preview"
                />
              </div>
            ) : (
              <div className="glass-strong rounded-2xl p-8 text-center">
                <p className="mb-4 text-sm text-amber-400/90">Preview server not running yet</p>
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
                      alert('Could not start preview. The backend services might need attention.')
                    }
                  }}
                  className="btn-glow inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
                >
                  Launch Live Preview
                  <ArrowRightIcon />
                </button>
              </div>
            )}

            <button
              onClick={reset}
              className="mt-6 w-full rounded-xl border border-white/5 bg-white/[0.02] py-3 text-sm font-medium text-zinc-400 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
            >
              Build another project
            </button>
          </div>
        )}

        {/* Footer */}
        {!result && (
          <p className="mt-16 text-center text-xs text-zinc-600">
            Instant AI-generated projects with live preview
          </p>
        )}
      </main>
    </div>
  )
}

export default App