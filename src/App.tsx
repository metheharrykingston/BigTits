import { useState } from 'react'
import './App.css'

interface CreateResponse {
  success: boolean
  stage?: string
  prompt?: string
  intent?: {
    message?: string
    [key: string]: unknown
  }
  generate?: Record<string, unknown>
  projectPath?: string
  relativePath?: string
  previewUrl?: string
  previewPort?: number
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

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

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
      // Simulate staged UX while the real call (which does pnpm install into the shared store) runs
      await new Promise(r => setTimeout(r, 220))

      setStatus("Detecting your intention with the Python Core...")

      const res = await fetch(`${API_URL}/api/create`, {
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
    } catch {
      setError(
        "Could not connect to the generator. Please make sure the backend services are running."
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

  const selectExample = (example: string) => {
    setPrompt(example)
    // Auto-trigger for fast live demos
    setTimeout(() => runDemo(example), 60)
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
            Tell us what you want to build in plain English.<br />
            We'll generate a complete, ready-to-edit project with a live preview you can play with instantly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="prompt-area">
          <label className="prompt-label">Describe your project</label>

          <textarea
            className="prompt-box"
            placeholder="A modern website for my cafe with menu, hours, and online ordering..."
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
                onClick={() => selectExample(ex)}
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
              <>Building your project…</>
            ) : (
              "Generate Project →"
            )}
          </button>
        </form>

        {/* Clean, user-friendly loading */}
        {(isLoading || status) && (
          <div className="status">
            {isLoading && <div className="step"><span className="spinner" /> {status || "Working..."}</div>}
            {!isLoading && status && <div>{status}</div>}
          </div>
        )}

        {/* Friendly error — no scary internals */}
        {error && (
          <div className="error-box">
            <strong>Something went wrong.</strong>
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>
              The generator services may not be running right now.
              Try the <strong>"Start Live Preview Now"</strong> button on a previous result, or refresh and try again.
            </p>
          </div>
        )}

        {/* Clean, friendly success view — hide internals, focus on the preview */}
        {result && result.success && result.projectPath && (
          <div className="result success">
            <h3>Your project is ready!</h3>

            {result.previewUrl ? (
              <div className="preview-section">
                <div className="preview-heading">
                  <strong>Live Preview</strong>
                  <div className="preview-description">
                    Play with it below — edits will hot-reload automatically.
                  </div>
                </div>

                <div className="preview-actions">
                  <button
                    onClick={() => window.open(result.previewUrl, '_blank')}
                    className="action-btn action-btn-primary"
                  >
                    Open in new tab ↗
                  </button>
                  <button
                    onClick={async () => {
                      if (!result.projectPath) return;
                      await fetch(`${API_URL}/api/preview/stop`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectPath: result.projectPath }),
                      });
                      // Refresh state so user sees the start button again
                      setResult({ ...result, previewUrl: undefined });
                    }}
                    className="action-btn action-btn-secondary"
                  >
                    Stop preview server
                  </button>
                </div>

                {/* The live preview is the main thing the user cares about */}
                <iframe
                  src={result.previewUrl}
                  className="preview-frame"
                  title="Live project preview"
                />
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#854d0e', marginBottom: 8 }}>
                  Preview not ready yet.
                </div>
                <button
                  onClick={async () => {
                    if (!result.projectPath) return;
                    const res = await fetch(`${API_URL}/api/preview/start`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectPath: result.projectPath }),
                    });
                    const data = await res.json();
                    if (data.success && data.previewUrl) {
                      setResult({ ...result, previewUrl: data.previewUrl, previewPort: data.port });
                    } else {
                      alert('Could not start preview. The backend services might need attention.');
                    }
                  }}
                  className="action-btn action-btn-primary"
                >
                  Launch Live Preview
                </button>
              </div>
            )}

            {/* Gentle, non-technical info about the project */}
            <div className="project-note">
              Your project was generated and is saved on disk.
              You can keep editing the files locally anytime.
            </div>

            {/* Hidden the raw path, template details, pnpm notes, internal flow text */}

            <button
              onClick={reset}
              className="reset-btn"
            >
              Build another project
            </button>
          </div>
        )}

        <div className="footer-note">
          Instant AI-generated projects with live preview
        </div>
      </div>

      {/* Keep a minimal version of the old footer area for visual continuity if desired */}
      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
