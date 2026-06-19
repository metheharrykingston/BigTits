import { useEffect, useRef, useState } from 'react'

export type FileLineStatus = 'pending' | 'writing' | 'done'

export interface FileLine {
  id: string
  path: string
  status: FileLineStatus
}

const REACT_FILES = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/App.css',
  'src/index.css',
  'src/components/Header.tsx',
  'src/components/Footer.tsx',
  'src/components/Hero.tsx',
  'src/pages/Home.tsx',
  'public/favicon.svg',
  'eslint.config.js',
  'README.md',
]

const ELECTRONIC_FILES = [
  'index.html',
  'css/bootstrap.min.css',
  'css/style.css',
  'css/owl.carousel.min.css',
  'js/jquery.min.js',
  'js/bootstrap.bundle.min.js',
  'js/main.js',
  'image/hero/hero-banner.avif',
  'image/products/product-01.avif',
  'product-template.html',
  'about.html',
  'contact.html',
  'cart.html',
  'checkout.html',
]

const FURNITURE_FILES = [
  'index.html',
  'assets/css/bootstrap.min.css',
  'assets/css/style.css',
  'assets/css/animate.min.css',
  'assets/js/jquery.min.js',
  'assets/js/main.js',
  'assets/images/logo.svg',
  'assets/images/hero-banner.jpg',
  'shop-products-one.html',
  'shop-details-one.html',
  'blog.html',
  'contact.html',
  'create-account.html',
  'empty-cart.html',
]

const EXTRA_PARTS = [
  'components', 'sections', 'layouts', 'pages', 'styles', 'scripts',
  'images', 'fonts', 'data', 'utils', 'partials', 'widgets',
]

const EXTRA_NAMES = [
  'Header', 'Footer', 'Hero', 'Navbar', 'Sidebar', 'Gallery', 'ProductCard',
  'Cart', 'Checkout', 'Banner', 'Slider', 'Menu', 'ContactForm', 'Newsletter',
  'Featured', 'Categories', 'Testimonials', 'Pricing', 'Modal', 'Loader',
  'Search', 'Filters', 'Breadcrumb', 'Pagination', 'Reviews', 'Wishlist',
]

function guessTemplateKind(prompt: string): 'react' | 'electronic' | 'furniture' {
  const p = prompt.toLowerCase()
  if (/electronic|electronics|gadget|tech store|phone shop|computer store/.test(p)) {
    return 'electronic'
  }
  if (/furniture|home store|home decor|interior|sofa|homeware/.test(p)) {
    return 'furniture'
  }
  return 'react'
}

function baseFilesForPrompt(prompt: string): string[] {
  const kind = guessTemplateKind(prompt)
  if (kind === 'electronic') return ELECTRONIC_FILES
  if (kind === 'furniture') return FURNITURE_FILES
  return REACT_FILES
}

function randomExtraFile(index: number, kind: ReturnType<typeof guessTemplateKind>): string {
  const part = EXTRA_PARTS[index % EXTRA_PARTS.length]
  const name = EXTRA_NAMES[index % EXTRA_NAMES.length]
  const n = String((index % 9) + 1).padStart(2, '0')

  if (kind === 'react') {
    const ext = index % 3 === 0 ? 'css' : index % 3 === 1 ? 'tsx' : 'ts'
    return `src/${part}/${name}.${ext}`
  }
  if (kind === 'electronic') {
    return index % 2 === 0 ? `image/${part}/${name.toLowerCase()}-${n}.avif` : `js/${name.toLowerCase()}.js`
  }
  return index % 2 === 0 ? `assets/images/${name.toLowerCase()}-${n}.jpg` : `assets/css/${name.toLowerCase()}.css`
}

function nextFilePath(prompt: string, index: number): string {
  const base = baseFilesForPrompt(prompt)
  if (index < base.length) return base[index]
  return randomExtraFile(index - base.length, guessTemplateKind(prompt))
}

