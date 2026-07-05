import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
        <div className="mark">R</div>
        <div>
          <div className="brand-name">RowRight <span>/ Performance</span></div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.1em', marginTop: 2 }}>
            v2.0 · CALIBRATED
          </div>
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div className="card-body" style={{ padding: '48px 32px' }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 12,
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 24px',
            fontSize: 22,
          }}>
            ⏳
          </div>

          <div className="eyebrow" style={{ marginBottom: 12 }}>
            <span className="dot" />Awaiting approval
          </div>

          <h2 style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: 12,
          }}>
            Request sent to your coach
          </h2>

          <p style={{
            fontSize: 13,
            color: 'var(--fg-3)',
            lineHeight: 1.7,
            marginBottom: 32,
          }}>
            Your account has been created and your join request is pending coach approval.
            You'll be able to access team plans and lineups once your coach approves you.
          </p>

          <div style={{
            padding: '12px 16px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 28,
          }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', letterSpacing: '0.06em' }}>
              Ask your coach to open the RowRight dashboard and approve your request under the Roster tab.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link
              to="/app"
              className="btn primary"
              style={{ textDecoration: 'none', justifyContent: 'center', padding: '13px' }}
            >
              Go to app
            </Link>
            <button
              className="btn ghost sm"
              onClick={signOut}
              style={{ justifyContent: 'center' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
