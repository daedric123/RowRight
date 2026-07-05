import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import LineupBuilder from '../components/LineupBuilder';

const LineupEditPage = () => {
  const { id } = useParams();           // undefined on /lineups/new
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [team,          setTeam]          = useState(null);
  const [members,       setMembers]       = useState([]);
  const [boats,         setBoats]         = useState([]);
  const [initialLineup, setInitialLineup] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);

  if (role !== null && role !== 'Coach') {
    return <Navigate to="/app" replace />;
  }

  useEffect(() => {
    if (!user || role === null) return;
    let cancelled = false;

    const load = async () => {
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('coach_id', user.id)
        .maybeSingle();

      if (cancelled || !teamData) { setLoading(false); return; }
      setTeam(teamData);

      const membersPromise = supabase
        .from('team_members')
        .select('id, user_id, role, full_name')
        .eq('team_id', teamData.id)
        .eq('status', 'active');

      const boatsPromise = supabase
        .from('boats')
        .select('*')
        .eq('team_id', teamData.id)
        .order('created_at', { ascending: true });

      const lineupPromise = id
        ? supabase
            .from('lineups')
            .select('*')
            .eq('id', id)
            .eq('team_id', teamData.id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const [membersRes, boatsRes, lineupRes] = await Promise.all([membersPromise, boatsPromise, lineupPromise]);

      if (cancelled) return;

      if (id && !lineupRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const memberRows = membersRes.data || [];
      const userIds = memberRows.map((r) => r.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] };

      if (cancelled) return;

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      const mergedMembers = memberRows.map((r) => ({
        ...r,
        full_name: profileMap[r.user_id]?.full_name || r.full_name || null,
      }));

      setMembers(mergedMembers);
      setBoats(boatsRes.data || []);
      setInitialLineup(lineupRes.data);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, role, id]);

  if (loading || role === null) {
    return (
      <div className="shell" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.12em' }}>
          LOADING…
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="shell" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ color: 'var(--fg-3)', fontSize: 14, marginBottom: 16 }}>
          Lineup not found.
        </div>
        <Link to="/dashboard?tab=lineups" className="btn ghost">← Dashboard</Link>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="shell" style={{ paddingTop: 80, textAlign: 'center' }}>
        <div style={{ color: 'var(--fg-3)', fontSize: 14, marginBottom: 16 }}>
          You don't have a team yet.
        </div>
        <Link to="/create-team" className="btn primary">Create a team</Link>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <div className="brand-name">
              RowRight <span>/ {id ? 'Edit Lineup' : 'New Lineup'}</span>
            </div>
            <div className="mono" style={{
              fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.1em', marginTop: 2,
            }}>
              {team.name}
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <Link
            to="/dashboard?tab=lineups"
            style={{ color: 'var(--fg-3)', fontSize: 12, textDecoration: 'none' }}
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <LineupBuilder
        teamId={team.id}
        userId={user.id}
        members={members}
        boats={boats}
        initialLineup={initialLineup}
        onSaved={() => navigate('/dashboard?tab=lineups')}
      />
    </div>
  );
};

export default LineupEditPage;
