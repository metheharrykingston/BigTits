import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="stack">
      <section className="card">
        <h2>Government form copilot</h2>
        <p>
          We help you prepare documents, understand requirements, and fill official
          government portals step by step inside a visible workspace.
        </p>
        <div className="disclaimer">
          We are <strong>not</strong> a government website. You verify all information and
          complete OTP, CAPTCHA, declarations, payments, and final submit yourself.
        </div>
      </section>

      <section className="card">
        <h3>Start</h3>
        <p className="muted">MVP target: e-District Delhi Income Certificate</p>
        <Link to="/gov/intake" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Tell us what you need
        </Link>
      </section>
    </div>
  );
}