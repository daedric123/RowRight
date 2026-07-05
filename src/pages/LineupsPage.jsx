import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import TrailerLoader from '../components/TrailerLoader';
import CommentSection from '../components/CommentSection';
import SeatGrid from '../components/SeatGrid';

const BOAT_SEATS = {
  '8+': ['Stroke', '7', '6', '5', '4', '3', '2', 'Bow', 'Cox'],
  '4+': ['Stroke', '3', '2', 'Bow', 'Cox'],
  '4-': ['Stroke', '3', '2', 'Bow'],
  '2x': ['Stroke', 'Bow'],
  '1x': ['Sculler'],
};

const parseLayoutData = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

// ── LineupCard ────────────────────────────────────────────────
const LineupCard = ({
  lineup, members, loadProfiles, boats = [], user, role, onPublishToggle,
}) => {
  const isCoach = role === 'Coach';
  const [toggling,     setToggling]     = useState(false);
  const [showTrailer,  setShowTrailer]  = useState(false);

  const boatType    = lineup.lineup_data?.boatType ?? '8+';
  const boatId      = lineup.lineup_data?.boatId ?? null;
  const seats       = lineup.lineup_data?.seats    ?? {};
  const labels      = BOAT_SEATS[boatType] ?? [];
  const filledCount = Object.keys(seats).length;
  const boatName    = boatId ? boats.find((b) => b.id === boatId)?.name : null;

  // Find a published load profile whose created_at date matches the event date.
  // This is the best approximation without an event_date column on load_profiles.
  const matchingProfile = lineup.event_date
    ? loadProfiles.find((p) =>
        new Date(p.created_at).toISOString().slice(0, 10) === lineup.event_date
      )
    : null;

  const handlePublishToggle = async () => {
    setToggling(true);
    await onPublishToggle(lineup);
    setToggling(false);
  };

  return (
    <div className="card">

      {/* ── header ── */}
      <div className="card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            {!lineup.published && (
              <span className="mono" style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: 3,
                background: 'var(--bg-3)',
                color: 'var(--fg-4)',
                letterSpacing: '0.1em',
                flexShrink: 0,
              }}>
                DRAFT
              </span>
            )}
            <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {lineup.name}
            </h3>
          </div>
          <div className="mono" style={{
            fontSize: 10,
            color: 'var(--fg-4)',
            letterSpacing: '0.06em',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <span>{boatName ? `${boatName} · ${boatType.toUpperCase()}` : boatType.toUpperCase()}</span>
            {lineup.event_name && <><span style={{ color: 'var(--line-2)' }}>·</span><span>{lineup.event_name}</span></>}
            {lineup.event_date && <><span style={{ color: 'var(--line-2)' }}>·</span><span>{fmtDate(lineup.event_date)}</span></>}
            <span style={{ color: 'var(--line-2)' }}>·</span>
            <span style={{ color: filledCount === labels.length ? 'var(--good)' : 'var(--fg-4)' }}>
              {filledCount}/{labels.length} filled
            </span>
            {lineup.comments_enabled && (
              <><span style={{ color: 'var(--line-2)' }}>·</span>
              <span style={{ color: 'var(--fg-4)' }}>comments on</span></>
            )}
          </div>
        </div>

        {isCoach && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button
              className={`btn sm ${lineup.published ? 'ghost' : 'primary'}`}
              onClick={handlePublishToggle}
              disabled={toggling}
              style={{ minWidth: 90, opacity: toggling ? 0.6 : 1 }}
            >
              {toggling ? '…' : lineup.published ? 'Unpublish' : 'Publish'}
            </button>
            <Link
              to={`/lineups/${lineup.id}/edit`}
              className="btn ghost sm"
              style={{ textDecoration: 'none' }}
            >
              Edit
            </Link>
          </div>
        )}
      </div>

      {/* ── seat grid ── */}
      <div className="card-body">
        <SeatGrid boatType={boatType} seats={seats} members={members} />
      </div>

      {/* ── comments ── */}
      {lineup.comments_enabled && (
        <div style={{ borderTop: '1px solid var(--line)', padding: 'var(--pad)' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            <span className="dot" /> Comments
          </div>
          <CommentSection lineupId={lineup.id} user={user} role={role} />
        </div>
      )}

      {/* ── matching trailer plan (regattas only) ── */}
      {matchingProfile && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--pad)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setShowTrailer((p) => !p)}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                <span className="dot" /> Trailer plan · {matchingProfile.name}
              </div>
              <div className="mono" style={{
                fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.06em',
              }}>
                Load plan for this regatta date
              </div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              {showTrailer ? '▲ Collapse' : '▼ View plan'}
            </span>
          </div>
          {showTrailer && (
            <div style={{ borderTop: '1px solid var(--line)' }}>
              <TrailerLoader
                readOnly
                boats={parseLayoutData(matchingProfile.layout_data)?.boats || boats}
                initialPlacements={parseLayoutData(matchingProfile.layout_data)?.placements || {}}
                initialRows={parseLayoutData(matchingProfile.layout_data)?.rows || 4}
                initialCols={parseLayoutData(matchingProfile.layout_data)?.cols || 3}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── main page ─────────────────────────────────────────────────
const LineupsPage = () => {
  const { user, role } = useAuth();
  const isCoach = role === 'Coach';

  // Coaches manage lineups from the dashboard — redirect them there.
  if (isCoach) return <Navigate to="/dashboard?tab=lineups" replace />;

  const [tab,          setTab]          = useState('regatta');
  const [team,         setTeam]         = useState(null);
  const [members,      setMembers]      = useState([]);
  const [lineups,      setLineups]      = useState([]);
  const [loadProfiles, setLoadProfiles] = useState([]);
  const [boats,        setBoats]        = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!user || role === null) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let teamData = null;

      if (isCoach) {
        const { data } = await supabase
          .from('teams')
          .select('id, name')
          .eq('coach_id', user.id)
          .maybeSingle();
        teamData = data;
      } else {
        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id, teams(id, name)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        teamData = membership?.teams ?? null;
      }

      if (cancelled || !teamData) { setLoading(false); return; }
      setTeam(teamData);

      const teamId = teamData.id;

      const [membersRes, lineupsRes, profilesRes, boatsRes] = await Promise.all([
        supabase
          .from('team_members')
          .select('id, user_id, role, full_name')
          .eq('team_id', teamId)
          .eq('status', 'active'),
        supabase
          .from('lineups')
          .select('*')
          .eq('team_id', teamId)
          .order('event_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('load_profiles')
          .select('*')
          .eq('team_id', teamId)
          .eq('published', true),
        supabase
          .from('boats')
          .select('*')
          .eq('team_id', teamId)
          .order('created_at', { ascending: true }),
      ]);

      if (!cancelled) {
        const memberRows = membersRes.data || [];
        const userIds = memberRows.map((r) => r.user_id);
        const { data: userProfiles } = userIds.length
          ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
          : { data: [] };

        if (!cancelled) {
          const profileMap = Object.fromEntries((userProfiles ?? []).map((p) => [p.id, p]));
          setMembers(memberRows.map((r) => ({
            ...r,
            full_name: profileMap[r.user_id]?.full_name || r.full_name || null,
          })));
          setLineups(lineupsRes.data     || []);
          setLoadProfiles(profilesRes.data || []);
          setBoats(boatsRes.data || []);
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user, role]);

  const togglePublish = async (lineup) => {
    const next = !lineup.published;
    const { error } = await supabase
      .from('lineups')
      .update({ published: next })
      .eq('id', lineup.id);
    if (!error) {
      setLineups((prev) =>
        prev.map((l) => l.id === lineup.id ? { ...l, published: next } : l)
      );
    }
  };

  // Coaches see all lineups; RLS already filters published-only for athletes
  const regattas  = lineups.filter((l) => l.type === 'regatta');
  const practices = lineups.filter((l) => l.type === 'practice');
  const visible   = tab === 'regatta' ? regattas : practices;

  const tabDef = [
    { id: 'regatta',  label: 'Regattas',  num: '01', count: regattas.length  },
    { id: 'practice', label: 'Practices', num: '02', count: practices.length },
  ];

  // ── loading ──────────────────────────────────────────────────
  if (loading || role === null) {
    return (
      <div className="shell" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.12em' }}>
          LOADING…
        </div>
      </div>
    );
  }

  // ── no team ──────────────────────────────────────────────────
  if (!team) {
    return (
      <div className="shell" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ color: 'var(--fg-3)', fontSize: 14, marginBottom: 16 }}>
          {isCoach ? "You don't have a team yet." : "You're not on a team yet."}
        </div>
        {isCoach && (
          <Link to="/create-team" className="btn primary">Create a team</Link>
        )}
      </div>
    );
  }

  // ── main ─────────────────────────────────────────────────────
  return (
    <div className="shell">

      {/* topbar */}
      <div className="topbar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <div className="brand-name">RowRight <span>/ Lineups</span></div>
            <div className="mono" style={{
              fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.1em', marginTop: 2,
            }}>
              {team.name}
            </div>
          </div>
        </div>
        <div className="topbar-right">
          {isCoach && (
            <Link
              to="/lineups/new"
              className="btn primary sm"
              style={{ textDecoration: 'none' }}
            >
              + New lineup
            </Link>
          )}
          <Link
            to={isCoach ? '/dashboard' : '/app'}
            style={{ color: 'var(--fg-3)', fontSize: 12, textDecoration: 'none' }}
          >
            ← {isCoach ? 'Dashboard' : 'Back'}
          </Link>
        </div>
      </div>

      {/* tabs */}
      <nav className="tabs">
        {tabDef.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="num mono">{t.num}</span>
            {t.label}
            {t.count > 0 && (
              <span className="mono" style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 3,
                background: tab === t.id ? 'var(--accent-dim)' : 'var(--bg-3)',
                color:      tab === t.id ? 'var(--accent)'     : 'var(--fg-4)',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* lineup cards */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-4)', fontSize: 13 }}>
          No {tab} lineups {isCoach ? 'yet.' : 'published yet.'}
          {isCoach && (
            <>
              {' '}
              <Link to="/lineups/new" style={{ color: 'var(--fg-3)' }}>
                Create one.
              </Link>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {visible.map((lineup) => (
            <LineupCard
              key={lineup.id}
              lineup={lineup}
              members={members}
              loadProfiles={tab === 'regatta' ? loadProfiles : []}
              boats={boats}
              user={user}
              role={role}
              onPublishToggle={togglePublish}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LineupsPage;
