import { useEffect, useRef, useState } from 'react'

export interface FollowUpOption {
  id: string
  label: string
  prompt: string
  recommended?: boolean
}

interface AgentOptionsProps {
  assistantMessage?: string
  options?: FollowUpOption[]
  autoContinueAfterMs?: number
  onSelect: (option: FollowUpOption) => void
  disabled?: boolean
}

export function AgentOptions({
  assistantMessage,
  options = [],
  autoContinueAfterMs = 0,
  onSelect,
  disabled = false,
}: AgentOptionsProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const firedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const recommended = options.find((o) => o.recommended) || options[0]
  const optionKey = options.map((o) => o.id).join(',')

  useEffect(() => {
    firedRef.current = false
    setSecondsLeft(null)

    if (!recommended || disabled || autoContinueAfterMs <= 0 || options.length === 0) {
      return
    }

    const endAt = Date.now() + autoContinueAfterMs
    setSecondsLeft(Math.ceil(autoContinueAfterMs / 1000))

    const tick = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        window.clearInterval(tick)
      }
    }, 250)

    const timer = window.setTimeout(() => {
      if (firedRef.current || disabled) return
      firedRef.current = true
      onSelectRef.current(recommended)
    }, autoContinueAfterMs)

    return () => {
      window.clearTimeout(timer)
      window.clearInterval(tick)
    }
  }, [assistantMessage, optionKey, autoContinueAfterMs, disabled, recommended, options.length])

  const handleClick = (option: FollowUpOption) => {
    if (disabled || firedRef.current) return
    firedRef.current = true
    setSecondsLeft(null)
    onSelect(option)
  }

  if (!assistantMessage && options.length === 0) return null

  return (
    <div className="border border-neutral-800 bg-neutral-950 p-4">
      {assistantMessage && (
        <p className="text-sm leading-relaxed text-neutral-300">{assistantMessage}</p>
      )}

      {options.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${assistantMessage ? 'mt-3' : ''}`}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => handleClick(option)}
              className={`rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
                option.recommended
                  ? 'border-white text-white hover:bg-neutral-900'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
              }`}
            >
              {option.label}
              {option.recommended && recommended?.id === option.id && secondsLeft != null && secondsLeft > 0 && (
                <span className="ml-1.5 text-neutral-500">({secondsLeft}s)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {recommended && autoContinueAfterMs > 0 && secondsLeft != null && secondsLeft > 0 && (
        <p className="mt-2 text-[11px] text-neutral-600">
          Auto-continuing with &ldquo;{recommended.label}&rdquo; unless you pick another option.
        </p>
      )}
    </div>
  )
}