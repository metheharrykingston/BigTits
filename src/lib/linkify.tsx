import type { ReactNode } from 'react'

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/gi

export function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

export function linkifyText(text: string, linkClassName = 'text-sky-400 underline underline-offset-2 hover:text-sky-300'): ReactNode[] {
  const parts = text.split(URL_RE)
  if (parts.length === 1) return [text]

  const matches = text.match(URL_RE) || []
  const nodes: ReactNode[] = []

  parts.forEach((part, index) => {
    if (part) nodes.push(part)
    const href = matches[index]
    if (href) {
      nodes.push(
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {href}
        </a>,
      )
    }
  })

  return nodes
}

interface LinkifiedTextProps {
  text: string
  className?: string
  linkClassName?: string
}

export function LinkifiedText({ text, className, linkClassName }: LinkifiedTextProps) {
  return <span className={className}>{linkifyText(text, linkClassName)}</span>
}