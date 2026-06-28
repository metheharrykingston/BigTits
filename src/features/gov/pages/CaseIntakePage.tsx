import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { VoiceMicButton } from '../components/VoiceMicButton';
import { SpeakButton } from '../components/SpeakButton';

export function CaseIntakePage() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const created = await api.createCase({ intent });
      navigate(`/gov/cases/${created.case_id}/documents`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2>What do you want to do?</h2>
      <p className="muted">बोलिए या लिखिए — income certificate, learner licence, आदि</p>
      <div className="voice-row">
        <VoiceMicButton
          onTranscript={(text) => setIntent((prev) => (prev ? `${prev} ${text}` : text))}
          onError={setError}
        />
        <SpeakButton text="Kya chahiye? Income certificate, learner licence, ya kuch aur? Boliye ya likhiye." />
      </div>
      <label className="field">
        <span>Describe your goal (optional if you spoke)</span>
        <textarea
          rows={4}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="मैं income certificate चाहता हूँ…"
        />
      </label>
      {error ? <div className="error">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={loading || !intent.trim()}>
        {loading ? 'Creating case…' : 'Continue'}
      </button>
    </form>
  );
}