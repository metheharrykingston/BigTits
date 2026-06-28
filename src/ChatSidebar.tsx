import { useEffect, useState } from 'react'
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
  onOpenSettings: () => void
  onToggle: () => void
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

function statusDot(status: SessionStatus): string {
  if (status === 'working') return 'bg-amber-400 animate-pulse-dot'
  if (status === 'ready') return 'bg-emerald-400'
  if (status === 'published') return 'bg-sky-400'
  if (status === 'error') return 'bg-red-400'
  return 'bg-neutral-600'
}

function kindAccent(kind: SessionKind): string {
  if (kind === 'website') return 'text-sky-400'
  if (kind === 'agent') return 'text-violet-400'
  if (kind === 'mixed') return 'text-amber-400'
  return 'text-neutral-500'
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function SidebarRail({
  onToggle,
  onNewChat,
  onOpenSettings,
}: {
  onToggle: () => void
  onNewChat: () => void
  onOpenSettings: () => void
}) {
  return (
    <div className="chat-sidebar-rail flex h-full max-h-svh w-12 shrink-0 flex-col items-center gap-2 border-r border-neutral-800/80 bg-neutral-950 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
        aria-label="Open chats"
      >
        <MenuIcon />
      </button>
      <button
        type="button"
        onClick={onNewChat}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-700 text-lg text-neutral-300 transition hover:border-white hover:bg-neutral-900 hover:text-white"
        aria-label="New chat"
      >
        +
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-500 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>
    </div>
  )
}

function SidebarPanel({
  sessions,
  activeSessionId,
  loading,
  collapsed,
  isMobile,
  user,
  initials,
  onSelect,
  onNewChat,
  onDelete,
  onSignOut,
  onOpenSettings,
  onToggle,
}: {
  sessions: SessionSummary[]
  activeSessionId: string
  loading: boolean
  collapsed: boolean
  isMobile: boolean
  user: SidebarUser
  initials: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  onDelete: (sessionId: string) => void
  onSignOut: () => void
  onOpenSettings: () => void
  onToggle: () => void
}) {
  const drawerOpen = isMobile ? !collapsed : true

  return (
    <aside
      data-state={drawerOpen ? 'open' : 'closed'}
      className={`chat-sidebar-panel flex h-full max-h-svh shrink-0 flex-col bg-neutral-950 ${
        isMobile ? 'chat-sidebar-drawer' : 'w-[272px] border-r border-neutral-800/80'
      }`}
      aria-hidden={isMobile && collapsed}
    >
      <header className="sidebar-header flex shrink-0 items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-700 bg-black text-[11px] font-semibold tracking-wide text-white">
            AGI
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-100">Chats</p>
            <p className="text-[10px] text-neutral-600">{sessions.length} saved</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-900 hover:text-white"
          aria-label={isMobile ? 'Close chats' : 'Collapse sidebar'}
        >
          {isMobile ? <CloseIcon /> : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          )}
        </button>
      </header>

      <div className="sidebar-profile mx-4 mb-3 shrink-0 rounded-2xl border border-neutral-800/90 bg-neutral-900/50 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 text-xs font-semibold text-white ring-1 ring-neutral-600/50">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-100">{user.name}</p>
            <p className="truncate text-[11px] text-neutral-500">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="scroll-area sidebar-chat-list min-h-0 flex-1 px-3">
        {loading && sessions.length === 0 && (
          <div className="space-y-2 px-1 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sidebar-skeleton h-14 rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-neutral-600">
            No chats yet. Start one and it stays on this device.
          </p>
        )}
        <ul className="space-y-1.5 pb-2">
          {sessions.map((session, index) => {
            const active = session.session_id === activeSessionId
            return (
              <li
                key={session.session_id}
                className="sidebar-chat-item"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div
                  className={`group relative flex items-center gap-1 rounded-xl border transition-all duration-200 ${
                    active
                      ? 'border-neutral-600/80 bg-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                      : 'border-transparent bg-transparent hover:border-neutral-800/80 hover:bg-neutral-900/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(session.session_id)}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                  >
                    <p className="line-clamp-2 text-[13px] leading-snug text-neutral-200">{session.title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(session.status)}`} />
                      <span className={`text-[10px] font-medium ${kindAccent(session.kind)}`}>
                        {kindLabel(session.kind)}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        {formatRelativeTime(session.updated_at)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(session.session_id)
                    }}
                    className={`mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-red-950/40 hover:text-red-300 ${
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 max-md:opacity-70'
                    }`}
                    aria-label="Delete chat"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <footer className="sidebar-footer shrink-0 space-y-2 border-t border-neutral-800/80 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          <span className="text-base leading-none">+</span>
          <span>New chat</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 px-3 py-2 text-[11px] text-neutral-400 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-neutral-200"
          >
            <SettingsIcon />
            Settings
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-neutral-800 px-3 py-2 text-[11px] text-neutral-500 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-neutral-300"
          >
            Sign out
          </button>
        </div>
      </footer>
    </aside>
  )
}

export function ChatSidebar(props: ChatSidebarProps) {
  const isMobile = useIsMobile()
  const initials =
    props.user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'U'

  if (!isMobile && props.collapsed) {
    return (
      <SidebarRail
        onToggle={props.onToggle}
        onNewChat={props.onNewChat}
        onOpenSettings={props.onOpenSettings}
      />
    )
  }

  return <SidebarPanel {...props} isMobile={isMobile} initials={initials} />
}