function snippetForPath(filePath: string, kind: ReturnType<typeof guessTemplateKind>): string {
  const name = filePath.split('/').pop() || filePath

  if (filePath.endsWith('.html')) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${kind === 'electronic' ? 'Electro Store' : kind === 'furniture' ? 'Home & Furniture' : 'App'}</title>
  <link rel="stylesheet" href="${kind === 'furniture' ? 'assets/css/style.css' : 'css/style.css'}" />
</head>
<body>
  <header class="site-header">...</header>
  <main class="page-content">...</main>
  <footer class="site-footer">...</footer>
</body>
</html>`
  }

  if (filePath.endsWith('.css')) {
    return `/* ${name} */
:root {
  --bg: #0a0a0a;
  --fg: #fafafa;
  --accent: #fff;
}

.hero {
  display: flex;
  align-items: center;
  min-height: 72vh;
  padding: 4rem 2rem;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}`
  }

  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    return `import { useState } from 'react'

export function ${name.replace(/\.\w+$/, '')}() {
  const [open, setOpen] = useState(false)

  return (
    <section className="section">
      <h2>Welcome</h2>
      <button onClick={() => setOpen(!open)}>
        Explore
      </button>
    </section>
  )
}`
  }

  if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
    return `// ${name}
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.navbar')
  const toggle = document.querySelector('[data-menu-toggle]')

  toggle?.addEventListener('click', () => {
    nav?.classList.toggle('is-open')
  })
})`
  }

  if (filePath.endsWith('.json')) {
    return `{
  "name": "${kind === 'react' ? 'generated-app' : 'store-site'}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}`
  }

  if (/\.(jpg|jpeg|png|avif|svg|webp)$/i.test(filePath)) {
    return `# Binary asset — ${name}
width: 1920
height: 1080
format: ${name.split('.').pop()}
optimized: true`
  }

  return `# ${filePath}
generated: true
template: ${kind}`
}

interface FileWriterPanelProps {
  prompt: string
  active: boolean
  flush?: boolean
  onFinish?: () => void
}

