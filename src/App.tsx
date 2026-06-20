import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentOptions, type FollowUpOption } from './AgentOptions'
import { CampaignPanel, type AgentResponse } from './CampaignPanel'
import { ChatSidebar } from './ChatSidebar'
import { ChatThread } from './ChatThread'
import { apiFetch, apiHint, apiUrl, readApiJson } from './lib/api'
import {
  createSession,
  deleteSession,
  fetchSession,
  fetchSessions,
  type ChatMessage,
  type SessionActivity,
  type SessionSnapshot,
  type SessionSummary,
} from './lib/sessions'
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
  variables?: Record<string, string>
}

interface PendingUserMessage {
  content: string
  at: string
}

function restoredResultFromSnapshot(snapshot: SessionSnapshot): CreateResponse | null {
  const restore = snapshot.restore as CreateResponse | null | undefined
  if (!restore) return null
  return {
    ...restore,
    success: restore.success ?? true,
    session_id: snapshot.session_id,
    kind: restore.kind || snapshot.kind,
  }
}

const SESSION_KEY = 'bigtits-agent-session'

const EXAMPLE_PROMPTS = [
  { label: 'Meta ad campaign', prompt: 'Make a meta ad campaign for my coffee shop targeting local customers' },
  { label: 'Facebook post', prompt: 'Write a facebook post announcing our summer menu for my cafe' },
  { label: 'Electronic store', prompt: 'Build an electronic store website' },
  { label: 'Furniture shop', prompt: 'Create a furniture store website' },
  { label: 'Cafe website', prompt: 'Create a website for my cafe' },
  { label: 'Portfolio', prompt: 'Make a personal portfolio website' },
]

