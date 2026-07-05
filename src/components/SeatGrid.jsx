import { Fragment } from 'react';

const BOAT_SEATS = {
  '8+': ['Stroke', '7', '6', '5', '4', '3', '2', 'Bow', 'Cox'],
  '4+': ['Stroke', '3', '2', 'Bow', 'Cox'],
  '4-': ['Stroke', '3', '2', 'Bow'],
  '2x': ['Stroke', 'Bow'],
  '1x': ['Sculler'],
};

const displayName = (m) =>
  m?.full_name || m?.display_name || (m?.user_id ? `…${m.user_id.slice(-8)}` : '?');

const SeatGrid = ({ boatType, seats = {}, members = [] }) => {
  const labels = BOAT_SEATS[boatType] ?? [];
  const hasCox = labels.includes('Cox');
  const getMember = (uid) => members.find((m) => m.user_id === uid);
  const filled = Object.keys(seats).length;

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        <span className="dot" />
        {boatType} · {filled}/{labels.length} assigned
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {labels.map((seat) => {
          const isCox    = seat === 'Cox';
          const assignedId = seats[seat];
          const m        = assignedId ? getMember(assignedId) : null;
          const occupied = !!assignedId;

          return (
            <Fragment key={seat}>
              {isCox && hasCox && (
                <div style={{ height: 1, background: 'var(--line)', margin: '4px 0 2px' }} />
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr',
                gap: 12,
                alignItems: 'center',
                minHeight: 38,
                padding: '6px 12px',
                background: occupied ? 'var(--bg-3)' : 'var(--bg-2)',
                border: `1px ${occupied ? 'solid' : 'dashed'} ${occupied ? 'var(--line-2)' : 'var(--line)'}`,
                borderRadius: 5,
              }}>
                <span className="mono" style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  color: occupied ? (isCox ? 'var(--fg-3)' : 'var(--accent)') : 'var(--fg-4)',
                }}>
                  {seat.toUpperCase()}
                </span>
                {occupied ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {m && (
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 999,
                        background: m.role === 'cox' ? 'var(--fg-3)' : 'var(--accent)',
                        color: 'var(--accent-fg)', letterSpacing: '0.04em', flexShrink: 0,
                      }}>
                        {m.role === 'cox' ? 'COX' : 'ATH'}
                      </span>
                    )}
                    <span className="mono" style={{
                      fontSize: 12, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m ? displayName(m) : `…${assignedId.slice(-8)}`}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic' }}>—</span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SeatGrid;
