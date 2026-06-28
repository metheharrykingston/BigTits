import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { CaseResponse } from '@shared';

export function DocumentsPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    api.getCase(caseId).then(setCaseData).catch((e) => setError(String(e)));
  }, [caseId]);

  async function onUpload(documentKey: string, file: File | undefined) {
    if (!file) return;
    setUploading(documentKey);
    setError('');
    try {
      const updated = await api.uploadDocument(caseId, documentKey, file);
      setCaseData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  if (!caseData) {
    return <div className="card">{error || 'Loading case…'}</div>;
  }

  const uploadedKeys = new Set(caseData.documents.map((d) => d.document_key));
  const allUploaded = caseData.requirements.required_documents.every((k) => uploadedKeys.has(k));

  return (
    <div className="stack">
      <section className="card">
        <h2>Upload documents</h2>
        <p className="muted">{caseData.requirements.display_name}</p>
        <p>Case: <code>{caseData.case_id}</code></p>
      </section>

      {caseData.requirements.required_documents.map((docKey) => (
        <section className="card" key={docKey}>
          <h3>{docKey.replaceAll('_', ' ')}</h3>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => onUpload(docKey, e.target.files?.[0])}
          />
          {uploading === docKey ? <div className="muted">Uploading…</div> : null}
          {uploadedKeys.has(docKey) ? <div className="muted">Uploaded ✓</div> : null}
        </section>
      ))}

      {error ? <div className="error">{error}</div> : null}

      <div className="row">
        <button
          className="btn btn-primary"
          disabled={!allUploaded || extracting}
          onClick={async () => {
            setExtracting(true);
            setError('');
            try {
              await api.extractAll(caseId);
              navigate(`/gov/cases/${caseId}/profile`);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Extraction failed — start RunPod tunnel and retry',
              );
            } finally {
              setExtracting(false);
            }
          }}
        >
          {extracting ? 'Extracting with Qwen…' : 'Extract & preview profile'}
        </button>
        <Link className="btn btn-secondary" to="/gov" style={{ textDecoration: 'none' }}>
          Home
        </Link>
      </div>
    </div>
  );
}