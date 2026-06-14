import { useState } from 'react'
import './App.css'

interface CreateResponse {
  success: boolean
  stage?: string
  prompt?: string
  intent?: any
  generate?: any
  projectPath?: string
  relativePath?: string
  nextSteps?: string[]
  error?: string
}

const EXAMPLE_PROMPTS = [
  "Create a website for my cafe",
  "Build a modern landing page for a SaaS product",
  "Make a personal portfolio website",
  "A simple React dashboard",
  "Website for a local bakery",
]

function App() {
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [result, setResult] = useState<CreateResponse | null>(null)
  const [error, setError] = useState("")

  const runDemo = async (finalPrompt: string) => {
    if (!finalPrompt.trim() || isLoading) return

    setIsLoading(true)
    setError("")
    setResult(null)
    setStatus("Connecting to Node API...")

    try {
      // Simulate staged UX while the real call (which does npm install) runs
      await new Promise(r => setTimeout(r, 220))

      setStatus("Detecting your intention with the Python Core...")

      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt.trim() }),
      })

      const data: CreateResponse = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || data.intent?.message || 'Generation failed. Is the Python Core running?')
        setStatus("")
        return
      }

      setStatus("Project ready! Files copied + dependencies installed.")
      setResult(data)

      // Clear the input for quick follow-up generations
      setPrompt("")
    } catch (e: any) {
      setError(
        "Could not reach the Node.js API. Make sure it's running on port 3001 (npm run dev inside api/)."
      )
    } finally {
      setIsLoading(false)
      setStatus("")
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    runDemo(prompt)
  }

  const useExample = (example: string) => {
    setPrompt(example)
    // Auto-trigger for fast live demos
    setTimeout(() => runDemo(example), 60)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      const orig = status
      setStatus("Copied to clipboard!")
      setTimeout(() => setStatus(orig || ""), 1400)
    })
  }

  const reset = () => {
    setResult(null)
    setError("")
    setPrompt("")
    setStatus("")
  }

  return (
    <>
      <div className="generator">
        <div className="generator-header">
          <h1>BigTits</h1>
          <p>
            Tell us what you want. The system will understand your intention,
            pick a template, generate a real project, and install everything.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="prompt-area">
          <label className="prompt-label">What do you want to build?</label>

          <textarea
            className="prompt-box"
            placeholder="Create a beautiful website for my cafe with a menu and contact form..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            rows={3}
          />

          <div className="examples">
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                type="button"
                className="example-chip"
                onClick={() => useExample(ex)}
                disabled={isLoading}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="generate-btn"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>Generating your project… (may take 30–60s for install)</>
            ) : (
              "Generate Real Project →"
            )}
          </button>
        </form>

        {/* Live status while the full pipeline (Node → Core → copy + npm install) runs */}
        {(isLoading || status) && (
          <div className="status">
            {isLoading && <div className="step"><span className="spinner" /> {status || "Working..."}</div>}
            {!isLoading && status && <div>{status}</div>}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              Quick checklist:<br />
              1. Start Python Core: <code>cd core && source venv/bin/activate && python main.py</code><br />
              2. Start this API: <code>cd api && npm run dev</code><br />
              3. Refresh this page and try again.
            </div>
          </div>
        )}

        {/* Success result — real generated project on disk */}
        {result && result.success && result.projectPath && (
          <div className="result success">
            <h3>✅ Project generated successfully</h3>

            <div>
              <strong>Project path (absolute — ready to use):</strong>
              <div className="path">
                <span>{result.projectPath}</span>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(result.projectPath!)}
                >
                  Copy
                </button>
              </div>
            </div>

            {result.intent && (
              <div style={{ margin: '12px 0', fontSize: 14 }}>
                <strong>Detected template:</strong> <code>{result.intent.template_slug}</code>
                {result.intent.confidence !== undefined && (
                  <> &nbsp;· confidence {result.intent.confidence}</>
                )}
              </div>
            )}

            <div className="next-steps">
              <strong>Next steps (copy &amp; run in your terminal):</strong>
              {result.nextSteps && result.nextSteps.length > 0 ? (
                result.nextSteps.map((step, idx) => (
                  <code key={idx} onClick={() => copyToClipboard(step)} style={{ cursor: 'pointer' }}>
                    {step}
                  </code>
                ))
              ) : (
                <>
                  <code>cd {result.projectPath}</code>
                  <code>npm run dev</code>
                </>
              )}
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text)' }}>
                The project was fully set up (npm install already ran during generation).
              </div>
            </div>

            <button
              onClick={reset}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Generate another project
            </button>
          </div>
        )}

        <div style={{ marginTop: 48, fontSize: 13, color: 'var(--text)', textAlign: 'center' }}>
          Full flow: React → Node.js API (this proxy) → Python Core (intention + generator + executor)
        </div>
      </div>

      {/* Keep a minimal version of the old footer area for visual continuity if desired */}
      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
