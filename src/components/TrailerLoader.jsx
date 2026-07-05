import { useState, useImperativeHandle, forwardRef } from 'react';

const TrailerLoader = forwardRef(({
  boats             = [],
  onAddBoat,
  onRemoveBoat,
  initialPlacements = {},
  initialRows       = 4,
  initialCols       = 3,
  readOnly          = false,
  onSave,
}, ref) => {
  const [trailerRows, setTrailerRows] = useState(initialRows);
  const [trailerCols, setTrailerCols] = useState(initialCols);
  const [placements,  setPlacements]  = useState(() => initialPlacements);

  const [newBoatName, setNewBoatName] = useState('');
  const [newBoatType, setNewBoatType] = useState('8+');

  const [draggedBoat, setDraggedBoat] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);

  const [showSaveDialog,     setShowSaveDialog]     = useState(false);
  const [trailerProfileName, setTrailerProfileName] = useState('');
  const [confirmClear,       setConfirmClear]       = useState(false);

  useImperativeHandle(ref, () => ({
    openSaveDialog: () => setShowSaveDialog(true),
  }));

  // ── boat pool helpers ────────────────────────────────────

  const addBoat = async (name, type) => {
    if (!name.trim() || !onAddBoat) return;
    await onAddBoat(name.trim(), type);
    setNewBoatName('');
  };

  const removeBoat = async (id) => {
    if (!onRemoveBoat) return;
    setPlacements((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const arr = (next[k] || []).filter((bid) => bid !== id);
        if (arr.length === 0) delete next[k]; else next[k] = arr;
      }
      return next;
    });
    await onRemoveBoat(id);
  };

  // ── drag: pool → pool (return to pool) ──────────────────

  const handlePoolDrop = (e) => {
    e.preventDefault();
    if (!draggedBoat) return;
    setPlacements((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const arr = (next[k] || []).filter((id) => id !== draggedBoat);
        if (arr.length === 0) delete next[k]; else next[k] = arr;
      }
      return next;
    });
    setDraggedBoat(null);
    setDragOverCell(null);
  };

  // ── drag: pool/cell → cell ───────────────────────────────

  const handleCellDrop = (e, key) => {
    e.preventDefault();
    if (!draggedBoat) return;
    setPlacements((prev) => {
      const next = { ...prev };
      let cameFrom = null;
      for (const k of Object.keys(next)) {
        const arr = (next[k] || []).filter((id) => {
          if (id === draggedBoat) { cameFrom = k; return false; }
          return true;
        });
        if (arr.length === 0) delete next[k]; else next[k] = arr;
      }
      const existing = next[key] || [];
      if (existing.length < 2) {
        next[key] = [...existing, draggedBoat];
      } else {
        const displaced = existing[existing.length - 1];
        next[key] = [...existing.slice(0, -1), draggedBoat];
        if (cameFrom && cameFrom !== key) {
          next[cameFrom] = [...(next[cameFrom] || []), displaced];
        }
      }
      return next;
    });
    setDraggedBoat(null);
    setDragOverCell(null);
  };

  const removeFromCell = (boatId, cellKey) => {
    setPlacements((prev) => {
      const next = { ...prev };
      const arr = (next[cellKey] || []).filter((id) => id !== boatId);
      if (arr.length === 0) delete next[cellKey]; else next[cellKey] = arr;
      return next;
    });
  };

  // ── save ─────────────────────────────────────────────────

  const commitSave = () => {
    if (!trailerProfileName.trim()) return;
    const plan = {
      name: trailerProfileName.trim(),
      type: 'trailer',
      rows: trailerRows,
      cols: trailerCols,
      placements: { ...placements },
    };
    onSave?.(plan);
    setTrailerProfileName('');
    setShowSaveDialog(false);
  };

  // ── derived ───────────────────────────────────────────────

  const placedIds   = Object.values(placements).flat();
  const poolBoats   = boats.filter((b) => !placedIds.includes(b.id));
  const filledCount = placedIds.length;
  const totalSlots  = trailerRows * trailerCols * 2;

  // ── render ────────────────────────────────────────────────

  return (
    <div className="trailer-grid">

      {/* ── LEFT TOP: dimensions ── */}
      <div className="trailer-controls-top">
        <div className="card">
          <div className="card-head">
            <h3>Trailer dimensions</h3>
            {readOnly && (
              <span className="mono" style={{
                fontSize: 9, padding: '3px 7px', borderRadius: 3,
                background: 'var(--bg-3)', color: 'var(--fg-4)', letterSpacing: '0.1em',
              }}>
                VIEW ONLY
              </span>
            )}
          </div>
          <div className="card-body">
            {readOnly ? (
              <div className="mono" style={{ fontSize: 13, color: 'var(--fg-2)', letterSpacing: '-0.01em' }}>
                {trailerRows} × {trailerCols}
                <span style={{ color: 'var(--fg-4)', marginLeft: 10, fontSize: 11 }}>
                  → {trailerRows * trailerCols} slots
                </span>
              </div>
            ) : (
              <>
                <div className="dim-controls">
                  <div className="dim-ctrl">
                    <div className="dlabel">Rows</div>
                    <div className="stepper">
                      <button onClick={() => setTrailerRows((r) => Math.max(1, r - 1))}>–</button>
                      <div className="num">{trailerRows}</div>
                      <button onClick={() => setTrailerRows((r) => Math.min(10, r + 1))}>+</button>
                    </div>
                  </div>
                  <div className="dim-ctrl">
                    <div className="dlabel">Columns</div>
                    <div className="stepper">
                      <button onClick={() => setTrailerCols((c) => Math.max(1, c - 1))}>–</button>
                      <div className="num">{trailerCols}</div>
                      <button onClick={() => setTrailerCols((c) => Math.min(6, c + 1))}>+</button>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>
                  {trailerRows} × {trailerCols} → {trailerRows * trailerCols} slots
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CENTRE: stage ── */}
      <div className="trailer-stage">
        <div className="eyebrow">
          <span className="dot" /> Trailer cross-section · viewed from rear
        </div>

        <div className="trailer-viz">
          <div className="trailer-axle">
            <span>← PORT</span>
            <span>STARBOARD →</span>
          </div>

          <div
            className="trailer-grid-cells"
            style={{ gridTemplateColumns: `repeat(${trailerCols}, 1fr)` }}
          >
            {Array.from({ length: trailerRows * trailerCols }).map((_, idx) => {
              const r        = Math.floor(idx / trailerCols);
              const c        = idx % trailerCols;
              const key      = `${r}-${c}`;
              const cellIds  = placements[key] || [];
              const cellBoats = cellIds.map((id) => boats.find((b) => b.id === id)).filter(Boolean);
              const rackNum  = trailerRows - r;
              const sideLbl  = String.fromCharCode(65 + c);

              const cellTitle = readOnly
                ? `R${rackNum}·${sideLbl}`
                : cellBoats.length === 0
                  ? 'Drop a boat here'
                  : cellBoats.length === 1
                    ? 'Room for one more'
                    : 'Full — drop replaces last boat';

              return (
                <div
                  key={key}
                  className={[
                    'cell',
                    cellBoats.length > 0   ? 'filled'     : '',
                    cellBoats.length === 2 ? 'stacked'    : '',
                    dragOverCell === key    ? 'drop-hover' : '',
                  ].join(' ')}
                  title={cellTitle}
                  {...(!readOnly && {
                    onDragOver:  (e) => { e.preventDefault(); setDragOverCell(key); },
                    onDragLeave: ()  => setDragOverCell((cur) => cur === key ? null : cur),
                    onDrop:      (e) => handleCellDrop(e, key),
                  })}
                >
                  <span className="coord">R{rackNum}·{sideLbl}</span>

                  {cellBoats.length === 0 ? (
                    <span style={{ color: 'var(--fg-4)' }}>—</span>
                  ) : (
                    <div className="cell-boats">
                      {cellBoats.map((b) => (
                        <div
                          key={b.id}
                          className="cell-boat"
                          {...(!readOnly && {
                            draggable:   true,
                            onDragStart: (e) => {
                              setDraggedBoat(b.id);
                              e.dataTransfer.setData('source-cell', key);
                              e.dataTransfer.effectAllowed = 'move';
                              e.stopPropagation();
                            },
                            onDragEnd:   () => { setDraggedBoat(null); setDragOverCell(null); },
                            onClick:     (e) => { e.stopPropagation(); removeFromCell(b.id, key); },
                            title:       `${b.name} — click to remove, drag to move`,
                          })}
                          style={readOnly ? { cursor: 'default' } : undefined}
                        >
                          <span className="cell-tag">{b.type}</span>
                          <span className="cell-name">{b.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="trailer-legend">
          <span>TOP ROW = HIGHEST RACK</span>
          <span className="filled-count">{filledCount} / {totalSlots} FILLED</span>
        </div>

        {!readOnly && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.6 }}>
            Drag boat bubbles from the pool onto any slot — each slot can hold up to
            two boats. Drag a placed boat to another slot to reorder, or click to remove it.
          </div>
        )}
      </div>

      {/* ── LEFT BOTTOM: boats + load plans ── */}
      <div
        className="trailer-controls-bottom"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}
      >
        {/* Boats card */}
        <div className="card">
          <div className="card-head">
            <h3>Boats</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                {placedIds.length}/{boats.length} placed
              </div>
              {!readOnly && (
                confirmClear ? (
                  <>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>Clear all?</span>
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        setPlacements({});
                        setConfirmClear(false);
                      }}
                      style={{ color: 'var(--bad)', borderColor: 'oklch(0.68 0.20 20 / 0.4)' }}
                    >
                      Yes
                    </button>
                    <button className="btn ghost sm" onClick={() => setConfirmClear(false)}>
                      No
                    </button>
                  </>
                ) : (
                  <button
                    className="btn ghost sm"
                    onClick={() => setConfirmClear(true)}
                    disabled={placedIds.length === 0}
                  >
                    Clear
                  </button>
                )
              )}
            </div>
          </div>
          <div className="card-body">

            {/* Add-boat row — edit mode only */}
            {!readOnly && (
              <div className="add-boat-row">
                <input
                  placeholder="Boat name"
                  value={newBoatName}
                  onChange={(e) => setNewBoatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addBoat(newBoatName, newBoatType);
                  }}
                  maxLength={100}
                />
                <select value={newBoatType} onChange={(e) => setNewBoatType(e.target.value)}>
                  <option value="8+">8+</option>
                  <option value="4+">4+</option>
                  <option value="4-">4–</option>
                  <option value="4x">4x</option>
                  <option value="2x">2x</option>
                  <option value="2-">2–</option>
                  <option value="1x">1x</option>
                </select>
                <button
                  className="btn primary sm"
                  onClick={() => addBoat(newBoatName, newBoatType)}
                >
                  Add
                </button>
              </div>
            )}

            {/* Pool */}
            <div
              className={`boat-pool ${poolBoats.length === 0 ? 'empty' : ''}`}
              {...(!readOnly && {
                onDragOver: (e) => e.preventDefault(),
                onDrop:     handlePoolDrop,
              })}
            >
              {poolBoats.map((b) => (
                <div
                  key={b.id}
                  className={`bubble ${draggedBoat === b.id ? 'dragging' : ''}`}
                  {...(!readOnly && {
                    draggable:   true,
                    onDragStart: (e) => {
                      setDraggedBoat(b.id);
                      e.dataTransfer.effectAllowed = 'move';
                    },
                    onDragEnd: () => { setDraggedBoat(null); setDragOverCell(null); },
                  })}
                  style={readOnly ? { cursor: 'default' } : undefined}
                >
                  <span className="tag">{b.type}</span>
                  {b.name}
                  {!readOnly && (
                    <span
                      className="x"
                      onClick={(e) => { e.stopPropagation(); removeBoat(b.id); }}
                    >
                      ×
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Save dialog ── */}
      {showSaveDialog && (
        <div className="modal-back" onClick={() => setShowSaveDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              <span className="dot" /> Save load plan
            </div>
            <h2>Name this trailer loadout</h2>
            <input
              autoFocus
              placeholder="e.g. Head of Charles, Fall Classic…"
              value={trailerProfileName}
              onChange={(e) => setTrailerProfileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitSave(); }}
              maxLength={100}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={commitSave}
              >
                Save plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default TrailerLoader;
