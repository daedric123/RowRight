import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import TrailerLoader from "../components/TrailerLoader";
import CommentSection from "../components/CommentSection";
import SeatGrid from "../components/SeatGrid";
import RowLoader from "../components/RowLoader";

// ── small helpers ────────────────────────────────────────────

const uid = (id) => `…${id.slice(-8)}`;

const ALLOWED_BOAT_TYPES = ["8+", "4+", "4-", "4x", "2x", "2-", "1x"];
const SEAT_PRICE_USD = parseFloat(
  import.meta.env.VITE_STRIPE_SEAT_PRICE_USD || "0",
);

// Safely parse layout_data whether Supabase returns it as a parsed object
// (jsonb column) or as a raw JSON string (text column).
const parseLayoutData = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("parseLayoutData: JSON.parse failed", e, raw);
      return null;
    }
  }
  return raw;
};

const StatusBadge = ({ status }) => (
  <span
    className="mono"
    style={{
      fontSize: 10,
      padding: "3px 8px",
      borderRadius: 3,
      letterSpacing: "0.08em",
      background:
        status === "active" ? "oklch(0.78 0.14 155 / 0.12)" : "var(--bg-3)",
      color: status === "active" ? "var(--good)" : "var(--fg-4)",
    }}
  >
    {status.toUpperCase()}
  </span>
);

const PublishedDot = ({ published }) => (
  <span
    style={{
      display: "inline-block",
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: published ? "var(--good)" : "var(--fg-4)",
      marginRight: 6,
      flexShrink: 0,
    }}
  />
);

const LineupRow = ({
  lineup,
  members = [],
  onTogglePublished,
  onDelete,
  user,
  role,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const boatType = lineup.lineup_data?.boatType ?? "8+";
  const seats = lineup.lineup_data?.seats ?? {};

  const toggleBtn = (label, active, onClick) => (
    <button
      onClick={onClick}
      className="mono"
      style={{
        fontSize: 9,
        padding: "2px 8px",
        borderRadius: 3,
        background: active ? "var(--accent-dim)" : "var(--bg-3)",
        color: active ? "var(--accent)" : "var(--fg-4)",
        border: `1px solid ${active ? "oklch(0.72 0.18 25 / 0.35)" : "var(--line)"}`,
        letterSpacing: "0.08em",
        cursor: "pointer",
      }}
    >
      {label} {active ? "▲" : "▼"}
    </button>
  );

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(lineup.id);
    setDeleting(false);
    setConfirmDelete(false);
  };

  return (
    <>
      <div
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        {/* ── row header ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: 8,
            alignItems: "center",
            padding: "12px 14px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <PublishedDot published={lineup.published} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {lineup.name}
              </span>
              {toggleBtn("PREVIEW", showPreview, () =>
                setShowPreview((p) => !p),
              )}
              {lineup.comments_enabled &&
                toggleBtn("COMMENTS", showComments, () =>
                  setShowComments((p) => !p),
                )}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--fg-4)",
                marginTop: 4,
                letterSpacing: "0.06em",
              }}
            >
              {lineup.type.toUpperCase()}
              {lineup.event_name && ` · ${lineup.event_name}`}
              {lineup.event_date &&
                ` · ${new Date(lineup.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
            </div>
          </div>
          <button
            className={`btn sm ${lineup.published ? "ghost" : "primary"}`}
            onClick={() => onTogglePublished(lineup)}
            style={{ minWidth: 88 }}
          >
            {lineup.published ? "Unpublish" : "Publish"}
          </button>
          <Link
            to={`/lineups/${lineup.id}/edit`}
            className="btn ghost sm"
            style={{
              textDecoration: "none",
              minWidth: 52,
              justifyContent: "center",
            }}
          >
            Edit
          </Link>
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              padding: "5px 10px",
              borderRadius: 3,
              background: "oklch(0.68 0.20 20 / 0.10)",
              color: "var(--bad)",
              border: "1px solid oklch(0.68 0.20 20 / 0.35)",
              cursor: "pointer",
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            DEL
          </button>
        </div>

        {/* ── seat preview ── */}
        {showPreview && (
          <div
            style={{ borderTop: "1px solid var(--line)", padding: "16px 14px" }}
          >
            <SeatGrid boatType={boatType} seats={seats} members={members} />
          </div>
        )}

        {/* ── comments ── */}
        {lineup.comments_enabled && showComments && (
          <div
            style={{ borderTop: "1px solid var(--line)", padding: "16px 14px" }}
          >
            <CommentSection lineupId={lineup.id} user={user} role={role} />
          </div>
        )}
      </div>

      {/* ── confirm delete modal ── */}
      {confirmDelete && (
        <div
          className="modal-back"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              <span className="dot" style={{ background: "var(--bad)" }} />{" "}
              Delete lineup
            </div>
            <h2 style={{ marginBottom: 8 }}>Delete "{lineup.name}"?</h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--fg-3)",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              This will permanently remove the lineup and all its comments.
              Athletes who were assigned to it will no longer be able to see it.
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn ghost"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  opacity: deleting ? 0.5 : 1,
                }}
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  background: "var(--bad)",
                  color: "#fff",
                  border: "1px solid oklch(0.68 0.20 20 / 0.5)",
                  opacity: deleting ? 0.6 : 1,
                }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── main component ───────────────────────────────────────────

