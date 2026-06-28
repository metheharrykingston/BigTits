import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentOptions, type FollowUpOption } from './AgentOptions'
import { CampaignPanel, type AgentResponse } from './CampaignPanel'
import { ChatSidebar } from './ChatSidebar'
import { ActivityDetail } from './ActivityDetail'
import { ChatThread } from './ChatThread'
import { apiFetch, apiHint, apiStatusPath, apiUrl, getAuthToken, readApiJson, setAuthToken } from './lib/api'
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
import { api as govApi } from './features/gov/api/client'
import { resolveGovIntent, type GovServiceMatch } from './features/gov/govIntent'
import type { ResearchRequirementsResponse } from './types/gov-shared'
import { ComposerVoiceButton } from './components/ComposerVoiceButton'
import { LocaleOnboarding } from './components/LocaleOnboarding'
import { SettingsPanel } from './components/SettingsPanel'
import {
  detectLanguageSwitch,
  getCountry,
  getLanguage,
  loadUserPreferences,
  localeApiPayload,
  needsLocaleOnboarding,
  saveUserPreferences,
  type UserPreferences,
} from './lib/userPreferences'
import { t } from './lib/localizedStrings'
import './index.css'

interface CreateResponse extends AgentResponse {
  kind?: 'website' | 'agent' | 'gov' | string
  stage?: string
  gov_service_id?: string
  gov_clarify_step?: 'licence_type' | 'state'
  gov_licence_type?: 'learner' | 'permanent'
  gov_intent_base?: string
  gov_case_id?: string
  gov_research?: ResearchRequirementsResponse
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
  projectFiles?: string[]
  fileCount?: number
}

interface PendingUserMessage {
  content: string
  at: string
}

interface UserProfile {
  name: string
  email: string
}

interface LoginResponse {
  success: boolean
  token?: string
  user?: UserProfile
  error?: string
}

interface AuthMeResponse {
  success: boolean
  user?: UserProfile
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserProfile
    if (!parsed?.name || !parsed?.email) return null
    return { name: parsed.name.trim(), email: normalizeEmail(parsed.email) }
  } catch {
    return null
  }
}

function saveUserProfile(profile: UserProfile | null) {
  if (!profile) {
    localStorage.removeItem(USER_PROFILE_KEY)
    return
  }
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile))
}

const SESSION_KEY = 'bigtits-agent-session'
const USER_PROFILE_KEY = 'bigtits-user-profile'

const EXAMPLE_PROMPTS = [
  { label: 'Meta ad campaign', prompt: 'Make a meta ad campaign for my coffee shop targeting local customers' },
  { label: 'Driving licence', prompt: 'Help me apply for a driving licence' },
  { label: 'Facebook post', prompt: 'Write a facebook post announcing our summer menu for my cafe' },
  { label: 'Electronic store', prompt: 'Build an electronic store website' },
  { label: 'Furniture shop', prompt: 'Create a furniture store website' },
  { label: 'Cafe website', prompt: 'Create a website for my cafe' },
  { label: 'Portfolio', prompt: 'Make a personal portfolio website' },
]

const GOV_STATE_OPTIONS: FollowUpOption[] = [
  { id: 'gov-state-mh', label: 'Maharashtra', prompt: 'Maharashtra' },
  { id: 'gov-state-dl', label: 'Delhi', prompt: 'Delhi' },
  { id: 'gov-state-ka', label: 'Karnataka', prompt: 'Karnataka', recommended: true },
  { id: 'gov-state-tn', label: 'Tamil Nadu', prompt: 'Tamil Nadu' },
  { id: 'gov-state-up', label: 'Uttar Pradesh', prompt: 'Uttar Pradesh' },
]

function localizedGovServiceName(serviceId: string, langCode: string): string {
  if (serviceId === 'learner_licence') {
    if (langCode === 'hi') return 'ड्राइविंग लाइसेंस (Sarathi Parivahan)'
    if (langCode === 'hinglish') return 'Driving Licence (Sarathi Parivahan)'
  }
  return 'Driving Licence (Sarathi Parivahan)'
}

