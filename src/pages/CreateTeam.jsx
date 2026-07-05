import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/O/0/1

const generateCode = () =>
  Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

const CreateTeam = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [code, setCode] = useState(generateCode);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Redirect if coach already has a team
  useEffect(() => {
    if (!user) return;
    supabase
      .from('teams')
      .select('id')
      .eq('coach_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) navigate('/dashboard', { replace: true });
        else setChecking(false);
      });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = teamName.trim();
    if (!trimmed) return;
    if (trimmed.length > 100) { setError('Team name must be 100 characters or fewer.'); return; }
    setError(null);
    setLoading(true);

    const { error: insertError } = await supabase
      .from('teams')
      .insert({ name: trimmed, code, coach_id: user.id });

    if (insertError) {
      // Unique violation on code → regenerate and ask to retry
      if (insertError.code === '23505') {
        setCode(generateCode());
        setError('Code collision — a fresh code was generated. Try again.');
      } else {
        setError(insertError.message);
      }
      setLoading(false);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  if (checking) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
        <div className="mark">R</div>
        <div>
          <div className="brand-name">RowRight <span>/ Performance</span></div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.1em', marginTop: 2 }}>
            v2.0 · CALIBRATED
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="card" style={{ width: '100%', maxWidth: 440 }}>
        <div className="card-head">
          <h3>Create your team</h3>
          <div className="eyebrow"><span className="dot" />Coach setup</div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>

            {/* Team name */}
            <div className="field">
              <label>Team name</label>
              <input
                type="text"
                placeholder="e.g. Cambridge RC"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={100}
                required
                autoFocus
                autoComplete="off"
              />
            </div>

            {/* Code preview + regenerate */}
            <div className="field">
              <label>Team code</label>
              <div style={{
                display: 'flex',
                gap: 10,
                alignItems: 'stretch',
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span className="mono" style={{
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    color: 'var(--accent)',
                  }}>
                    {code}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setCode(generateCode())}
                  title="Generate a new code"
                  style={{ flexShrink: 0 }}
                >
                  ↻
                </button>
              </div>
              <div className="mono" style={{
                fontSize: 10,
                color: 'var(--fg-4)',
                marginTop: 8,
                letterSpacing: '0.06em',
                lineHeight: 1.6,
              }}>
                Share this code with athletes and coxes so they can join your team.
                You can regenerate it if you'd like a different one.
              </div>
            </div>

            {error && (
              <div className="mono" style={{
                fontSize: 11,
                color: 'var(--bad)',
                background: 'oklch(0.68 0.20 20 / 0.08)',
                border: '1px solid oklch(0.68 0.20 20 / 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                marginBottom: 16,
                letterSpacing: '0.02em',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn primary"
              disabled={loading || !teamName.trim()}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: 14,
                opacity: loading || !teamName.trim() ? 0.5 : 1,
              }}
            >
              {loading ? 'Creating…' : 'Create team'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTeam;