const QUICK_ACTIONS = [
  {
    label: 'Build websites',
    description: 'Create a mobile-ready site.',
    prompt: 'Build a mobile-ready website for my business',
    icon: '◎',
    accent: 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40',
  },
  {
    label: 'Make ads',
    description: 'Generate campaigns.',
    prompt: 'Make a meta ad campaign for my business',
    icon: '↗',
    accent: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40',
  },
  {
    label: 'Write posts',
    description: 'Draft social content.',
    prompt: 'Write a social media post for my business',
    icon: '✎',
    accent: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40',
  },
  {
    label: 'Refine results',
    description: 'Improve existing work.',
    prompt: 'Help me refine the latest result',
    icon: '✦',
    accent: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40',
  },
]

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
    const path = import.meta.env.PROD ? '/api/status' : '/ready'
    const res = await fetch(apiUrl(path), { signal: AbortSignal.timeout(10000) })
    const data = await readApiJson<StatusResponse & Record<string, unknown>>(res)

    if (import.meta.env.PROD) {
      return {
        status: (data.status as BackendStatus) || (res.ok ? 'ready' : 'degraded'),
        message: data.message as string | undefined,
        hint: data.hint as string | undefined,
        api: data.api as boolean | undefined,
        core: data.core as boolean | undefined,
      }
    }

    return {
      status: res.ok ? 'ready' : 'degraded',
      api: true,
      core: res.ok,
      message: res.ok ? undefined : 'Python Core is not responding — is port 8000 up?',
      hint: apiHint(),
    }
  } catch (err) {
    return {
      status: 'unreachable',
      message: err instanceof Error ? err.message : 'Cannot reach API',
      hint: apiHint(),
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
  const [backendHint, setBackendHint] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '')
  const [sessionTitle, setSessionTitle] = useState('New chat')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activities, setActivities] = useState<SessionActivity[]>([])
  const [liveActivities, setLiveActivities] = useState<SessionActivity[]>([])
  const [pendingUserMessage, setPendingUserMessage] = useState<PendingUserMessage | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollTimerRef = useRef<number | null>(null)
  const activeRequestRef = useRef(0)

  const isAgentResult =
    result?.kind === 'agent' ||
    result?.route_type === 'create' ||
    result?.route_type === 'publish' ||
    Boolean(result?.post)
  const previewSrc = isAgentResult ? null : getPreviewSrc(result?.previewUrl)
  const hasConversation = Boolean(
    result?.assistant_message || (result?.options && result.options.length > 0),
  )

  const refreshSessions = useCallback(async () => {
    try {
      const list = await fetchSessions()
      setSessions(list)
    } catch {
      // keep existing list on transient errors
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const applySnapshot = useCallback((snapshot: SessionSnapshot) => {
    setSessionId(snapshot.session_id)
    localStorage.setItem(SESSION_KEY, snapshot.session_id)
    setSessionTitle(snapshot.title)
    setMessages(snapshot.messages || [])
    setActivities(snapshot.activities || [])
    setLiveActivities([])
    setPendingUserMessage(null)
    setResult(restoredResultFromSnapshot(snapshot))
    setError('')
    setErrorHint('')
  }, [])

  const mergeLiveSnapshot = useCallback((snapshot: SessionSnapshot) => {
    setSessionTitle(snapshot.title)
    setMessages(snapshot.messages || [])
    setActivities(snapshot.activities || [])
    setPendingUserMessage(null)
    setResult((prev) => {
      const restored = restoredResultFromSnapshot(snapshot)
      if (restored) {
        return {
          ...prev,
          ...restored,
          session_id: snapshot.session_id,
          kind: restored.kind || prev?.kind,
        }
      }
      if (prev?.session_id === snapshot.session_id && snapshot.kind === 'empty') {
        return null
      }
      return prev
    })
  }, [])

  const loadSessionById = useCallback(async (id: string) => {
    const snapshot = await fetchSession(id)
    if (snapshot) {
      applySnapshot(snapshot)
    }
  }, [applySnapshot])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      await refreshSessions()
      const saved = localStorage.getItem(SESSION_KEY)
      if (!cancelled && saved) {
        await loadSessionById(saved)
      }
    }

    boot()
    return () => { cancelled = true }
  }, [refreshSessions, loadSessionById])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const statusResult = await checkBackendStatus()
      if (cancelled) return
      setBackendStatus(statusResult.status)
      setBackendMessage(statusResult.message || '')
      setBackendHint(statusResult.hint || (statusResult.status !== 'ready' ? apiHint() : ''))
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
    const update = () => {
      setIsMobile(mq.matches)
      if (mq.matches) setSidebarCollapsed(true)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const startNewChat = async () => {
    try {
      activeRequestRef.current += 1
      stopSessionPolling()
      const id = await createSession()
      setSessionId(id)
      localStorage.setItem(SESSION_KEY, id)
      setSessionTitle('New chat')
      setMessages([])
      setActivities([])
      setLiveActivities([])
      setPendingUserMessage(null)
      setResult(null)
      setError('')
      setErrorHint('')
      setPrompt('')
      await refreshSessions()
    } catch {
      setError('Could not create a new chat session')
    }
  }

  const handleSelectSession = async (id: string) => {
    if (id === sessionId && messages.length > 0) return
    activeRequestRef.current += 1
    stopSessionPolling()
    setIsLoading(false)
    setResult(null)
    setMessages([])
    setActivities([])
    setLiveActivities([])
    setPendingUserMessage(null)
    await loadSessionById(id)
    if (isMobile) setSidebarCollapsed(true)
  }

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id)
    await refreshSessions()
    if (id === sessionId) {
      await startNewChat()
    }
  }

  const syncSessionState = async (id: string) => {
    await refreshSessions()
    if (id) await loadSessionById(id)
  }

  const stopSessionPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const startSessionPolling = useCallback((id: string) => {
    stopSessionPolling()
    pollTimerRef.current = window.setInterval(async () => {
      const snapshot = await fetchSession(id)
      if (snapshot) {
        mergeLiveSnapshot(snapshot)
      }
    }, 900)
  }, [mergeLiveSnapshot, stopSessionPolling])

  useEffect(() => () => stopSessionPolling(), [stopSessionPolling])

  const runDemo = async (finalPrompt: string, opts?: { keepResult?: boolean }) => {
    if (!finalPrompt.trim() || isLoading) return
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId

    let ensuredSessionId = sessionId
    if (!ensuredSessionId) {
      ensuredSessionId = await createSession()
      setSessionId(ensuredSessionId)
      localStorage.setItem(SESSION_KEY, ensuredSessionId)
      setSessionTitle('New chat')
      await refreshSessions()
    }

    setIsLoading(true)
    setError('')
    setErrorHint('')
    if (!opts?.keepResult) {
      setResult(null)
    }
    setPendingUserMessage({
      content: finalPrompt.trim(),
      at: new Date().toISOString(),
    })
    setPrompt('')

    let generationSucceeded = false
    let activeSid = ensuredSessionId
    startSessionPolling(activeSid)

    try {
      const res = await apiFetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt.trim(),
          session_id: activeSid || undefined,
        }),
      })

      const data = await readApiJson<CreateResponse & { hint?: string; details?: string }>(res)
      if (requestId !== activeRequestRef.current) return

      if (!res.ok || !data.success) {
        const coreDown = /fetch failed|ECONNREFUSED|unreachable|not responding/i.test(
          String(data.error || data.details || ''),
        )
        setError(data.error || data.intent?.message || 'Generation failed')
        setErrorHint(
          data.hint ||
            (coreDown
              ? 'Python Core is not running. From repo root run: npm run dev'
              : res.status === 503
                ? 'Set RAILWAY_API_URL in Vercel to your Railway API URL, then redeploy.'
                : 'Check that API (:3001) and Core (:8000) are both running.'),
        )
        if (data.session_id) {
          activeSid = data.session_id
          await syncSessionState(data.session_id)
        }
        return
      }

      if (data.session_id) {
        activeSid = data.session_id
        setSessionId(data.session_id)
        localStorage.setItem(SESSION_KEY, data.session_id)
      }

      const isAgent = data.kind === 'agent' || data.route_type === 'create' || data.route_type === 'publish'

      generationSucceeded = true

      if (isAgent) {
        setResult((prev) => ({
          ...prev,
          ...data,
          kind: 'agent',
          campaign: data.campaign || prev?.campaign,
          post: data.post || prev?.post,
          draft_type: data.draft_type || prev?.draft_type,
        }))
        setIsLoading(false)
        setLiveActivities([])
        stopSessionPolling()
        await syncSessionState(activeSid)
        return
      }

      if (data.stage === 'refine') {
        setResult((prev) => ({
          ...prev,
          ...data,
          kind: 'website',
          projectPath: data.projectPath || prev?.projectPath,
          previewUrl: prev?.previewUrl || data.previewUrl,
        }))
        setIsLoading(false)
        setLiveActivities([])
        stopSessionPolling()
        await syncSessionState(activeSid)
        return
      }
      setResult(data)
      setIsLoading(false)
      setLiveActivities([])
      stopSessionPolling()
      await syncSessionState(activeSid)
    } catch (err) {
      if (requestId !== activeRequestRef.current) return
      setError('Could not connect to the generator')
      setErrorHint(
        err instanceof Error
          ? err.message
          : import.meta.env.PROD
            ? 'Set RAILWAY_API_URL in Vercel, redeploy, and confirm Railway API is healthy.'
            : 'Run npm run dev from the repo root (starts Core :8000, API :3001, app :5173).',
      )
    } finally {
      if (requestId === activeRequestRef.current && !generationSucceeded) {
        setIsLoading(false)
        setLiveActivities([])
        stopSessionPolling()
      }
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
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  const handleSelectOption = (option: FollowUpOption) => {
    runDemo(option.prompt, { keepResult: true })
  }

  const publishCampaign = async () => {
    if (!sessionId || isPublishing) return
    setIsPublishing(true)
    setError('')
    setErrorHint('')

    try {
      const res = await apiFetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: result?.draft_type === 'post' || result?.post ? 'publish this post' : 'publish this campaign',
          session_id: sessionId,
        }),
      })
      const data = await readApiJson<CreateResponse>(res)
      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Publish failed')
        await syncSessionState(sessionId)
        return
      }
      setResult({ ...result, ...data, kind: 'agent', campaign: result?.campaign || data.campaign })
      await syncSessionState(sessionId)
    } catch {
      setError('Could not connect to publish endpoint')
    } finally {
      setIsPublishing(false)
      setLiveActivities([])
    }
  }

  const backendUnreachable = backendStatus === 'unreachable'
  const showComposer = !backendUnreachable
  const activeSummary = sessions.find((s) => s.session_id === sessionId)
  const hasOutput = Boolean(result || error)

  return (
    <div className="app-shell flex h-svh overflow-hidden bg-black text-white">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        loading={sessionsLoading}
        collapsed={sidebarCollapsed}
        onSelect={handleSelectSession}
        onNewChat={startNewChat}
        onDelete={handleDeleteSession}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label="Close chats"
          className="mobile-sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="flex h-6 w-6 items-center justify-center border border-neutral-800 text-neutral-400 hover:text-white md:hidden"
                aria-label="Open chats"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-neutral-700">
              <span className="text-[10px] font-bold tracking-tighter">BT</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tracking-tight text-neutral-200">
                {sessionTitle || activeSummary?.title || 'New chat'}
              </p>
              {sessionId && (
                <p className="session-meta truncate font-mono text-[10px] text-neutral-600">
                  {activeSummary?.status === 'working' ? 'Working…' : activeSummary?.status || 'idle'}
                  {' · '}
                  {sessionId.slice(0, 8)}
                </p>
              )}
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-500"
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

        {(backendStatus === 'unreachable' || backendStatus === 'degraded') && (
          <div className="shrink-0 border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-center text-xs text-amber-200/90">
            <p>{backendMessage || 'Backend unavailable'}</p>
            {backendHint && (
              <p className="mt-1 text-[11px] text-amber-200/60">{backendHint}</p>
            )}
          </div>
        )}

        {backendStatus === 'unconfigured' && !result && (
          <div className="shrink-0 border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-center text-xs text-neutral-400">
            Set <code className="font-mono text-neutral-300">RAILWAY_API_URL</code> in Vercel, then redeploy.
          </div>
        )}

        <div className={`app-main-grid ${hasOutput ? 'has-output' : 'chat-only'} grid min-h-0 flex-1 overflow-hidden`}>
          {/* Chat column — conversation + composer */}
          <section className="chat-pane flex min-h-0 flex-col overflow-hidden border-b border-neutral-800 md:border-b-0 md:border-r">
            <ChatThread
              messages={messages}
              activities={activities}
              liveActivities={liveActivities}
              isWorking={isLoading || isPublishing}
              assistantMessage={result?.assistant_message}
              pendingUserMessage={pendingUserMessage}
              quickActions={QUICK_ACTIONS}
              onQuickAction={selectExample}
            />

            {hasConversation && (
              <div className="mobile-chat-followup shrink-0 border-t border-neutral-800 px-3 py-3">
                <AgentOptions
                  assistantMessage={result?.assistant_message}
                  options={result?.options}
                  autoContinueAfterMs={result?.auto_continue_after_ms}
                  onSelect={handleSelectOption}
                  disabled={isLoading}
                />
              </div>
            )}

            {showComposer && (
              <div className="composer-panel shrink-0 border-t border-neutral-800 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <form onSubmit={handleSubmit}>
                  <div className="input-shell flex items-end gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-2 transition-colors">
                    <textarea
                      ref={textareaRef}
                      className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:outline-none"
                      placeholder={
                        hasConversation || messages.length > 0
                          ? 'Refine this draft or describe changes…'
                          : 'Build a site, make a meta ad, or write a post…'
                      }
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading || backendUnreachable}
                      rows={1}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || backendUnreachable || !prompt.trim()}
                      className="send-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-black"
                      aria-label="Send"
                    >
                      <ArrowUpIcon />
                    </button>
                  </div>

                  {!isLoading && !error && messages.length === 0 && (
                    <div className="example-strip mt-2 flex flex-wrap gap-1.5">
                      {EXAMPLE_PROMPTS.map((ex) => (
                        <button
                          key={ex.label}
                          type="button"
                          onClick={() => selectExample(ex.prompt)}
                          className="rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500 transition hover:border-neutral-600 hover:text-neutral-300"
                        >
                          {ex.label}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              </div>
            )}
          </section>

          {/* Result column — draft, preview, loading */}
          <section className="result-pane flex min-h-0 flex-col overflow-hidden">
            <div className="scroll-area min-h-0 flex-1">
              {!result && !isLoading && !error && messages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center px-6 animate-fade-in">
                  <h1 className="mb-2 text-center text-xl font-medium tracking-tight text-white md:text-2xl">
                    What should we build?
                  </h1>
                  <p className="max-w-sm text-center text-sm leading-relaxed text-neutral-500">
                    Output shows here — website preview, Meta ad draft, or publish status. Chats save in the sidebar.
                  </p>
                </div>
              )}

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

              {result && result.success && isAgentResult && (
                <CampaignPanel
                  result={result}
                  sessionId={sessionId}
                  onPublish={publishCampaign}
                  onReset={startNewChat}
                  onSelectOption={handleSelectOption}
                  isPublishing={isPublishing}
                  isLoading={isLoading}
                />
              )}

              {result && result.success && result.projectPath && !isAgentResult && (
              <div className="flex h-full min-h-0 flex-col animate-fade-in">
                {hasConversation && (
                  <div className="shrink-0 border-b border-neutral-800 px-4 py-3">
                    <AgentOptions
                      assistantMessage={result.assistant_message}
                      options={result.options}
                      autoContinueAfterMs={result.auto_continue_after_ms}
                      onSelect={handleSelectOption}
                      disabled={isLoading}
                    />
                  </div>
                )}

                <div className="project-toolbar flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2.5">
                  <div>
                    <p className="text-sm text-white">Project ready</p>
                    <p className="text-xs text-neutral-500">Saved in this chat session — resume anytime from sidebar</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                              await apiFetch('/api/preview/stop', {
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
                      onClick={startNewChat}
                      className="border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
                    >
                      New chat
                    </button>
                  </div>
                </div>

                {previewSrc ? (
                  <iframe
                    src={previewSrc}
                    className="preview-frame block h-full min-h-[240px] w-full flex-1 border-0 bg-white"
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
                            const res = await apiFetch('/api/preview/start', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ projectPath: result.projectPath }),
                            })
                            const data = await readApiJson<{ success?: boolean; previewUrl?: string; port?: number; error?: string }>(res)
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
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