const CoachDashboard = () => {
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();

  const validTabs = ["roster", "loadplans", "lineups"];
  const initialTab = validTabs.includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "roster";
  const [tab, setTab] = useState(initialTab);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [loadPlans, setLoadPlans] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [planSaveStatus, setPlanSaveStatus] = useState(null); // null | { ok: boolean, message: string }
  const [loadedPlanId, setLoadedPlanId] = useState(null);
  const [loadedLayout, setLoadedLayout] = useState(null); // parsed layout_data of the loaded profile
  const [loadKey, setLoadKey] = useState(0); // increments on every Load click to force remount
  const builderRef = useRef(null);
  const trailerRef = useRef(null);
  const seatSyncTimerRef = useRef(null);

  // ── data fetching ──────────────────────────────────────────
  const fetchTeam = useCallback(async () => {
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("coach_id", user.id)
      .single();
    return data;
  }, [user]);

  const fetchBoats = useCallback(async (teamId) => {
    const { data, error } = await supabase
      .from("boats")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });
    if (!error) setBoats(data ?? []);
  }, []);

  const addBoat = useCallback(
    async (name, type) => {
      if (!team?.id) return;
      const trimmed = name?.trim() ?? "";
      if (!trimmed || trimmed.length > 100) return;
      if (!ALLOWED_BOAT_TYPES.includes(type)) return;
      const { data, error } = await supabase
        .from("boats")
        .insert({ team_id: team.id, name: trimmed, type })
        .select()
        .single();
      if (!error && data) setBoats((prev) => [...prev, data]);
    },
    [team],
  );

  const removeBoat = useCallback(async (id) => {
    const { error } = await supabase.from("boats").delete().eq("id", id);
    if (!error) setBoats((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const fetchLoadPlans = useCallback(
    async (teamId) => {
      const { data, error } = await supabase
        .from("load_profiles")
        .select("*")
        .eq("team_id", teamId)
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (!error) setLoadPlans(data ?? []);
    },
    [user],
  );

  const fetchMembers = useCallback(async (teamId) => {
    const { data: rows, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .in("status", ["pending", "active"])
      .order("approved_at", { ascending: false, nullsFirst: true });

    if (error || !rows) return;

    // team_members.user_id → auth.users(id) and profiles.id → auth.users(id),
    // so there's no direct FK to embed — fetch profiles in a second batched query.
    const userIds = rows.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p]),
    );

    // Prefer profiles table; fall back to full_name/email stored on team_members row
    setMembers(
      rows.map((r) => ({
        ...r,
        full_name: profileMap[r.user_id]?.full_name || r.full_name || null,
        email: profileMap[r.user_id]?.email || r.email || null,
      })),
    );
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const teamData = await fetchTeam();
    if (!teamData) {
      setLoading(false);
      return;
    }
    setTeam(teamData);

    // Run all team-scoped queries in parallel.
    const [lineupsResult] = await Promise.all([
      supabase
        .from("lineups")
        .select("*")
        .eq("team_id", teamData.id)
        .order("created_at", { ascending: false }),
      fetchMembers(teamData.id),
      fetchLoadPlans(teamData.id),
      fetchBoats(teamData.id),
    ]);

    if (!lineupsResult.error) setLineups(lineupsResult.data ?? []);
    setLoading(false);
  }, [fetchTeam, fetchMembers, fetchLoadPlans, fetchBoats]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(
    () => () => {
      if (seatSyncTimerRef.current) clearTimeout(seatSyncTimerRef.current);
    },
    [],
  );

  // ── roster actions ─────────────────────────────────────────
  // The Netlify function ignores `delta` for the math (it counts active members
  // from the DB) — `delta` is only validated. So a trailing-edge debounce here
  // collapses bursts of approve/remove clicks into a single Stripe API call.
  const updateStripeSeats = (delta) => {
    if (!team?.coach_id) return;
    if (seatSyncTimerRef.current) clearTimeout(seatSyncTimerRef.current);
    seatSyncTimerRef.current = setTimeout(async () => {
      seatSyncTimerRef.current = null;
      try {
        const res = await fetch("/.netlify/functions/update-seats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coach_id: team.coach_id, delta }),
        });
        if (res.ok) {
          const { seat_count } = await res.json();
          if (typeof seat_count === "number") {
            setTeam((prev) => ({ ...prev, seat_count }));
          }
        }
      } catch (err) {
        console.error("update-seats error:", err);
      }
    }, 500);
  };

  const approveMember = async (id) => {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      await fetchMembers(team.id);
      updateStripeSeats(1);
    } else {
      console.error("[approveMember] error:", error);
    }
  };

  const rejectMember = async (id) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (!error) {
      await fetchMembers(team.id);
    } else {
      console.error("[rejectMember] error:", error);
    }
  };

  const removeMember = async (id) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (!error) {
      await fetchMembers(team.id);
      updateStripeSeats(-1);
    } else {
      console.error("[removeMember] error:", error);
    }
  };

  // ── load plans actions ─────────────────────────────────────
  const handleTrailerSave = async (plan) => {
    setPlanSaveStatus(null);

    if (!team?.id) {
      console.error("[handleTrailerSave] team not loaded yet", { team });
      setPlanSaveStatus({
        ok: false,
        message: "Cannot save — team data not loaded. Try refreshing the page.",
      });
      return;
    }

    // Sanitize via JSON round-trip: strips undefined values and any
    // non-serializable React state internals (Proxy objects, etc.)
    const planName = plan.name?.trim() ?? "";
    if (!planName || planName.length > 100) {
      setPlanSaveStatus({
        ok: false,
        message: "Plan name must be 1–100 characters.",
      });
      return;
    }
    const rows = Number(plan.rows);
    const cols = Number(plan.cols);
    if (!Number.isInteger(rows) || rows < 1 || rows > 10) {
      setPlanSaveStatus({
        ok: false,
        message: "Rows must be between 1 and 10.",
      });
      return;
    }
    if (!Number.isInteger(cols) || cols < 1 || cols > 6) {
      setPlanSaveStatus({
        ok: false,
        message: "Columns must be between 1 and 6.",
      });
      return;
    }

    let layout_data;
    try {
      layout_data = JSON.parse(
        JSON.stringify({
          rows,
          cols,
          placements: plan.placements,
        }),
      );
    } catch (e) {
      console.error("[handleTrailerSave] layout_data serialization failed", e, {
        plan,
      });
      setPlanSaveStatus({
        ok: false,
        message: "Save failed: could not serialize layout data.",
      });
      return;
    }

    const payload = {
      team_id: team.id,
      created_by: user.id,
      name: planName,
      type: "trailer",
      layout_data,
      published: false,
    };

    const { data, error } = await supabase
      .from("load_profiles")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[handleTrailerSave] Supabase error", error);
      setPlanSaveStatus({
        ok: false,
        message: `Save failed: ${error.message}`,
      });
      return;
    }

    await fetchLoadPlans(team.id);
    setPlanSaveStatus({
      ok: true,
      message: `"${plan.name}" saved successfully.`,
    });
    setTimeout(() => setPlanSaveStatus(null), 5000);
  };

  const togglePlanPublished = async (plan) => {
    const { error } = await supabase
      .from("load_profiles")
      .update({ published: !plan.published })
      .eq("id", plan.id);
    if (!error) await fetchLoadPlans(team.id);
  };

  const deletePlan = async (id) => {
    const { error } = await supabase
      .from("load_profiles")
      .delete()
      .eq("id", id);
    if (!error) {
      await fetchLoadPlans(team.id);
      if (loadedPlanId === id) {
        setLoadedPlanId(null);
        setLoadedLayout(null);
      }
    }
  };

  const loadPlan = (plan) => {
    const ld = parseLayoutData(plan.layout_data);
    if (!ld) return;
    // Increment loadKey on every click — even for the same profile — so React
    // always remounts TrailerLoader with a fresh key and picks up the new initial props.
    setLoadedLayout(ld);
    setLoadedPlanId(plan.id);
    setLoadKey((k) => k + 1);
    setTimeout(() => {
      builderRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  // ── lineup actions ─────────────────────────────────────────
  const deleteLineup = async (id) => {
    const { error } = await supabase.from("lineups").delete().eq("id", id);
    if (!error) setLineups((prev) => prev.filter((l) => l.id !== id));
    else console.error("[deleteLineup] error:", error);
  };

  const toggleLineupPublished = async (lineup) => {
    const { error } = await supabase
      .from("lineups")
      .update({ published: !lineup.published })
      .eq("id", lineup.id);
    if (!error) {
      setLineups((prev) =>
        prev.map((l) =>
          l.id === lineup.id ? { ...l, published: !lineup.published } : l,
        ),
      );
    }
  };

  // ── copy code ──────────────────────────────────────────────
  const copyCode = () => {
    if (!team) return;
    navigator.clipboard.writeText(team.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── derived ────────────────────────────────────────────────
  const pending = useMemo(
    () => members.filter((m) => m.status === "pending"),
    [members],
  );
  const active = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  // Precompute display meta per load plan so we don't reparse and re-count
  // placements on every render of the list.
  const loadPlansWithMeta = useMemo(
    () =>
      loadPlans.map((plan) => {
        const ld = parseLayoutData(plan.layout_data);
        const boatCount = ld
          ? Object.values(ld.placements ?? {}).flat().length
          : 0;
        return {
          plan,
          meta: ld
            ? `${ld.rows ?? "?"}×${ld.cols ?? "?"} · ${boatCount} boats placed`
            : plan.type.toUpperCase(),
          parsed: ld,
        };
      }),
    [loadPlans],
  );

  const tabs = [
    { id: "roster", label: "Roster", num: "01", count: pending.length || null },
    {
      id: "loadplans",
      label: "Load Plans",
      num: "02",
      count: loadPlans.length || null,
    },
    {
      id: "lineups",
      label: "Lineups",
      num: "03",
      count: lineups.length || null,
    },
  ];

  // ── role guard (must be after all hooks) ──────────────────
  if (role !== null && role !== "Coach") {
    return <Navigate to="/app" replace />;
  }

  // ── render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="shell"
        style={{
          paddingTop: 80,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <RowLoader />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <div className="mark">R</div>
            <div>
              <div className="brand-name">
                RowRight <span>/ Coach</span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--fg-4)",
                  letterSpacing: "0.1em",
                  marginTop: 2,
                }}
              >
                v2.0 · CALIBRATED
              </div>
            </div>
          </div>
          <div className="topbar-right">
            <Link
              to="/app"
              style={{
                color: "var(--fg-3)",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              ← Tools
            </Link>
          </div>
        </div>

        <div
          style={{ maxWidth: 480, margin: "80px auto 0", textAlign: "center" }}
        >
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            <span className="dot" />
            Coach setup
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 12,
            }}
          >
            Create your team
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--fg-3)",
              lineHeight: 1.6,
              marginBottom: 32,
            }}
          >
            Set up your team to manage your roster, build lineups, and share
            trailer plans with athletes.
          </p>
          <Link
            to="/create-team"
            className="btn primary"
            style={{
              textDecoration: "none",
              padding: "14px 28px",
              fontSize: 13,
            }}
          >
            Create team →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      {/* ── topbar ── */}
      <div className="topbar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <div className="brand-name">
              RowRight <span>/ Coach</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--fg-4)",
                letterSpacing: "0.1em",
                marginTop: 2,
              }}
            >
              v2.0 · CALIBRATED
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <Link
            to="/app"
            style={{
              color: "var(--fg-3)",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            ← Tools
          </Link>
        </div>
      </div>

      {/* ── team header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="dot" />
            Your team
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {team.name}
          </h1>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
              Team code
            </span>
            <span
              className="mono"
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.12em",
                padding: "4px 10px",
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {team.code}
            </span>
            <button
              className="btn ghost sm"
              onClick={copyCode}
              style={{ minWidth: 80 }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "14px 20px",
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              textAlign: "center",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {active.length}
            </div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              Members
            </div>
          </div>
          <div
            style={{
              padding: "14px 20px",
              background: pending.length ? "var(--accent-dim)" : "var(--bg-1)",
              border: `1px solid ${pending.length ? "var(--accent)" : "var(--line)"}`,
              borderRadius: "var(--radius)",
              textAlign: "center",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: pending.length ? "var(--accent)" : "var(--fg)",
              }}
            >
              {pending.length}
            </div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              Pending
            </div>
          </div>
          {team.stripe_subscription_id && (
            <>
              <div
                style={{
                  padding: "14px 20px",
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  textAlign: "center",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {team.seat_count ?? "—"}
                </div>
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  Seats
                </div>
              </div>
              <div
                style={{
                  padding: "14px 20px",
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  textAlign: "center",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {team.seat_count
                    ? `$${(team.seat_count * SEAT_PRICE_USD).toFixed(2)}`
                    : "—"}
                </div>
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  Est. / mo
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── internal tabs ── */}
      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="num mono">{t.num}</span>
            {t.label}
            {t.count !== null && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background:
                    tab === t.id ? "var(--accent-dim)" : "var(--bg-3)",
                  color: tab === t.id ? "var(--accent)" : "var(--fg-4)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ══════════════ ROSTER ══════════════ */}
      {tab === "roster" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          {/* Pending requests */}
          <div className="card">
            <div className="card-head">
              <h3>Pending requests</h3>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-3)" }}
              >
                {pending.length} pending
              </div>
            </div>
            <div className="card-body">
              {pending.length === 0 ? (
                <div
                  style={{
                    padding: "28px 0",
                    textAlign: "center",
                    color: "var(--fg-4)",
                    fontSize: 13,
                  }}
                >
                  No pending requests.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {pending.map((m) => (
                    <div key={m.id} className="profile-item">
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.full_name || "—"}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: "var(--fg-3)",
                            marginTop: 2,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {m.email || uid(m.user_id)}
                          <span
                            style={{
                              marginLeft: 8,
                              textTransform: "capitalize",
                              color: "var(--fg-4)",
                            }}
                          >
                            · {m.role}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn primary sm"
                          onClick={() => approveMember(m.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn ghost sm"
                          onClick={() => rejectMember(m.id)}
                          style={{
                            color: "var(--bad)",
                            borderColor: "oklch(0.68 0.20 20 / 0.4)",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active roster */}
          <div className="card">
            <div className="card-head">
              <h3>Roster</h3>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-3)" }}
              >
                {active.length} / {team.seat_count || "∞"} seats
              </div>
            </div>
            <div className="card-body">
              {active.length === 0 ? (
                <div
                  style={{
                    padding: "28px 0",
                    textAlign: "center",
                    color: "var(--fg-4)",
                    fontSize: 13,
                  }}
                >
                  No active members yet.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {active.map((m) => (
                    <div key={m.id} className="profile-item">
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.full_name || "—"}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: "var(--fg-3)",
                            marginTop: 2,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {m.email || uid(m.user_id)}
                          <span
                            style={{
                              marginLeft: 8,
                              textTransform: "capitalize",
                              color: "var(--fg-4)",
                            }}
                          >
                            · {m.role}
                          </span>
                          {m.approved_at && (
                            <span
                              style={{ marginLeft: 8, color: "var(--fg-4)" }}
                            >
                              · joined{" "}
                              {new Date(m.approved_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeMember(m.id)}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          padding: "5px 10px",
                          borderRadius: 3,
                          background: "oklch(0.68 0.20 20 / 0.10)",
                          color: "var(--bad)",
                          border: "1px solid oklch(0.68 0.20 20 / 0.35)",
                          cursor: "pointer",
                          letterSpacing: "0.06em",
                          flexShrink: 0,
                        }}
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ LOAD PLANS ══════════════ */}
      {tab === "loadplans" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          {/* ── Builder ── */}
          <div ref={builderRef}>
            <TrailerLoader
              ref={trailerRef}
              key={loadKey}
              onSave={handleTrailerSave}
              boats={loadedLayout?.boats?.length ? loadedLayout.boats : boats}
              onAddBoat={addBoat}
              onRemoveBoat={removeBoat}
              initialPlacements={loadedLayout?.placements}
              initialRows={loadedLayout?.rows}
              initialCols={loadedLayout?.cols}
            />
          </div>

          {/* ── Save status banner ── */}
          {planSaveStatus && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${planSaveStatus.ok ? "oklch(0.78 0.14 155 / 0.35)" : "oklch(0.68 0.20 20 / 0.35)"}`,
                background: planSaveStatus.ok
                  ? "oklch(0.78 0.14 155 / 0.08)"
                  : "oklch(0.68 0.20 20 / 0.08)",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>
                {planSaveStatus.ok ? "✓" : "✕"}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: planSaveStatus.ok ? "var(--good)" : "var(--bad)",
                }}
              >
                {planSaveStatus.message}
              </span>
            </div>
          )}

          {/* ── Saved profiles ── */}
          <div className="card">
            <div className="card-head">
              <h3>Saved profiles</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--fg-3)" }}
                >
                  {loadPlans.length} saved
                </div>
                <button
                  className="btn primary sm"
                  onClick={() => trailerRef.current?.openSaveDialog()}
                >
                  Save plan
                </button>
              </div>
            </div>
            <div className="card-body">
              {loadPlans.length === 0 ? (
                <div
                  style={{
                    padding: "28px 0",
                    textAlign: "center",
                    color: "var(--fg-4)",
                    fontSize: 13,
                  }}
                >
                  Build a layout above and click{" "}
                  <strong style={{ color: "var(--fg-3)", fontWeight: 600 }}>
                    Save plan
                  </strong>{" "}
                  to create a profile.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {loadPlansWithMeta.map(({ plan, meta }) => (
                    <div
                      key={plan.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "12px 14px",
                        background:
                          loadedPlanId === plan.id
                            ? "oklch(0.65 0.18 250 / 0.06)"
                            : plan.published
                              ? "oklch(0.78 0.14 155 / 0.05)"
                              : "var(--bg-2)",
                        border: `1px solid ${
                          loadedPlanId === plan.id
                            ? "oklch(0.65 0.18 250 / 0.4)"
                            : plan.published
                              ? "oklch(0.78 0.14 155 / 0.3)"
                              : "var(--line)"
                        }`,
                        borderRadius: "var(--radius-sm)",
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                    >
                      {/* name + meta */}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {plan.name}
                          </span>
                          {loadedPlanId === plan.id && (
                            <span
                              className="mono"
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 3,
                                background: "oklch(0.65 0.18 250 / 0.15)",
                                color: "oklch(0.65 0.18 250)",
                                letterSpacing: "0.1em",
                                flexShrink: 0,
                              }}
                            >
                              LOADED
                            </span>
                          )}
                          {plan.published && (
                            <span
                              className="mono"
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 3,
                                background: "oklch(0.78 0.14 155 / 0.15)",
                                color: "var(--good)",
                                letterSpacing: "0.1em",
                                flexShrink: 0,
                              }}
                            >
                              LIVE
                            </span>
                          )}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "var(--fg-4)",
                            marginTop: 3,
                            letterSpacing: "0.06em",
                          }}
                        >
                          {meta}
                          {" · "}
                          {new Date(plan.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </div>
                      </div>

                      {/* load into builder */}
                      <button
                        className="btn ghost sm"
                        onClick={() => loadPlan(plan)}
                        style={{ flexShrink: 0, minWidth: 56 }}
                      >
                        Load
                      </button>

                      {/* publish toggle */}
                      <button
                        className={`btn sm ${plan.published ? "ghost" : "primary"}`}
                        onClick={() => togglePlanPublished(plan)}
                        style={{ minWidth: 90, flexShrink: 0 }}
                      >
                        {plan.published ? "Unpublish" : "Publish"}
                      </button>

                      {/* delete */}
                      <button
                        onClick={() => deletePlan(plan.id)}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          padding: "5px 10px",
                          borderRadius: 3,
                          background: "oklch(0.68 0.20 20 / 0.10)",
                          color: "var(--bad)",
                          border: "1px solid oklch(0.68 0.20 20 / 0.35)",
                          cursor: "pointer",
                          letterSpacing: "0.06em",
                          flexShrink: 0,
                        }}
                      >
                        DEL
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ LINEUPS ══════════════ */}
      {tab === "lineups" && (
        <div className="card">
          <div className="card-head">
            <h3>Lineups</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-3)" }}
              >
                {lineups.length} saved
              </div>
              <Link
                to="/lineups/new"
                className="btn primary sm"
                style={{ textDecoration: "none" }}
              >
                + New lineup
              </Link>
            </div>
          </div>
          <div className="card-body">
            {lineups.length === 0 ? (
              <div
                style={{
                  padding: "40px 0",
                  textAlign: "center",
                  color: "var(--fg-4)",
                  fontSize: 13,
                }}
              >
                No lineups yet.{" "}
                <Link
                  to="/lineups/new"
                  style={{ color: "var(--fg-3)", textDecoration: "underline" }}
                >
                  Create one.
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lineups.map((lineup) => (
                  <LineupRow
                    key={lineup.id}
                    lineup={lineup}
                    members={active}
                    onTogglePublished={toggleLineupPublished}
                    onDelete={deleteLineup}
                    user={user}
                    role={role}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachDashboard;
