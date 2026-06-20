import {
  formatRelativeTime,
  kindLabel,
  type SessionKind,
  type SessionStatus,
  type SessionSummary,
} from './lib/sessions'

interface SidebarUser {
  name: string
  email: string
}

interface ChatSidebarProps {
  sessions: SessionSummary[]
  activeSessionId: string
  loading: boolean
  collapsed: boolean
  user: SidebarUser
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  onDelete: (sessionId: string) => void
  onSignOut: () => void
  onToggle: () => void
}

function statusDot(status: SessionStatus): string {
  if (status === 'working') return 'bg-amber-400 animate-pulse-dot'
  if (status === 'ready') return 'bg-emerald-400'
  if (status === 'published') return 'bg-sky-400'
  if (status === 'error') return 'bg-red-400'
  return 'bg-neutral-600'
}

function kindBadge(kind: SessionKind): string {
  if (kind === 'website') return 'text-sky-400 border-sky-900/60'
  if (kind === 'agent') return 'text-violet-400 border-violet-900/60'
  if (kind === 'mixed') return 'text-amber-400 border-amber-900/60'
  return 'text-neutral-500 border-neutral-800'
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  loading,
  collapsed,
  user,
  onSelect,
  onNewChat,
  onDelete,
  onSignOut,
  onToggle,
}: ChatSidebarProps) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U'

  if (collapsed) {
    return (
      <div className="chat-sidebar-rail flex h-full max-h-svh w-11 shrink-0 flex-col items-center border-r border-neutral-800 bg-neutral-950 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="mb-3 flex h-8 w-8 items-center justify-center border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
          aria-label="Open chats"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 w-8 items-center justify-center border border-neutral-700 text-neutral-300 hover:border-white hover:text-white"
          aria-label="New chat"
        >
          +
        </button>
      </div>
    )
  }

  return (
    <aside className="chat-sidebar-panel flex h-full max-h-svh w-[260px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-100">{user.name}</p>
            <p className="truncate text-[11px] text-neutral-500">{user.email}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Your chats</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSignOut}
            className="border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-500 hover:border-neutral-600 hover:text-neutral-200"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-white"
            aria-label="Collapse sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="scroll-area min-h-0 flex-1 px-2 py-2">
        {loading && sessions.length === 0 && (
          <p className="px-2 py-3 text-xs text-neutral-600">Loading history…</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="px-2 py-3 text-xs leading-relaxed text-neutral-600">
            No chats yet for this login. Start one and it will stay attached to your app profile on this device.
          </p>
        )}
        <ul className="space-y-1">
          {sessions.map((session) => {
            const active = session.session_id === activeSessionId
            return (
              <li key={session.session_id}>
                <div
                  className={`group flex items-start gap-2 rounded-lg border px-2.5 py-2 transition ${
                    active
                      ? 'border-neutral-600 bg-neutral-900'
                      : 'border-transparent hover:border-neutral-800 hover:bg-neutral-900/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(session.session_id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(session.status)}`} />
                      <span className="truncate text-sm text-neutral-200">{session.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-3">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${kindBadge(session.kind)}`}>
                        {kindLabel(session.kind)}
                      </span>
                      {session.preview && (
                        <span className="truncate text-[10px] text-neutral-600">{session.preview}</span>
                      )}
                      <span className="text-[10px] text-neutral-700">
                        {formatRelativeTime(session.updated_at)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(session.session_id)}
                    className={`mt-0.5 shrink-0 rounded-md border px-2 py-1 text-[10px] transition hover:border-red-500/50 hover:text-red-300 ${
                      active
                        ? 'border-red-900/40 text-red-300'
                        : 'border-neutral-800 text-neutral-500 opacity-100 md:opacity-0 md:group-hover:opacity-100'
                    }`}
                    aria-label="Delete chat"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-neutral-800 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-700/60 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-100 transition hover:border-violet-500 hover:bg-violet-500/20"
        >
          <span className="text-base leading-none">+</span>
          <span>Start new chat</span>
        </button>
      </div>
    </aside>
  )
}
