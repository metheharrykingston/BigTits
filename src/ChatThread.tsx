import { useEffect, useMemo, useRef } from 'react'
import type { ChatMessage, SessionActivity } from './lib/sessions'

interface ChatThreadProps {
  messages: ChatMessage[]
  activities: SessionActivity[]
  liveActivities?: SessionActivity[]
  isWorking?: boolean
  assistantMessage?: string
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
  isWorking = false,
  assistantMessage,
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
      ...activities.map((a) => ({
        kind: 'activity' as const,
        at: a.at,
        activity: a,
      })),
      ...liveActivities.map((a) => ({
        kind: 'activity' as const,
        at: a.at,
        activity: a,
      })),
    ]
    entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    return entries
  }, [messages, activities, liveActivities])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length, isWorking, assistantMessage])

  const hasContent = timeline.length > 0 || Boolean(assistantMessage) || isWorking

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="scroll-area min-h-0 flex-1 px-4 py-4">
        {!hasContent && (
          <div className="mobile-welcome flex h-full flex-col items-center justify-center text-center">
            <div className="welcome-mark mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
              <span className="text-base font-bold tracking-tighter text-white">BT</span>
            </div>
            <p className="text-balance text-2xl font-semibold tracking-tight text-white">
              What should your AI employee do?
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Build a mobile site, write an ad, publish a post, or ask for changes after it drafts.
            </p>
            <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2 text-left text-xs text-neutral-400">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
                Build websites
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
                Make ads
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
                Write posts
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
                Refine results
              </div>
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
                    <p className="whitespace-pre-wrap break-words">{entry.content}</p>
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
                  {activity.detail && (
                    <p className="mt-0.5 truncate text-neutral-600">{activity.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-neutral-700">{formatTime(activity.at)}</span>
              </div>
            )
          })}

          {assistantMessage && !messages.some((m) => m.content === assistantMessage) && (
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-300">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                  Assistant
                </p>
                <p className="leading-relaxed">{assistantMessage}</p>
              </div>
            </div>
          )}

          {isWorking && (
            <div className="flex items-center gap-2 px-1 font-mono text-[11px] text-amber-400">
              <span className="animate-pulse-dot">◌</span>
              <span>Working…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
