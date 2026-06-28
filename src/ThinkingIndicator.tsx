import { useEffect, useState } from 'react'

interface ThinkingIndicatorProps {
  label?: string
  steps?: string[]
  className?: string
}

export function ThinkingIndicator({
  label,
  steps = [],
  className = '',
}: ThinkingIndicatorProps) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (steps.length <= 1) return
    const timer = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length)
    }, 2200)
    return () => window.clearInterval(timer)
  }, [steps])

  const activeStep = steps.length > 0 ? steps[stepIndex] : null

  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <div className="thinking-dots flex shrink-0 items-center gap-1 pt-1.5" aria-hidden>
        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-neutral-400" />
        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-neutral-400" />
        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-neutral-400" />
      </div>
      <div className="min-w-0 flex-1">
        {label && (
          <p className="text-sm leading-relaxed text-neutral-300">{label}</p>
        )}
        {activeStep && (
          <p
            key={activeStep}
            className="thinking-step mt-1 text-[11px] text-neutral-500"
          >
            {activeStep}
          </p>
        )}
      </div>
    </div>
  )
}