export function FileWriterPanel({ prompt, active, flush, onFinish }: FileWriterPanelProps) {
  const [lines, setLines] = useState<FileLine[]>([])
  const [activePath, setActivePath] = useState('')
  const [typedContent, setTypedContent] = useState('')
  const indexRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const charIndexRef = useRef(0)
  const fullSnippetRef = useRef('')
  const finishedRef = useRef(false)
  const kind = guessTemplateKind(prompt)

  useEffect(() => {
    if (!active) {
      setLines([])
      setActivePath('')
      setTypedContent('')
      indexRef.current = 0
      charIndexRef.current = 0
      fullSnippetRef.current = ''
      finishedRef.current = false
      return
    }

    const first = nextFilePath(prompt, 0)
    fullSnippetRef.current = snippetForPath(first, kind)
    charIndexRef.current = 0
    setActivePath(first)
    setTypedContent('')
    setLines([{ id: '0', path: first, status: 'writing' }])
    indexRef.current = 1

    const tick = () => {
      setLines(prev => {
        const nextIndex = indexRef.current
        const path = nextFilePath(prompt, nextIndex)
        indexRef.current += 1

        fullSnippetRef.current = snippetForPath(path, kind)
        charIndexRef.current = 0
        setActivePath(path)
        setTypedContent('')

        const updated = prev.map(line =>
          line.status === 'writing' ? { ...line, status: 'done' as const } : line,
        )

        return [
          ...updated,
          { id: String(nextIndex), path, status: 'writing' as const },
        ]
      })
    }

    const interval = window.setInterval(tick, 42)
    return () => window.clearInterval(interval)
  }, [active, prompt, kind])

  useEffect(() => {
    if (!active || !activePath) return

    const typeTick = () => {
      const full = fullSnippetRef.current
      if (charIndexRef.current >= full.length) return

      const chunk = Math.min(3 + Math.floor(Math.random() * 4), full.length - charIndexRef.current)
      charIndexRef.current += chunk
      setTypedContent(full.slice(0, charIndexRef.current))
    }

    const interval = window.setInterval(typeTick, 12)
    return () => window.clearInterval(interval)
  }, [active, activePath])

  useEffect(() => {
    if (!flush || finishedRef.current) return

    setLines(prev => prev.map(line => ({ ...line, status: 'done' })))

    const full = fullSnippetRef.current
    if (full) {
      charIndexRef.current = full.length
      setTypedContent(full)
    }

    finishedRef.current = true
    const timer = window.setTimeout(() => onFinish?.(), 350)
    return () => window.clearTimeout(timer)
  }, [flush, onFinish])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  const doneCount = lines.filter(l => l.status === 'done').length
  const kindLabel =
    kind === 'electronic' ? 'electronic store' : kind === 'furniture' ? 'furniture store' : 'react app'
  const optimizationSignal = Math.min(99, typedContent.length)
  const currentStep = activePath
    ? activePath.replace(/^src\//, '').replace(/^assets\//, '').replace(/^css\//, 'style/')
    : 'warming up'
  const progress = Math.min(96, Math.max(12, Math.round((doneCount / 18) * 100)))
  const milestones = [
    { label: 'Choosing template', done: doneCount > 1 },
    { label: 'Applying your brand', done: doneCount > 4 },
    { label: 'Arranging mobile sections', done: doneCount > 8 },
    { label: 'Preparing live preview', done: flush || doneCount > 12 },
  ]

  return (
    <div className="live-simulation mx-auto flex h-full w-full max-w-3xl flex-col gap-4 px-4 py-4">
      <div className="shrink-0">
        <p className="text-[11px] uppercase tracking-widest text-neutral-500">Live build</p>
        <p className="mt-0.5 text-sm text-neutral-200">
          Building a {kindLabel} from your request
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-900">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${flush ? 100 : progress}%` }}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <p className="text-[11px] uppercase tracking-widest text-neutral-600">What is happening</p>
          <div className="mt-3 space-y-2">
            {milestones.map((step, index) => (
              <div key={step.label} className="flex items-center gap-2 text-xs">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    step.done
                      ? 'border-white bg-white text-black'
                      : index === milestones.findIndex((m) => !m.done)
                        ? 'border-amber-300 text-amber-200'
                        : 'border-neutral-800 text-neutral-700'
                  }`}
                >
                  {step.done ? '✓' : index + 1}
                </span>
                <span className={step.done ? 'text-neutral-300' : 'text-neutral-500'}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <div
            ref={listRef}
            className="file-writer-list mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-neutral-900 bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-neutral-600"
          >
            {lines.slice(-10).map(line => (
              <div
                key={line.id}
                className={`file-line flex items-center gap-2 py-1 ${
                  line.status === 'writing' ? 'text-neutral-200' : 'text-neutral-600'
                }`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                <span className="min-w-0 truncate">{line.path}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="simulation-phone flex min-h-[260px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-neutral-700 bg-neutral-950 p-2 shadow-2xl md:min-h-0">
          <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-neutral-700" />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-white text-black">
            <div className="h-28 shrink-0 bg-gradient-to-br from-neutral-950 via-neutral-800 to-neutral-500 p-4 text-white">
              <div className="h-2 w-20 rounded bg-white/40" />
              <div className="mt-6 h-4 w-40 rounded bg-white/80" />
              <div className="mt-2 h-2 w-28 rounded bg-white/40" />
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl border border-neutral-200 p-2">
                  <div className="h-14 rounded-lg bg-neutral-100" />
                  <div className="mt-2 h-2 w-16 rounded bg-neutral-300" />
                  <div className="mt-1 h-2 w-10 rounded bg-neutral-200" />
                </div>
              ))}
            </div>
            <div className="mt-auto border-t border-neutral-100 p-3">
              <p className="truncate text-[10px] uppercase tracking-widest text-neutral-400">
                Now updating · {optimizationSignal}% tuned
              </p>
              <p className="mt-1 truncate text-xs font-medium text-neutral-700">{currentStep}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