function govClarifyOptions(
  match: GovServiceMatch,
  originalPrompt: string,
  langCode: string,
): FollowUpOption[] {
  if (match.service_id === 'learner_licence') {
    return [
      {
        id: 'gov-learner',
        label: t(langCode, 'gov_opt_learner'),
        prompt: `${originalPrompt} — learner licence`,
        recommended: true,
      },
      {
        id: 'gov-permanent',
        label: t(langCode, 'gov_opt_permanent'),
        prompt: `${originalPrompt} — permanent driving licence`,
      },
      {
        id: 'gov-explain',
        label: t(langCode, 'gov_opt_explain'),
        prompt: '__gov_explain_licence__',
      },
    ]
  }
  return match.clarifying_questions.map((q, i) => ({
    id: `gov-q-${i}`,
    label: q,
    prompt: `${originalPrompt} — ${q}`,
    recommended: i === 0,
  }))
}

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
  if (!url) return null
  if (isLocalPreviewUrl(url)) {
    return import.meta.env.DEV ? url : null
  }
  return url
}

async function checkBackendStatus(): Promise<StatusResponse> {
  try {
    const path = apiStatusPath()
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

function BigTitsHome() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => loadUserProfile())
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => loadUserPreferences())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
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
  const isPlanningResult = result?.stage === 'planning'
  const isGovClarifying = result?.kind === 'gov' && result?.stage === 'gov_clarifying'
  const isGovResearching = result?.kind === 'gov' && result?.stage === 'gov_researching'
  const isGovChecklist = result?.kind === 'gov' && result?.stage === 'gov_checklist'
  const isGovChatFlow = isGovClarifying || isGovResearching || isGovChecklist
  const previewSrc =
    isAgentResult || isPlanningResult || isGovChatFlow ? null : getPreviewSrc(result?.previewUrl)
  const hasConversation = Boolean(
    !isGovClarifying &&
      (result?.assistant_message || (result?.options && result.options.length > 0)),
  )
  const visibleSessions = sessions
  const latestActivity = [...activities, ...liveActivities]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .at(-1)
  const showLiveStatus = Boolean(
    latestActivity &&
      (
        isLoading ||
        isPublishing ||
        latestActivity.status === 'running' ||
        Date.now() - new Date(latestActivity.at).getTime() < 120000
      ),
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
      const token = getAuthToken()
      const savedProfile = loadUserProfile()
      if (!token || !savedProfile) {
        setSessionsLoading(false)
        return
      }

      try {
        const authRes = await apiFetch('/api/auth/me')
        if (!authRes.ok) {
          throw new Error('Authentication expired')
        }
        const authData = await readApiJson<AuthMeResponse>(authRes)
        if (!authData.user) {
          throw new Error('Authentication expired')
        }
        if (cancelled) return
        saveUserProfile(authData.user)
        setUserProfile(authData.user)
        setUserPreferences(loadUserPreferences())
        await refreshSessions()
      } catch {
        setAuthToken(null)
        saveUserProfile(null)
        localStorage.removeItem(SESSION_KEY)
        if (!cancelled) {
          setUserProfile(null)
          setSessionId('')
          setSessions([])
          setSessionsLoading(false)
        }
        return
      }

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

  const appendChatMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [...prev, { role, content, at: new Date().toISOString() }])
  }, [])

  const flushPendingUserMessage = useCallback(() => {
    setPendingUserMessage((pending) => {
      if (pending) {
        setMessages((prev) => {
          if (prev.some((m) => m.role === 'user' && m.content === pending.content)) return prev
          return [...prev, { role: 'user', content: pending.content, at: pending.at }]
        })
      }
      return null
    })
  }, [])

  const commitAssistantTurn = useCallback((text?: string) => {
    if (!text) return
    setMessages((prev) => {
      if (prev.some((m) => m.role === 'assistant' && m.content === text)) return prev
      return [...prev, { role: 'assistant', content: text, at: new Date().toISOString() }]
    })
  }, [])

  const openGovChecklistInChat = async (
    intent: string,
    serviceId: string,
    userLabel: string,
    assistantToCommit?: string,
    opts?: { state?: string; licenceType?: string },
  ) => {
    setIsLoading(true)
    setError('')
    setErrorHint('')
    const state = opts?.state || userLabel
    const licenceType = opts?.licenceType || result?.gov_licence_type || 'learner'
    try {
      commitAssistantTurn(assistantToCommit)
      appendChatMessage('user', userLabel)
      setResult({
        success: true,
        kind: 'gov',
        stage: 'gov_researching',
        gov_service_id: serviceId,
        gov_licence_type: licenceType as 'learner' | 'permanent',
        gov_intent_base: intent,
        assistant_message: t(userPreferences.languageCode, 'gov_researching', {
          state,
          licenceType,
        }),
      })

      let research = null
      try {
        research = await govApi.researchRequirements({
          service_id: serviceId as 'income_certificate' | 'learner_licence',
          state,
          licence_type: licenceType,
          intent,
        })
      } catch {
        research = null
      }

      const created = await govApi.createCase({
        intent,
        service_id: serviceId as 'income_certificate' | 'learner_licence',
      })

      setResult({
        success: true,
        kind: 'gov',
        stage: 'gov_checklist',
        gov_service_id: serviceId,
        gov_case_id: created.case_id,
        gov_intent_base: intent,
        gov_licence_type: licenceType as 'learner' | 'permanent',
        gov_research: research ?? undefined,
        assistant_message: research
          ? t(userPreferences.languageCode, 'gov_checklist_research', { message: research.message })
          : t(userPreferences.languageCode, 'gov_checklist_fallback', { state }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start paperwork case')
      setErrorHint('Run: npm run app:gov-api (Gov API on :8001)')
    } finally {
      setIsLoading(false)
    }
  }

  const applyLanguageSwitch = useCallback(
    (message: string): UserPreferences => {
      const switched = detectLanguageSwitch(
        message,
        userPreferences.languageCode,
        userPreferences.countryCode,
      )
      if (!switched) return userPreferences
      const next = { ...userPreferences, languageCode: switched }
      saveUserPreferences(next)
      setUserPreferences(next)
      return next
    },
    [userPreferences],
  )

  const runDemo = async (finalPrompt: string, opts?: { keepResult?: boolean }) => {
    if (!finalPrompt.trim() || isLoading) return
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId
    const activePrefs = applyLanguageSwitch(finalPrompt)

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

    const govMatch = resolveGovIntent(finalPrompt)
    if (govMatch && !opts?.keepResult) {
      setResult({
        success: true,
        kind: 'gov',
        stage: 'gov_clarifying',
        gov_clarify_step: 'licence_type',
        gov_service_id: govMatch.service_id,
        gov_intent_base: finalPrompt.trim(),
        assistant_message: t(activePrefs.languageCode, 'gov_licence_type_question', {
          service: localizedGovServiceName(govMatch.service_id, activePrefs.languageCode),
        }),
        options: govClarifyOptions(govMatch, finalPrompt.trim(), activePrefs.languageCode),
      })
      setIsLoading(false)
      return
    }

    let generationSucceeded = false
    let activeSid = sessionId

    try {
      let ensuredSessionId = activeSid
      if (!ensuredSessionId) {
        ensuredSessionId = await createSession()
        setSessionId(ensuredSessionId)
        localStorage.setItem(SESSION_KEY, ensuredSessionId)
        setSessionTitle('New chat')
        await refreshSessions()
      }

      activeSid = ensuredSessionId
      startSessionPolling(activeSid)

      const res = await apiFetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt.trim(),
          session_id: activeSid || undefined,
          user_locale: localeApiPayload(activePrefs),
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

      if (data.stage === 'planning') {
        setResult({
          ...data,
          kind: 'website',
          projectPath: undefined,
          previewUrl: undefined,
        })
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
      setError('Could not start this request')
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

  const handleVoiceTranscript = (text: string) => {
    setVoiceError('')
    setPrompt(text)
    if (!isLoading && backendStatus !== 'unreachable') {
      runDemo(text)
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = prompt.trim()
    if (!text || isLoading) return

    if (isGovClarifying && result?.gov_service_id && result.gov_clarify_step === 'state') {
      setPrompt('')
      void openGovChecklistInChat(
        `${result.gov_intent_base || 'government paperwork'} — ${result.gov_licence_type || 'learner'} licence — ${text}`,
        result.gov_service_id,
        text,
        result.assistant_message,
        { state: text, licenceType: result.gov_licence_type },
      )
      return
    }

    runDemo(text)
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
    if (!isLoading) {
      runDemo(example)
    }
  }

  const handleSelectOption = (option: FollowUpOption) => {
    if (isGovClarifying && result?.gov_service_id) {
      if (option.prompt === '__gov_explain_licence__') {
        flushPendingUserMessage()
        commitAssistantTurn(result.assistant_message)
        appendChatMessage('user', option.label)
        setResult({
          success: true,
          kind: 'gov',
          stage: 'gov_clarifying',
          gov_clarify_step: 'licence_type',
          gov_service_id: result.gov_service_id,
          gov_intent_base: result.gov_intent_base || pendingUserMessage?.content || 'driving licence',
          assistant_message: t(userPreferences.languageCode, 'gov_licence_explain'),
          options: govClarifyOptions(
            {
              service_id: result.gov_service_id,
              display_name: 'Driving Licence',
              clarifying_questions: [],
            },
            result.gov_intent_base || pendingUserMessage?.content || 'driving licence',
            userPreferences.languageCode,
          ).filter((o) => o.id !== 'gov-explain'),
        })
        return
      }

      const step = result.gov_clarify_step || 'licence_type'
      const baseIntent = result.gov_intent_base || pendingUserMessage?.content || 'government paperwork'

      if (
        step === 'licence_type' &&
        result.gov_service_id === 'learner_licence' &&
        (option.id === 'gov-learner' || option.id === 'gov-permanent')
      ) {
        flushPendingUserMessage()
        commitAssistantTurn(result.assistant_message)
        appendChatMessage('user', option.label)
        const licenceType = option.id === 'gov-permanent' ? 'permanent' : 'learner'
        setResult({
          success: true,
          kind: 'gov',
          stage: 'gov_clarifying',
          gov_clarify_step: 'state',
          gov_service_id: result.gov_service_id,
          gov_licence_type: licenceType,
          gov_intent_base: baseIntent,
          assistant_message: t(userPreferences.languageCode, 'gov_state_question'),
          options: GOV_STATE_OPTIONS,
        })
        return
      }

      if (step === 'state') {
        void openGovChecklistInChat(
          `${baseIntent} — ${result.gov_licence_type || 'learner'} licence — ${option.prompt}`,
          result.gov_service_id,
          option.label,
          result.assistant_message,
          { state: option.label, licenceType: result.gov_licence_type },
        )
        return
      }

      void openGovChecklistInChat(
        option.prompt,
        result.gov_service_id,
        option.label,
        result.assistant_message,
      )
      return
    }
    runDemo(option.prompt, { keepResult: true })
  }

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const name = loginName.trim()
    const email = normalizeEmail(loginEmail)
    if (!name || !email) return
    setError('')
    setErrorHint('')
    setSessionsLoading(true)

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      const data = await readApiJson<LoginResponse>(res)
      if (!res.ok || !data.success || !data.token || !data.user) {
        setError(data.error || 'Could not sign in')
        setSessionsLoading(false)
        return
      }

      setAuthToken(data.token)
      saveUserProfile(data.user)
      setUserProfile(data.user)
      setUserPreferences(loadUserPreferences())
      setLoginName('')
      setLoginEmail('')
      localStorage.removeItem(SESSION_KEY)
      setSessionId('')
      setSessionTitle('New chat')
      setMessages([])
      setActivities([])
      setLiveActivities([])
      setPendingUserMessage(null)
      setResult(null)
      await refreshSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleSignOut = async () => {
    activeRequestRef.current += 1
    stopSessionPolling()
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignore logout request failures and clear local auth anyway.
    }
    setAuthToken(null)
    saveUserProfile(null)
    localStorage.removeItem(SESSION_KEY)
    setUserProfile(null)
    setSessionId('')
    setSessionTitle('New chat')
    setMessages([])
    setActivities([])
    setLiveActivities([])
    setPendingUserMessage(null)
    setResult(null)
    setSessions([])
    setSessionsLoading(false)
    setPrompt('')
    setError('')
    setErrorHint('')
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
          user_locale: localeApiPayload(userPreferences),
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
  const showComposer = true
  const activeSummary = visibleSessions.find((s) => s.session_id === sessionId)
  const hasOutput = Boolean((result && !isGovChatFlow) || error)

  const handleOnboardingComplete = (prefs: UserPreferences) => {
    const next = {
      ...prefs,
      profileEmail: userProfile?.email,
      onboardingComplete: true,
      termsAccepted: true,
    }
    saveUserPreferences(next)
    setUserPreferences(next)
  }

  const handleSaveSettings = (prefs: UserPreferences) => {
    const next = {
      ...prefs,
      profileEmail: userProfile?.email || prefs.profileEmail,
      onboardingComplete: true,
      termsAccepted: true,
    }
    saveUserPreferences(next)
    setUserPreferences(next)
  }

  const activeCountry = getCountry(userPreferences.countryCode)
  const activeLanguage = getLanguage(userPreferences.languageCode)

  if (!userProfile) {
    return (
      <div className="flex h-svh items-center justify-center bg-black px-4 text-white">
        <div className="login-card w-full max-w-sm rounded-[28px] border border-neutral-800 bg-neutral-950 p-6 shadow-2xl animate-fade-in">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-black text-sm font-semibold text-white">
              AGI
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Sign in to keep your chats tied to your app profile on this device and continue where you left off.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-500">Name</span>
              <input
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-neutral-600"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-neutral-500">Email</span>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-neutral-600"
              />
            </label>
            <button
              type="submit"
              disabled={!loginName.trim() || !loginEmail.trim()}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue to chats
            </button>
            {error && (
              <p className="rounded-2xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    )
  }

  if (needsLocaleOnboarding(userPreferences, userProfile.email)) {
    return (
      <LocaleOnboarding
        initial={userPreferences}
        userName={userProfile.name}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  return (
    <div className="app-shell flex h-svh overflow-hidden bg-black text-white">
      <SettingsPanel
        open={settingsOpen}
        preferences={userPreferences}
        userName={userProfile.name}
        userEmail={userProfile.email}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
      <ChatSidebar
        sessions={visibleSessions}
        activeSessionId={sessionId}
        loading={sessionsLoading}
        collapsed={sidebarCollapsed}
        user={userProfile}
        onSelect={handleSelectSession}
        onNewChat={startNewChat}
        onDelete={handleDeleteSession}
        onSignOut={handleSignOut}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <button
        type="button"
        aria-label="Close chats"
        className={`mobile-sidebar-backdrop ${!sidebarCollapsed ? 'is-visible' : ''}`}
        onClick={() => setSidebarCollapsed(true)}
        tabIndex={sidebarCollapsed ? -1 : 0}
      />

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
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-[10px] font-semibold text-white">
              {userProfile.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || '')
                .join('') || 'U'}
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

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden items-center gap-1.5 rounded-full border border-neutral-800 px-2.5 py-1 text-[11px] text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200 sm:flex"
              title={`${activeCountry.name} · ${activeLanguage.nativeName}`}
            >
              <span>{activeCountry.flag}</span>
              <span className="max-w-[72px] truncate">{activeLanguage.code.toUpperCase()}</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 transition hover:border-neutral-600 hover:text-white"
              aria-label="Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
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
              showActivities={false}
              isWorking={isLoading || isPublishing || isGovResearching}
              workingLabel={
                isGovResearching
                  ? 'Researching official requirements…'
                  : isLoading && !isGovResearching
                    ? 'Working on your request…'
                    : undefined
              }
              thinkingSteps={
                isGovResearching
                  ? [
                      'Checking sarathi.parivahan.gov.in…',
                      'Searching official .gov.in sources…',
                      'Matching documents for your state…',
                    ]
                  : isLoading
                    ? ['Thinking…']
                    : []
              }
              assistantMessage={result?.assistant_message}
              pendingUserMessage={pendingUserMessage}
              quickActions={QUICK_ACTIONS}
              onQuickAction={selectExample}
              followUpOptions={isGovClarifying ? result?.options : undefined}
              onSelectFollowUp={handleSelectOption}
              followUpDisabled={isLoading}
              govChecklistCaseId={isGovChecklist ? result?.gov_case_id : undefined}
              govChecklistIntro={isGovChecklist ? result?.assistant_message : undefined}
              govChecklistResearch={isGovChecklist ? result?.gov_research : undefined}
              onGovChecklistError={() => {
                /* Portal errors stay inline in the checklist */
              }}
            />

            {showLiveStatus && latestActivity && (
              <div className="shrink-0 border-t border-neutral-900 bg-neutral-950/90 px-3 py-2">
                <div className="mx-auto flex w-full max-w-xl items-start gap-2 rounded-xl border border-neutral-800/80 bg-black/40 px-3 py-2 font-mono text-[11px]">
                  <span className={`${latestActivity.status === 'error' ? 'text-red-400' : latestActivity.status === 'done' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {latestActivity.status === 'error' ? '✕' : latestActivity.status === 'done' ? '✓' : '◌'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-300">{latestActivity.label}</p>
                    {latestActivity.detail && <ActivityDetail detail={latestActivity.detail} />}
                  </div>
                </div>
              </div>
            )}

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
                    <ComposerVoiceButton
                      countryCode={userPreferences.countryCode}
                      languageCode={userPreferences.languageCode}
                      disabled={isLoading || backendUnreachable || voiceListening}
                      onTranscript={handleVoiceTranscript}
                      onError={setVoiceError}
                      onListeningChange={setVoiceListening}
                    />
                    <textarea
                      ref={textareaRef}
                      className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:outline-none"
                      placeholder={
                        isGovClarifying
                          ? result?.gov_clarify_step === 'state'
                            ? t(userPreferences.languageCode, 'gov_composer_state')
                            : t(userPreferences.languageCode, 'gov_composer_answer')
                          : isGovChecklist
                            ? 'Ask about requirements or the portal…'
                          : hasConversation || messages.length > 0
                            ? 'Refine this draft or describe changes…'
                            : t(userPreferences.languageCode, 'composer_placeholder')
                      }
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading || backendUnreachable || voiceListening}
                      rows={1}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || backendUnreachable || voiceListening || !prompt.trim()}
                      className="send-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-black"
                      aria-label="Send"
                    >
                      <ArrowUpIcon />
                    </button>
                  </div>

                  {voiceListening && (
                    <p className="mt-1.5 text-center text-[11px] text-red-300/90">
                      {userPreferences.languageCode === 'hi' || userPreferences.languageCode === 'hinglish'
                        ? 'बोलिए — हम सुन रहे हैं…'
                        : 'Speak now — listening…'}
                    </p>
                  )}
                  {voiceError && !voiceListening && (
                    <p className="mt-1.5 text-center text-[11px] text-amber-300/90">{voiceError}</p>
                  )}

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
                <p className="chat-disclaimer mt-2 text-center text-[10px] leading-relaxed text-neutral-600">
                  {t(userPreferences.languageCode, 'disclaimer')}
                </p>
              </div>
            )}
          </section>

          {/* Result column — draft, preview, loading */}
          <section className="result-pane flex min-h-0 flex-col overflow-hidden">
            <div className="scroll-area min-h-0 flex-1">
              {!result && !isLoading && !error && messages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center px-6 animate-fade-in">
                  <h1 className="mb-2 text-center text-xl font-medium tracking-tight text-white md:text-2xl">
                    {t(userPreferences.languageCode, 'welcome_chat')}
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

              {result && result.success && isPlanningResult && (
                <div className="flex h-full min-h-0 flex-col animate-fade-in">
                  <div className="shrink-0 border-b border-neutral-800 px-4 py-4">
                    <p className="text-sm font-medium text-white">Planning your website</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Answer a few quick questions so the build matches your business — not a raw template dump.
                    </p>
                  </div>
                  <div className="scroll-area min-h-0 flex-1 px-4 py-4">
                    <AgentOptions
                      assistantMessage={result.assistant_message}
                      options={result.options}
                      autoContinueAfterMs={result.auto_continue_after_ms}
                      onSelect={handleSelectOption}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {result && result.success && result.projectPath && !isAgentResult && !isPlanningResult && (
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
                    <p className="text-xs text-neutral-500">
                      {result.fileCount
                        ? `${result.fileCount} real project files created and saved in this chat session`
                        : 'Saved in this chat session — resume anytime from sidebar'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(previewSrc || result.previewUrl) && (
                      <>
                        <button
                          onClick={() => {
                            const target = previewSrc || result.previewUrl || ''
                            const href = target.startsWith('/')
                              ? `${window.location.origin}${target}`
                              : target
                            window.open(href, '_blank')
                          }}
                          className="flex items-center gap-1.5 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
                        >
                          <ExternalLinkIcon />
                          Open preview
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
                  <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,0.72fr)_minmax(260px,0.28fr)]">
                    <iframe
                      src={previewSrc}
                      className="preview-frame block min-h-[240px] w-full flex-1 border-0 bg-white"
                      title="Live project preview"
                      allow="fullscreen"
                    />
                    <div className="border-t border-neutral-800 bg-neutral-950 md:min-h-0 md:border-l md:border-t-0">
                      <div className="border-b border-neutral-800 px-4 py-3">
                        <p className="text-sm text-white">Generated files</p>
                        <p className="text-xs text-neutral-500">
                          Real files copied into this project folder
                        </p>
                      </div>
                      <div className="scroll-area h-full max-h-[280px] overflow-y-auto px-4 py-3 md:max-h-none">
                        {result.projectFiles && result.projectFiles.length > 0 ? (
                          <div className="space-y-1.5">
                            {result.projectFiles.slice(0, 24).map((file) => (
                              <div
                                key={file}
                                className="rounded-lg border border-neutral-900 bg-black/40 px-3 py-2 font-mono text-[11px] text-neutral-300"
                              >
                                {file}
                              </div>
                            ))}
                            {result.projectFiles.length > 24 && (
                              <p className="pt-1 text-xs text-neutral-500">
                                Template copied {result.projectFiles.length} files total — showing key paths above.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-500">File list unavailable.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                    {result.previewUrl && isLocalPreviewUrl(result.previewUrl) ? (
                      <>
                        <p className="text-sm text-neutral-300">Project generated successfully</p>
                        <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
                          Preview is running on this machine.
                        </p>
                        <a
                          href={result.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center gap-1.5 border border-neutral-600 px-4 py-2 text-sm text-white hover:bg-neutral-900"
                        >
                          <ExternalLinkIcon />
                          Open preview
                        </a>
                        {!import.meta.env.DEV && (
                          <p className="mt-3 max-w-sm text-xs leading-relaxed text-neutral-600">
                            Deploy to production for a shareable preview link on mobile.
                          </p>
                        )}
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

export default BigTitsHome
