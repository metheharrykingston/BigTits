import { isUrl, LinkifiedText } from './lib/linkify'

interface ActivityDetailProps {
  detail: string
  className?: string
}

export function ActivityDetail({ detail, className = 'mt-0.5 truncate text-neutral-600' }: ActivityDetailProps) {
  if (isUrl(detail)) {
    return (
      <a
        href={detail}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} block text-sky-400 underline underline-offset-2 hover:text-sky-300`}
      >
        {detail}
      </a>
    )
  }

  return <p className={className}><LinkifiedText text={detail} /></p>
}