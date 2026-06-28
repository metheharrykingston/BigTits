import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { PortalWorkspace } from '../plugins/portal-workspace';
import type { AutomationBundle, CaseResponse } from '@shared';

export function PortalStartPage() {
  const { caseId = '' } = useParams();
  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [bundle, setBundle] = useState<AutomationBundle | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fillResult, setFillResult] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCase(caseId).then(setCaseData).catch((e) => setError(String(e)));
  }, [caseId]);

  useEffect(() => {
    const sub = PortalWorkspace.addListener('portalEvent', (event) => {
      void api.postAuditEvent(event);
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, []);

  async function openPortal() {
    setLoading(true);
    setError('');
    try {
      const created = await api.createBundle(caseId);
      setBundle(created);
      const opened = await PortalWorkspace.open({ bundle: created });
      setSessionId(opened.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open portal');
    } finally {
      setLoading(false);
    }
  }

  async function fillPage() {
    setError('');
    try {
      const result = await PortalWorkspace.fillCurrentPage();
      setFillResult(
        result.paused
          ? result.message ?? 'Paused at sensitive step — complete it manually.'
          : `Filled ${result.filled} fields (${result.failed} failed)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fill failed');
    }
  }

  if (!caseData) return <div className="card">{error || 'Loading…'}</div>;

  return (
    <div className="stack">
      <section className="card">
        <h2>Portal Workspace</h2>
        <p>{caseData.requirements.display_name}</p>
        <p className="muted">Official URL: {caseData.requirements.official_url}</p>
        <div className="disclaimer">
          Opens the <strong>official portal visibly</strong> inside the app. We never enter OTP,
          CAPTCHA, passwords, declarations, payments, or final submit.
        </div>
      </section>

      <section className="card stack">
        <button className="btn btn-primary" onClick={openPortal} disabled={loading}>
          {loading ? 'Preparing…' : 'Open official portal'}
        </button>
        <button className="btn btn-secondary" onClick={fillPage} disabled={!sessionId}>
          Fill this page
        </button>
        {bundle ? (
          <p className="muted">
            Bundle <code>{bundle.bundle_id}</code> expires {new Date(bundle.expires_at).toLocaleString()}
          </p>
        ) : null}
        {fillResult ? <p>{fillResult}</p> : null}
        {error ? <div className="error">{error}</div> : null}
      </section>
    </div>
  );
}