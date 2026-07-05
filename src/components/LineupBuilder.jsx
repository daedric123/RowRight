import { useState, Fragment } from 'react';
import { supabase } from '../lib/supabase';

const ALLOWED_TYPES = ['regatta', 'practice'];

// ── seat definitions ──────────────────────────────────────────
const BOAT_SEATS = {
  '8+': ['Stroke', '7', '6', '5', '4', '3', '2', 'Bow', 'Cox'],
  '4+': ['Stroke', '3', '2', 'Bow', 'Cox'],
  '4-': ['Stroke', '3', '2', 'Bow'],
  '2x': ['Stroke', 'Bow'],
  '1x': ['Sculler'],
};

const BOAT_TYPES = Object.keys(BOAT_SEATS);

const displayName = (m) =>
  m?.full_name || m?.display_name || (m?.user_id ? `…${m.user_id.slice(-8)}` : '?');

// ── component ─────────────────────────────────────────────────
const LineupBuilder = ({
  teamId,
  userId,
  members = [],
  boats = [],
  initialLineup = null,
  onSaved,
}) => {
  const [name,            setName]            = useState(initialLineup?.name ?? '');
  const [type,            setType]            = useState(initialLineup?.type ?? 'regatta');
  const [eventName,       setEventName]       = useState(initialLineup?.event_name ?? '');
  const [eventDate,       setEventDate]       = useState(initialLineup?.event_date ?? '');
  const [boatId,          setBoatId]          = useState(
    initialLineup?.lineup_data?.boatId ?? ''
  );
  const [boatType,        setBoatType]        = useState(
    initialLineup?.lineup_data?.boatType ?? '8+'
  );
  const [commentsEnabled, setCommentsEnabled] = useState(
    initialLineup?.comments_enabled ?? false
  );
  const [seats,           setSeats]           = useState(
    () => initialLineup?.lineup_data?.seats ?? {}
  );

  const [draggedMember,  setDraggedMember]  = useState(null);
  const [dragOverSeat,   setDragOverSeat]   = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState(null);
  const [saveSuccess,    setSaveSuccess]    = useState(false);

  // ── derived ────────────────────────────────────────────────
  const seatLabels   = BOAT_SEATS[boatType] ?? [];
  const assignedIds  = Object.values(seats).filter(Boolean);
  const available    = members.filter((m) => !assignedIds.includes(m.user_id));
  const filledCount  = Object.keys(seats).length;

  const getMember = (uid) => members.find((m) => m.user_id === uid);

  // ── seat mutations ─────────────────────────────────────────
  const assignToSeat = (seat, uid) => {
    setSeats((prev) => {
      const next = { ...prev };
      for (const s of Object.keys(next)) {
        if (next[s] === uid) delete next[s];
      }
      next[seat] = uid;
      return next;
    });
  };

  const removeFromSeat = (seat) => {
    setSeats((prev) => { const n = { ...prev }; delete n[seat]; return n; });
  };

  const handleBoatTypeChange = (bt) => { setBoatType(bt); setBoatId(''); setSeats({}); };

  const handleBoatChange = (id) => {
    setBoatId(id);
    if (!id) return;
    const b = boats.find((x) => x.id === id);
    if (b && b.type !== boatType) {
      setBoatType(b.type);
      setSeats({});
    }
  };

  // Only show boats whose type has a defined seat layout
  const eligibleBoats = boats.filter((b) => BOAT_SEATS[b.type]);

  // ── drag handlers ──────────────────────────────────────────
  const handleDragStart = (uid) => {
    setDraggedMember(uid);
    setSelectedMember(null);
  };
  const handleDragEnd = () => {
    setDraggedMember(null);
    setDragOverSeat(null);
  };

  const handleSeatDrop = (e, seat) => {
    e.preventDefault();
    if (!draggedMember) return;
    assignToSeat(seat, draggedMember);
    setDraggedMember(null);
    setDragOverSeat(null);
  };

  const handlePoolDrop = (e) => {
    e.preventDefault();
    if (!draggedMember) return;
    setSeats((prev) => {
      const next = { ...prev };
      for (const s of Object.keys(next)) {
        if (next[s] === draggedMember) delete next[s];
      }
      return next;
    });
    setDraggedMember(null);
  };

  // ── click-to-assign ────────────────────────────────────────
  const handleMemberClick = (uid) =>
    setSelectedMember((prev) => (prev === uid ? null : uid));

  const handleSeatClick = (seat) => {
    if (!selectedMember) return;
    assignToSeat(seat, selectedMember);
    setSelectedMember(null);
  };

  // ── save ──────────────────────────────────────────────────
  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !teamId) return;
    if (trimmedName.length > 100)       { setSaveError('Lineup name must be 100 characters or fewer.'); return; }
    if (!ALLOWED_TYPES.includes(type))  { setSaveError('Invalid lineup type.'); return; }
    if (!BOAT_TYPES.includes(boatType)) { setSaveError('Invalid boat type.'); return; }
    const trimmedEvent = eventName.trim();
    if (trimmedEvent.length > 100)      { setSaveError('Event name must be 100 characters or fewer.'); return; }

    setSaving(true);
    setSaveError(null);

    const payload = {
      team_id: teamId,
      name: trimmedName,
      type,
      event_name: type === 'regatta' ? trimmedEvent || null : null,
      event_date: type === 'regatta' ? eventDate || null : null,
      lineup_data: { boatId: boatId || null, boatType, seats },
      comments_enabled: commentsEnabled,
    };
    if (userId && !initialLineup?.id) payload.created_by = userId;

    const { error } = initialLineup?.id
      ? await supabase.from('lineups').update(payload).eq('id', initialLineup.id)
      : await supabase.from('lineups').insert(payload);

    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSaved?.();
    }
  };

  // ── render ────────────────────────────────────────────────
  return (
    <div className="lineup-builder">

      {/* ══════════ LEFT SIDEBAR ══════════ */}
      <div className="lineup-sidebar">

        {/* Config card */}
        <div className="card">
          <div className="card-head">
            <h3>Lineup details</h3>
            <div className="eyebrow">
              <span className="dot" />{type}
            </div>
          </div>
          <div className="card-body">

            <div className="field">
              <label>Lineup name</label>
              <input
                type="text"
                placeholder="e.g. HORR A-crew"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label>Type</label>
              <div className="watt-toggle" style={{ width: '100%' }}>
                {['regatta', 'practice'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={type === t ? 'active' : ''}
                    onClick={() => setType(t)}
                    style={{ flex: 1, fontFamily: 'var(--sans)', textTransform: 'capitalize' }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {type === 'regatta' && (
              <>
                <div className="field">
                  <label>Event name</label>
                  <input
                    type="text"
                    placeholder="e.g. Head of the River"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    maxLength={100}
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label>Event date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {eligibleBoats.length > 0 && (
              <div className="field">
                <label>Boat</label>
                <select
                  value={boatId}
                  onChange={(e) => handleBoatChange(e.target.value)}
                >
                  <option value="">— None —</option>
                  {eligibleBoats.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                  ))}
                </select>
                <div className="mono" style={{
                  fontSize: 10,
                  color: 'var(--fg-4)',
                  marginTop: 6,
                  letterSpacing: '0.04em',
                }}>
                  Picking a boat sets its type automatically.
                </div>
              </div>
            )}

            <div className="field">
              <label>Boat type</label>
              <select
                value={boatType}
                onChange={(e) => handleBoatTypeChange(e.target.value)}
              >
                {BOAT_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
              {filledCount > 0 && (
                <div className="mono" style={{
                  fontSize: 10,
                  color: 'var(--fg-4)',
                  marginTop: 6,
                  letterSpacing: '0.04em',
                }}>
                  Changing boat type clears all assignments.
                </div>
              )}
            </div>

            {/* Comments toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 20,
              borderBottom: '1px solid var(--line)',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Allow athlete comments</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 3 }}>
                  Visible after publishing
                </div>
              </div>
              <button
                type="button"
                aria-pressed={commentsEnabled}
                onClick={() => setCommentsEnabled((p) => !p)}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  background: commentsEnabled ? 'var(--accent)' : 'var(--bg-3)',
                  border: `1px solid ${commentsEnabled ? 'var(--accent)' : 'var(--line-2)'}`,
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: commentsEnabled ? 20 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--fg)',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {saveError && (
              <div className="mono" style={{
                fontSize: 11,
                color: 'var(--bad)',
                background: 'oklch(0.68 0.20 20 / 0.08)',
                border: '1px solid oklch(0.68 0.20 20 / 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                marginBottom: 14,
                letterSpacing: '0.02em',
              }}>
                {saveError}
              </div>
            )}

            <button
              type="button"
              className={`btn ${saveSuccess ? 'ghost' : 'primary'}`}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: 14,
                opacity: !name.trim() || saving ? 0.5 : 1,
              }}
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? 'Saving…' : saveSuccess ? '✓ Saved' : initialLineup?.id ? 'Update lineup' : 'Save lineup'}
            </button>
          </div>
        </div>

        {/* Roster pool */}
        <div className="card">
          <div className="card-head">
            <h3>Roster</h3>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              {available.length} of {members.length} available
            </div>
          </div>
          <div className="card-body">
            {selectedMember && (
              <div className="mono" style={{
                fontSize: 10,
                color: 'var(--accent)',
                background: 'var(--accent-dim)',
                border: '1px solid oklch(0.72 0.18 25 / 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                marginBottom: 10,
                letterSpacing: '0.06em',
              }}>
                ↗ CLICK A SEAT TO ASSIGN
              </div>
            )}
            <div
              className="boat-pool"
              style={{ flexDirection: 'column', alignItems: 'stretch', minHeight: 72, gap: 6 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handlePoolDrop}
            >
              {available.length === 0 ? (
                <div style={{
                  color: 'var(--fg-4)',
                  fontSize: 12,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: '12px 0',
                  width: '100%',
                }}>
                  {members.length === 0
                    ? 'No active members yet.'
                    : 'All athletes assigned.'}
                </div>
              ) : (
                available.map((m) => (
                  <div
                    key={m.user_id}
                    className={[
                      'bubble',
                      draggedMember === m.user_id  ? 'dragging'        : '',
                      selectedMember === m.user_id ? 'member-selected' : '',
                    ].join(' ')}
                    draggable
                    onDragStart={() => handleDragStart(m.user_id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleMemberClick(m.user_id)}
                    style={{ borderRadius: 'var(--radius-sm)', width: '100%', cursor: 'grab' }}
                  >
                    <span className="tag" style={{
                      background: m.role === 'cox' ? 'var(--fg-3)' : 'var(--accent)',
                    }}>
                      {m.role === 'cox' ? 'COX' : 'ATH'}
                    </span>
                    {displayName(m)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT: BOAT DIAGRAM ══════════ */}
      <div className="lineup-stage">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{boatType} — seat assignments</h3>
              <div className="mono" style={{
                fontSize: 10,
                color: 'var(--fg-4)',
                marginTop: 2,
                letterSpacing: '0.06em',
              }}>
                {filledCount} / {seatLabels.length} FILLED
              </div>
            </div>
            {selectedMember ? (
              <span className="mono" style={{
                fontSize: 10,
                padding: '4px 10px',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid oklch(0.72 0.18 25 / 0.4)',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.06em',
              }}>
                SELECT A SEAT
              </span>
            ) : (
              <div className="eyebrow" style={{ color: 'var(--fg-4)' }}>
                Drag · click to assign
              </div>
            )}
          </div>

          <div className="card-body">
            <div className="lineup-boat">
              <div className="boat-end-label">◀ STERN · STROKE END</div>

              {seatLabels.map((seat) => {
                const isCox        = seat === 'Cox';
                const assignedId   = seats[seat];
                const assignedMbr  = assignedId ? getMember(assignedId) : null;
                const isOver       = dragOverSeat === seat;
                const isClickable  = !!selectedMember && !assignedMbr;

                return (
                  <Fragment key={seat}>
                    {isCox && <div className="lineup-cox-divider" />}
                    <div
                      className={[
                        'cell',
                        'lineup-cell',
                        isCox     ? 'lineup-cell--cox' : '',
                        assignedMbr ? 'filled'          : '',
                        isOver      ? 'drop-hover'       : '',
                      ].filter(Boolean).join(' ')}
                      style={{ cursor: isClickable ? 'pointer' : 'default' }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverSeat(seat); }}
                      onDragLeave={() => setDragOverSeat((cur) => cur === seat ? null : cur)}
                      onDrop={(e) => handleSeatDrop(e, seat)}
                      onClick={() => handleSeatClick(seat)}
                    >
                      <span className="seat-label">{seat}</span>

                      {assignedMbr ? (
                        <div className="seat-occupant">
                          <span
                            className="seat-role-tag"
                            style={{
                              background: assignedMbr.role === 'cox'
                                ? 'var(--fg-3)'
                                : 'var(--accent)',
                            }}
                          >
                            {assignedMbr.role === 'cox' ? 'COX' : 'ATH'}
                          </span>
                          <span
                            className="seat-name"
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleDragStart(assignedId);
                            }}
                            onDragEnd={handleDragEnd}
                          >
                            {displayName(assignedMbr)}
                          </span>
                          <button
                            className="seat-remove"
                            onClick={(e) => { e.stopPropagation(); removeFromSeat(seat); }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span className="seat-empty">
                          {isOver
                            ? 'Drop here'
                            : isClickable
                              ? 'Click to assign'
                              : isCox
                                ? 'Drag coxswain here'
                                : 'Drag athlete here'}
                        </span>
                      )}
                    </div>
                  </Fragment>
                );
              })}

              <div className="boat-end-label">BOW END ▶</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineupBuilder;
