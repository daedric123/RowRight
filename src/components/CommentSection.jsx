import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CommentSection = ({ lineupId, user, role }) => {
  const [comments,    setComments]    = useState([]);
  const [nameMap,     setNameMap]     = useState({});
  const [loading,     setLoading]     = useState(true);
  const [draft,       setDraft]       = useState('');
  const [posting,     setPosting]     = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: rows } = await supabase
        .from('lineup_comments')
        .select('*')
        .eq('lineup_id', lineupId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      const commentRows = rows || [];
      const uids = [...new Set(commentRows.map((c) => c.user_id))];
      const { data: profiles } = uids.length
        ? await supabase.from('profiles').select('id, full_name').in('id', uids)
        : { data: [] };

      if (cancelled) return;

      const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
      setNameMap(map);
      setComments(commentRows);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [lineupId]);

  const postComment = async () => {
    if (!draft.trim() || !user || posting) return;
    if (draft.length > 1000) return;
    setPosting(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('lineup_comments')
      .insert({ lineup_id: lineupId, user_id: user.id, body: draft.trim() })
      .select()
      .single();
    if (err) {
      setError(err.message);
    } else {
      setComments((prev) => [...prev, data]);
      setNameMap((prev) => ({
        ...prev,
        [user.id]: user.user_metadata?.full_name || prev[user.id] || null,
      }));
      setDraft('');
    }
    setPosting(false);
  };

  const displayAuthor = (c) =>
    nameMap[c.user_id] || `…${c.user_id.slice(-8)}`;

  const canComment = user && role !== 'Coach';

  if (loading) return (
    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.1em' }}>
      LOADING COMMENTS…
    </div>
  );

  return (
    <div>
      {comments.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>
          No comments yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.map((c) => (
            <div key={c.id} style={{
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div className="mono" style={{
                fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.06em', marginBottom: 5,
              }}>
                {displayAuthor(c)}
                {' · '}
                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                {c.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {canComment && (
        <div style={{ marginTop: 12 }}>
          {error && (
            <div className="mono" style={{
              fontSize: 10, color: 'var(--bad)', marginBottom: 8, letterSpacing: '0.04em',
            }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }
              }}
              placeholder="Add a comment…"
              maxLength={1000}
              disabled={posting}
              style={{
                flex: 1,
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: 13,
                color: 'var(--fg)',
                transition: 'border 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e)  => { e.target.style.borderColor = 'var(--line)'; }}
            />
            <button
              className="btn primary sm"
              onClick={postComment}
              disabled={!draft.trim() || posting}
              style={{ opacity: !draft.trim() || posting ? 0.5 : 1, flexShrink: 0 }}
            >
              {posting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentSection;
