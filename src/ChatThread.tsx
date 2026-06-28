import { useEffect, useMemo, useRef } from 'react'
import type { FollowUpOption } from './AgentOptions'
import type { ResearchRequirementsResponse } from './types/gov-shared'
import { GovChecklistInline } from './features/gov/components/GovChecklistInline'
import { ActivityDetail } from './ActivityDetail'
import { ThinkingIndicator } from './ThinkingIndicator'
import { LinkifiedText } from './lib/linkify'
import type { ChatMessage, SessionActivity } from './lib/sessions'

interface ChatThreadProps {
  messages: ChatMessage[]
  activities: SessionActivity[]
  liveActivities?: SessionActivity[]
  showActivities?: boolean
  isWorking?: boolean
  workingLabel?: string
  thinkingSteps?: string[]
  assistantMessage?: string
  pendingUserMessage?: {
    content: string
    at: string
  } | null
  quickActions?: {
    label: string
    description: string
    prompt: string
    icon: string
    accent: string
  }[]
  onQuickAction?: (prompt: string) => void
  followUpOptions?: FollowUpOption[]
  onSelectFollowUp?: (option: FollowUpOption) => void
  followUpDisabled?: boolean
  govChecklistCaseId?: string
  govChecklistIntro?: string
  govChecklistResearch?: ResearchRequirementsResponse | null
  govChecklistLanguageCode?: string
  govChecklistState?: string
  onGovChecklistError?: (message: string) => void
  className?: string
}

type TimelineEntry =
  | { kind: 'message'; at: string; role: ChatMessage['role']; content: string }
  | { kind: 'activity'; at: string; activity: SessionActivity }

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function activityIcon(status: SessionActivity['status']): string {
  if (status === 'running') return '◌'
  if (status === 'done') return '✓'
  if (status === 'error') return '✕'
  return '·'
}

function activityColor(status: SessionActivity['status']): string {
  if (status === 'running') return 'text-amber-400'
  if (status === 'done') return 'text-emerald-500'
  if (status === 'error') return 'text-red-400'
  return 'text-neutral-500'
}

export function ChatThread({
  messages,
  activities,
  liveActivities = [],
  showActivities = false,
  isWorking = false,
  workingLabel,
  thinkingSteps = [],
  assistantMessage,
  pendingUserMessage = null,
  quickActions = [],
  onQuickAction,
  followUpOptions = [],
  onSelectFollowUp,
  followUpDisabled = false,
  govChecklistCaseId,
  govChecklistIntro,
  govChecklistResearch,
  govChecklistLanguageCode,
  govChecklistState,
  onGovChecklistError,
  className = '',
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...messages.map((m) => ({
        kind: 'message' as const,
        at: m.at,
        role: m.role,
        content: m.content,
      })),
      ...(pendingUserMessage
        ? [{
            kind: 'message' as const,
            at: pendingUserMessage.at,
            role: 'user' as const,
            content: pendingUserMessage.content,
          }]
        : []),
      ...(showActivities
        ? activities.map((a) => ({
            kind: 'activity' as const,
            at: a.at,
            activity: a,
          }))
        : []),
      ...(showActivities
        ? liveActivities.map((a) => ({
            kind: 'activity' as const,
            at: a.at,
            activity: a,
          }))
        : []),
    ]
    entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    return entries
  }, [messages, activities, liveActivities, pendingUserMessage, showActivities])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length, isWorking, assistantMessage, followUpOptions.length, govChecklistCaseId])

  const showThinkingBubble = isWorking
  const showAssistantTurn =
    Boolean(
      assistantMessage &&
        !govChecklistCaseId &&
        !isWorking &&
        !messages.some((m) => m.content === assistantMessage),
    ) ||
    followUpOptions.length > 0 ||
    Boolean(govChecklistCaseId)

  const hasContent = timeline.length > 0 || showAssistantTurn || showThinkingBubble

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="scroll-area min-h-0 flex-1 px-4 py-4">
        {!hasContent && (
          <div className="mobile-welcome flex h-full flex-col items-center justify-center text-center">
            <div className="welcome-mark mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
              <span className="text-base font-semibold tracking-tight text-white">AGI</span>
            </div>
            <p className="text-balance text-2xl font-semibold tracking-tight text-white">
              What should your AGI build?
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Tap a starter to fill the chat box, or type your own request below.
            </p>
            <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2 text-left">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="welcome-action rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3 text-left transition active:scale-[0.98]"
                  onClick={() => onQuickAction?.(action.prompt)}
                >
                  <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-base ${action.accent}`}>
                    {action.icon}
                  </span>
                  <span className="block text-sm font-medium text-neutral-100">{action.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          {timeline.map((entry, i) => {
            if (entry.kind === 'message') {
              const isUser = entry.role === 'user'
              return (
                <div
                  key={`msg-${entry.at}-${i}`}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-white text-black'
                        : 'border border-neutral-800 bg-neutral-950 text-neutral-300'
                    }`}
                  >
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-50">
                      {isUser ? 'You' : 'Assistant'} · {formatTime(entry.at)}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      <LinkifiedText text={entry.content} />
                    </p>
                  </div>
                </div>
              )
            }

            const { activity } = entry
            return (
              <div
                key={`act-${activity.id}-${i}`}
                className="flex items-start gap-2 rounded-lg border border-neutral-800/80 bg-black/50 px-3 py-2 font-mono text-[11px]"
              >
                <span className={`mt-0.5 w-3 shrink-0 ${activityColor(activity.status)}`}>
                  {activityIcon(activity.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-neutral-300">{activity.label}</p>
                  {activity.detail && <ActivityDetail detail={activity.detail} />}
                </div>
                <span className="shrink-0 text-neutral-700">{formatTime(activity.at)}</span>
              </div>
            )
          })}

          {showThinkingBubble && (
            <div className="flex justify-start animate-fade-in">
              <div className="max-w-[92%] rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                  Assistant
                </p>
                <ThinkingIndicator
                  label={workingLabel || assistantMessage}
                  steps={
                    thinkingSteps.length > 0
                      ? thinkingSteps
                      : ['Thinking…']
                  }
                />
              </div>
            </div>
          )}

          {showAssistantTurn && (
            <div className="flex justify-start">
              <div className="flex max-w-[92%] flex-col gap-2.5">
                {assistantMessage && !messages.some((m) => m.content === assistantMessage) && (
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-300">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                      Assistant
                    </p>
                    <p className="leading-relaxed">
                      <LinkifiedText text={assistantMessage} />
                    </p>
                  </div>
                )}
                {followUpOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-0.5">
                    {followUpOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={followUpDisabled}
                        onClick={() => onSelectFollowUp?.(option)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
                          option.recommended
                            ? 'border-white text-white hover:bg-neutral-900'
                            : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                {govChecklistCaseId && (
                  <GovChecklistInline
                    caseId={govChecklistCaseId}
                    intro={govChecklistIntro}
                    research={govChecklistResearch}
                    languageCode={govChecklistLanguageCode}
                    stateName={govChecklistState}
                    onError={onGovChecklistError}
                  />
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
