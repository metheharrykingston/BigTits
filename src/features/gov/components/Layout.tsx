import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="card" style={{ marginBottom: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Gov Copilot</strong>
            <div className="muted">Portal Workspace — not a government website</div>
          </div>
          <Link to="/" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            BigTits
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}