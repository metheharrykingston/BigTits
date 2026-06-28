import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { CaseProfile, CaseResponse } from '@shared';
import { SpeakButton } from '../components/SpeakButton';
import { VoiceMicButton } from '../components/VoiceMicButton';
import { profileSummaryForSpeech } from '../voice/voiceService';

export function ProfilePage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [profile, setProfile] = useState<CaseProfile>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getCase(caseId)
      .then((data) => {
        setCaseData(data);
        setProfile(data.profile ?? {});
      })
      .catch((e) => setError(String(e)));
  }, [caseId]);

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      await api.confirmProfile(caseId, { profile });
      navigate(`/gov/cases/${caseId}/portal`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setLoading(false);
    }
  }

  const speechSummary = useMemo(() => {
    if (!caseData) return '';
    return profileSummaryForSpeech(profile, caseData.requirements.required_fields);
  }, [caseData, profile]);

  if (!caseData) return <div className="card">{error || 'Loading…'}</div>;

  return (
    <div className="stack">
      <section className="card">
        <h2>Confirm your details</h2>
        <p className="muted">
          Documents se nikali gayi jaankari — suniye, phir confirm kijiye. Type karna zaroori nahi.
        </p>
        <div className="voice-row">
          <SpeakButton text={speechSummary} label="Meri jaankari suniye" />
          <VoiceMicButton
            label="Sahi hai / theek karein"
            onTranscript={(text) => {
              const lower = text.toLowerCase();
              if (/\b(haan|sahi|theek|yes|ok|correct)\b/.test(lower)) return;
              setError('Agar kuch galat ho to field mein bol kar theek kar sakte hain, ya type karein.');
            }}
            onError={setError}
          />
        </div>
      </section>

      {(caseData.requirements.required_fields.length
        ? caseData.requirements.required_fields
        : Object.keys(profile)
      ).map((key) => (
        <label className="field card" key={key}>
          <span>{key.replaceAll('_', ' ')}</span>
          <input
            value={profile[key] ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
          />
        </label>
      ))}

      {error ? <div className="error">{error}</div> : null}

      <button className="btn btn-primary" onClick={confirm} disabled={loading}>
        {loading ? 'Saving…' : 'Confirm and continue'}
      </button>
    </div>
  );
}