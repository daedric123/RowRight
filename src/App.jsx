import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import KitPreview from "./components/KitPreview";
import TrailerLoader from "./components/TrailerLoader";
import CommentSection from "./components/CommentSection";
import RowLoader from "./components/RowLoader";
import EightLoader from "./components/EightLoader";
import {
  splitToSeconds,
  secondsToSplit,
  parseTimeInput,
  formatTimeInput,
} from "./lib/utils";
import { useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabase";

const parseLayoutData = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
};

const TWEAK_DEFAULTS = {
  accentHue: 25,
  density: "cozy",
};

const App = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("predictor");

  // Predictor
  const [splitPoints, setSplitPoints] = useState([
    { distance: 0, split: "1:45" },
    { distance: 500, split: "1:45" },
    { distance: 1000, split: "1:45" },
    { distance: 1500, split: "1:45" },
    { distance: 2000, split: "1:45" },
  ]);
  const [newSplitDistance, setNewSplitDistance] = useState("");
  const [draggedPoint, setDraggedPoint] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    visible: false,
    distance: 0,
    split: "",
  });
  const profileKey = user ? `rr_split_profiles_${user.id}` : null;
  const [savedProfiles, setSavedProfiles] = useState(() => {
    try {
      const key = user ? `rr_split_profiles_${user.id}` : null;
      if (!key) return [];
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [profileName, setProfileName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const canvasRef = useRef(null);

  // Split calculator
  const [distance, setDistance] = useState("2000");
  const [totalTime, setTotalTime] = useState("");
  const [customDistance, setCustomDistance] = useState("");
  const [splits, setSplits] = useState(null);

  // Watt calculator
  const [wattMode, setWattMode] = useState("split-to-watts");
  const [wattSplitInput, setWattSplitInput] = useState("1:45.0");
  const [wattsInput, setWattsInput] = useState("300");

  // Survey
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [voteCounts, setVoteCounts] = useState({});
  const [userVote, setUserVote] = useState(null); // design_key the current user voted for
  const [votesLoading, setVotesLoading] = useState(false);

  // Trailer
  const [trailerTeamId, setTrailerTeamId] = useState(null);
  const [publishedPlans, setPublishedPlans] = useState([]);
  const [teamBoats, setTeamBoats] = useState([]);
  const [trailerPlansLoading, setTrailerPlansLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  // My Lineups (athlete)
  const [myLineups, setMyLineups] = useState([]);
  const [myLineupsMembers, setMyLineupsMembers] = useState([]);
  const [myLineupsLoading, setMyLineupsLoading] = useState(false);

  // Tweaks
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // ---------- TWEAK HOST PROTOCOL ----------
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      else if (e.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  // Apply tweaks to root
  useEffect(() => {
    document.documentElement.setAttribute("data-density", tweaks.density);
    document.documentElement.style.setProperty(
      "--accent",
      `oklch(0.72 0.18 ${tweaks.accentHue})`,
    );
    document.documentElement.style.setProperty(
      "--accent-dim",
      `oklch(0.72 0.18 ${tweaks.accentHue} / 0.12)`,
    );
  }, [tweaks]);

  const updateTweak = (key, val) => {
    const next = { ...tweaks, [key]: val };
    setTweaks(next);
    window.parent.postMessage(
      { type: "__edit_mode_set_keys", edits: { [key]: val } },
      "*",
    );
  };

  // ---------- PREDICTOR CALC ----------
  const predicted2k = useMemo(() => {
    const sorted = [...splitPoints].sort((a, b) => a.distance - b.distance);
    let total = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const dd = sorted[i + 1].distance - sorted[i].distance;
      const s1 = splitToSeconds(sorted[i].split);
      const s2 = splitToSeconds(sorted[i + 1].split);
      const avg = (s1 + s2) / 2;
      total += (dd / 500) * avg;
    }
    return total;
  }, [splitPoints]);

  const avgSplit = useMemo(() => {
    if (predicted2k <= 0) return 0;
    return (predicted2k / 2000) * 500;
  }, [predicted2k]);

  const estWatts = useMemo(() => {
    if (avgSplit <= 0) return 0;
    const pace = avgSplit / 500;
    return Math.round(2.8 / Math.pow(pace, 3));
  }, [avgSplit]);

  const splitMarkers = useMemo(() => {
    const sorted = [...splitPoints].sort((a, b) => a.distance - b.distance);
    const marks = [0, 500, 1000, 1500, 2000];
    return marks.map((d) => {
      if (d <= sorted[0].distance) return { d, s: sorted[0].split };
      if (d >= sorted[sorted.length - 1].distance)
        return { d, s: sorted[sorted.length - 1].split };
      for (let i = 0; i < sorted.length - 1; i++) {
        if (d >= sorted[i].distance && d <= sorted[i + 1].distance) {
          const r =
            (d - sorted[i].distance) /
            (sorted[i + 1].distance - sorted[i].distance);
          const s1 = splitToSeconds(sorted[i].split);
          const s2 = splitToSeconds(sorted[i + 1].split);
          return { d, s: secondsToSplit(s1 + (s2 - s1) * r) };
        }
      }
      return { d, s: sorted[0].split };
    });
  }, [splitPoints]);

  // ---------- CANVAS GRAPH ----------
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const w = rect.width,
      h = rect.height;
    const pad = { t: 16, r: 16, b: 24, l: 36 };
    const gw = w - pad.l - pad.r;
    const gh = h - pad.t - pad.b;

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    const fg4 = getComputedStyle(document.documentElement)
      .getPropertyValue("--fg-4")
      .trim();
    const line = getComputedStyle(document.documentElement)
      .getPropertyValue("--line")
      .trim();
    const bg1 = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-1")
      .trim();

    ctx.clearRect(0, 0, w, h);

    const splits = splitPoints.map((p) => splitToSeconds(p.split));
    const ymin = Math.min(...splits) - 5;
    const ymax = Math.max(...splits) + 5;
    const yToPx = (y) => pad.t + (1 - (y - ymin) / (ymax - ymin)) * gh;
    const xToPx = (x) => pad.l + (x / 2000) * gw;

    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 2000; i += 500) {
      const x = xToPx(i);
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + gh);
      ctx.stroke();
    }
    const yStep = (ymax - ymin) / 4;
    for (let i = 0; i <= 4; i++) {
      const y = yToPx(ymin + i * yStep);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + gw, y);
      ctx.stroke();
    }

    ctx.fillStyle = fg4;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    for (let i = 0; i <= 2000; i += 500) {
      ctx.fillText(`${i}`, xToPx(i), pad.t + gh + 14);
    }
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = ymin + i * yStep;
      ctx.fillText(
        secondsToSplit(val).replace(/\.\d/, ""),
        pad.l - 8,
        yToPx(val) + 3,
      );
    }

    const sorted = [...splitPoints].sort((a, b) => a.distance - b.distance);
    ctx.fillStyle = `color-mix(in oklch, ${accent} 12%, transparent)`;
    ctx.beginPath();
    ctx.moveTo(xToPx(sorted[0].distance), pad.t + gh);
    sorted.forEach((p) =>
      ctx.lineTo(xToPx(p.distance), yToPx(splitToSeconds(p.split))),
    );
    ctx.lineTo(xToPx(sorted[sorted.length - 1].distance), pad.t + gh);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    sorted.forEach((p, i) => {
      const x = xToPx(p.distance);
      const y = yToPx(splitToSeconds(p.split));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    sorted.forEach((p) => {
      const x = xToPx(p.distance);
      const y = yToPx(splitToSeconds(p.split));
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = bg1;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [splitPoints]);

  // Redraw whenever split points, mode, or theme change.
  // Depend on splitPoints directly so loading a profile always triggers a redraw.
  useEffect(() => {
    if (mode !== "predictor") return;
    drawGraph();
  }, [mode, splitPoints, tweaks, drawGraph]);

  // Separate resize listener so it doesn't re-attach on every splitPoints change.
  useEffect(() => {
    const onResize = () => {
      if (mode === "predictor") drawGraph();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, drawGraph]);

  // ---------- CANVAS INTERACTIONS ----------
  const getPointAt = (x, y) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width,
      h = rect.height;
    const pad = { t: 16, r: 16, b: 24, l: 36 };
    const splits = splitPoints.map((p) => splitToSeconds(p.split));
    const ymin = Math.min(...splits) - 5;
    const ymax = Math.max(...splits) + 5;
    const yToPx = (yy) =>
      pad.t + (1 - (yy - ymin) / (ymax - ymin)) * (h - pad.t - pad.b);
    const xToPx = (xx) => pad.l + (xx / 2000) * (w - pad.l - pad.r);
    for (let i = 0; i < splitPoints.length; i++) {
      const px = xToPx(splitPoints[i].distance);
      const py = yToPx(splitToSeconds(splitPoints[i].split));
      if (Math.hypot(x - px, y - py) < 14) return i;
    }
    return null;
  };

  const getPointerXY = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const canvasMouseDown = (e) => {
    const { x, y } = getPointerXY(e);
    const idx = getPointAt(x, y);
    if (idx !== null) {
      if (e.touches) e.preventDefault();
      setDraggedPoint(idx);
    }
  };

  const canvasRightClick = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width,
      h = rect.height;
    const pad = { t: 16, r: 16, b: 24, l: 36 };
    const splits = splitPoints.map((p) => splitToSeconds(p.split));
    const ymin = Math.min(...splits) - 5;
    const ymax = Math.max(...splits) + 5;
    let d = Math.round((((x - pad.l) / (w - pad.l - pad.r)) * 2000) / 50) * 50;
    d = Math.max(0, Math.min(2000, d));
    let s = ymin + (1 - (y - pad.t) / (h - pad.t - pad.b)) * (ymax - ymin);
    s = Math.max(60, Math.min(180, s));
    if (splitPoints.some((p) => p.distance === d)) return;
    setSplitPoints([...splitPoints, { distance: d, split: secondsToSplit(s) }]);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (draggedPoint === null || !canvasRef.current) return;
      if (e.touches) e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      const x = point.clientX - rect.left;
      const y = point.clientY - rect.top;
      const w = rect.width,
        h = rect.height;
      const pad = { t: 16, r: 16, b: 24, l: 36 };
      const splits = splitPoints.map((p) => splitToSeconds(p.split));
      const ymin = Math.min(...splits) - 5;
      const ymax = Math.max(...splits) + 5;
      let d =
        Math.round((((x - pad.l) / (w - pad.l - pad.r)) * 2000) / 50) * 50;
      d = Math.max(0, Math.min(2000, d));
      const origDistance = splitPoints[draggedPoint].distance;
      if (origDistance === 0 || origDistance === 2000) d = origDistance;
      let s = ymin + (1 - (y - pad.t) / (h - pad.t - pad.b)) * (ymax - ymin);
      s = Math.max(60, Math.min(180, s));
      const newSplit = secondsToSplit(s);
      setTooltipPos({
        x: point.clientX,
        y: point.clientY,
        visible: true,
        distance: d,
        split: newSplit,
      });
      setSplitPoints((prev) => {
        const next = [...prev];
        next[draggedPoint] = { distance: d, split: newSplit };
        return next;
      });
    };
    const onUp = () => {
      if (draggedPoint !== null) {
        setDraggedPoint(null);
        setTooltipPos((p) => ({ ...p, visible: false }));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggedPoint, splitPoints]);

  // ---------- POINT MGMT ----------
  const updateSplit = (idx, val) => {
    const next = [...splitPoints];
    next[idx].split = val;
    setSplitPoints(next);
  };
  const removePoint = (idx) => {
    if (splitPoints.length > 2)
      setSplitPoints(splitPoints.filter((_, i) => i !== idx));
  };
  const addPoint = () => {
    const d = parseInt(newSplitDistance);
    if (isNaN(d) || d < 0 || d > 2000) return;
    if (splitPoints.some((p) => p.distance === d)) return;
    const sorted = [...splitPoints].sort((a, b) => a.distance - b.distance);
    let split = "1:50";
    for (let i = 0; i < sorted.length - 1; i++) {
      if (d > sorted[i].distance && d < sorted[i + 1].distance) {
        const s1 = splitToSeconds(sorted[i].split);
        const s2 = splitToSeconds(sorted[i + 1].split);
        const r =
          (d - sorted[i].distance) /
          (sorted[i + 1].distance - sorted[i].distance);
        split = secondsToSplit(s1 + (s2 - s1) * r);
        break;
      }
    }
    setSplitPoints([...splitPoints, { distance: d, split }]);
    setNewSplitDistance("");
  };

  const persistProfiles = (next) => {
    setSavedProfiles(next);
    try {
      if (profileKey) localStorage.setItem(profileKey, JSON.stringify(next));
    } catch {}
  };

  const saveProfile = () => {
    if (!profileName.trim()) return;
    const next = [
      ...savedProfiles,
      {
        id: crypto.randomUUID(),
        name: profileName.trim(),
        splitPoints: splitPoints.map((p) => ({ ...p })),
        time: secondsToSplit(predicted2k),
      },
    ];
    persistProfiles(next);
    setProfileName("");
    setShowSaveDialog(false);
  };
  const loadProfile = (p) =>
    setSplitPoints(p.splitPoints.map((pt) => ({ ...pt })));
  const deleteProfile = (id) =>
    persistProfiles(savedProfiles.filter((p) => p.id !== id));
  const resetDefault = () =>
    setSplitPoints([
      { distance: 0, split: "1:45" },
      { distance: 500, split: "1:45" },
      { distance: 1000, split: "1:45" },
      { distance: 1500, split: "1:45" },
      { distance: 2000, split: "1:45" },
    ]);

  // ---------- SPLIT CALC ----------
  const calcSplits = () => {
    const d =
      distance === "custom" ? parseInt(customDistance) : parseInt(distance);
    const tot = parseTimeInput(totalTime);
    if (!d || d <= 0 || tot <= 0) return;
    const pace = tot / d;
    const sp500 = pace * 500;
    const watts = Math.round(2.8 / Math.pow(sp500 / 500, 3));
    const quarter = pace * (d / 4);
    const half = pace * (d / 2);
    setSplits({
      split500: secondsToSplit(sp500),
      quarter: secondsToSplit(quarter),
      half: secondsToSplit(half),
      perMeter: pace.toFixed(3),
      watts,
    });
  };

  // ---------- WATT CALC ----------
  const wattResult = useMemo(() => {
    if (wattMode === "split-to-watts") {
      const sec = splitToSeconds(wattSplitInput);
      if (!sec || sec <= 0) return null;
      const w = 2.8 / Math.pow(sec / 500, 3);
      return { watts: Math.round(w), split: wattSplitInput, seconds: sec };
    } else {
      const w = parseFloat(wattsInput);
      if (!w || w <= 0) return null;
      const pace = Math.pow(2.8 / w, 1 / 3);
      const sp500 = pace * 500;
      return { watts: w, split: secondsToSplit(sp500), seconds: sp500 };
    }
  }, [wattMode, wattSplitInput, wattsInput]);

  const wattTiers = [
    { name: "Easy", min: 0, max: 150, pace: "2:20 +" },
    { name: "Steady", min: 150, max: 250, pace: "2:00 – 2:20" },
    { name: "Threshold", min: 250, max: 350, pace: "1:45 – 2:00" },
    { name: "Race", min: 350, max: 600, pace: "1:45 –" },
  ];

  const currentTier = wattResult
    ? wattTiers.findIndex(
        (t) => wattResult.watts >= t.min && wattResult.watts < t.max,
      )
    : -1;

  // ---------- SURVEY ----------
  const designs = [
    {
      id: "design1",
      name: "Fire Wave",
      desc: "Bold vermillion waveforms across the chest, mono logo in accent.",
      pattern: "wave",
    },
    {
      id: "design2",
      name: "Speed Stripes",
      desc: "Twin racing stripes with gradient fade — aerodynamic, tight, athletic.",
      pattern: "stripes",
    },
    {
      id: "design3",
      name: "Wave Flow",
      desc: "Minimal white base with flowing wave pattern down the sleeves.",
      pattern: "sleeves",
    },
    {
      id: "design4",
      name: "Classic Block",
      desc: "Tonal color blocks with bold wordmark — heritage meets modern.",
      pattern: "blocks",
    },
  ];

  useEffect(() => {
    if (mode !== "survey") return;
    let cancelled = false;

    const fetchVotes = async () => {
      setVotesLoading(true);

      const [countsRes, userRes] = await Promise.all([
        supabase.from("votes").select("design_key"),
        user
          ? supabase
              .from("votes")
              .select("design_key")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      if (!countsRes.error && countsRes.data) {
        const counts = {};
        countsRes.data.forEach(({ design_key }) => {
          counts[design_key] = (counts[design_key] || 0) + 1;
        });
        setVoteCounts(counts);
      }

      setUserVote(userRes.data?.design_key ?? null);
      setVotesLoading(false);
    };

    fetchVotes();
    return () => {
      cancelled = true;
    };
  }, [mode, user]);

  const hasVoted = userVote !== null;

  // ---------- TRAILER DATA ----------
  useEffect(() => {
    if (mode !== "trailer" || !user) return;
    let cancelled = false;
    setTrailerPlansLoading(true);

    const fetchTrailerData = async () => {
      if (role === "Coach") {
        const { data } = await supabase
          .from("teams")
          .select("id")
          .eq("coach_id", user.id)
          .maybeSingle();
        if (!cancelled && data) setTrailerTeamId(data.id);
      } else {
        // Step 1: resolve team_id from team_members
        const { data: membership, error: membershipError } = await supabase
          .from("team_members")
          .select("team_id, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (cancelled) return;

        if (!membership) {
          if (!cancelled) setTrailerPlansLoading(false);
          return;
        }

        const teamId = membership.team_id;
        if (!teamId) {
          if (!cancelled) setTrailerPlansLoading(false);
          return;
        }

        const [plansRes, boatsRes] = await Promise.all([
          supabase
            .from("load_profiles")
            .select("*")
            .eq("team_id", teamId)
            .eq("published", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("boats")
            .select("*")
            .eq("team_id", teamId)
            .order("created_at", { ascending: true }),
        ]);

        if (!cancelled) {
          setPublishedPlans(plansRes.data ?? []);
          setTeamBoats(boatsRes.data ?? []);
        }
      }
      if (!cancelled) setTrailerPlansLoading(false);
    };

    fetchTrailerData();
    return () => {
      cancelled = true;
    };
  }, [mode, user, role]);

  // ---------- MY LINEUPS (athlete) ----------
  useEffect(() => {
    if (mode !== "mylineups" || !user || role === "Coach") return;
    let cancelled = false;
    setMyLineupsLoading(true);

    const fetchMyLineups = async () => {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cancelled || !membership) {
        setMyLineupsLoading(false);
        return;
      }

      const teamId = membership.team_id;

      const [lineupsRes, membersRes] = await Promise.all([
        supabase
          .from("lineups")
          .select("*")
          .eq("team_id", teamId)
          .eq("published", true)
          .order("event_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members")
          .select("id, user_id, role, full_name")
          .eq("team_id", teamId)
          .eq("status", "active"),
      ]);

      if (cancelled) return;

      const allLineups = lineupsRes.data || [];
      const mine = allLineups.filter((l) =>
        Object.values(l.lineup_data?.seats ?? {}).includes(user.id),
      );

      // Collect every user_id that appears in any seat across my lineups,
      // plus all active team members — then fetch profiles for all of them.
      const seatUserIds = mine.flatMap((l) =>
        Object.values(l.lineup_data?.seats ?? {}),
      );
      const memberUserIds = (membersRes.data || []).map((r) => r.user_id);
      const allUserIds = [...new Set([...seatUserIds, ...memberUserIds])];

      const { data: profiles } = allUserIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", allUserIds)
        : { data: [] };

      if (cancelled) return;

      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      // Build member list: active team members with names resolved
      const memberRows = (membersRes.data || []).map((r) => ({
        ...r,
        full_name: profileMap[r.user_id]?.full_name || r.full_name || null,
      }));

      // Add synthetic entries for any seat occupant not in team_members
      const knownIds = new Set(memberRows.map((r) => r.user_id));
      for (const uid of seatUserIds) {
        if (!knownIds.has(uid) && profileMap[uid]) {
          memberRows.push({
            user_id: uid,
            role: "athlete",
            full_name: profileMap[uid].full_name,
          });
          knownIds.add(uid);
        }
      }

      setMyLineups(mine);
      setMyLineupsMembers(memberRows);
      setMyLineupsLoading(false);
    };

    fetchMyLineups();
    return () => {
      cancelled = true;
    };
  }, [mode, user, role]);

  const handleTrailerSave = async (plan) => {
    if (!trailerTeamId) return;
    await supabase.from("load_profiles").insert({
      team_id: trailerTeamId,
      created_by: user.id,
      name: plan.name,
      type: "trailer",
      layout_data: {
        rows: plan.rows,
        cols: plan.cols,
        boats: plan.boats,
        placements: plan.placements,
      },
    });
  };

  const submitVote = async () => {
    if (!selectedDesign || !user || votesLoading) return;
    setVotesLoading(true);

    // Remove previous vote if changing selection
    if (userVote) {
      await supabase
        .from("votes")
        .delete()
        .eq("user_id", user.id)
        .eq("design_key", userVote);
    }

    const { error } = await supabase
      .from("votes")
      .insert({ user_id: user.id, design_key: selectedDesign });

    if (!error) {
      setVoteCounts((prev) => {
        const next = { ...prev };
        if (userVote) next[userVote] = Math.max(0, (next[userVote] || 1) - 1);
        next[selectedDesign] = (next[selectedDesign] || 0) + 1;
        return next;
      });
      setUserVote(selectedDesign);
    }
    setVotesLoading(false);
  };

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const winningDesign =
    totalVotes > 0
      ? Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  // ---------- RENDER ----------
  const tabs = [
    { id: "predictor", label: "2K Predictor", num: "01" },
    { id: "calculator", label: "Split Calculator", num: "02" },
    { id: "watts", label: "Watt / Split", num: "03" },
    { id: "survey", label: "Uni Survey", num: "04" },
    ...(role !== "Coach"
      ? [
          { id: "trailer", label: "Trailer Loader", num: "05" },
          {
            id: "mylineups",
            label: "My Lineups",
            num: "06",
            count: myLineups.length || null,
          },
        ]
      : []),
  ];

  return (
    <div className="shell">
      {/* TOP BAR */}
      <div className="topbar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <div className="brand-name">
              RowRight <span>/ Performance</span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--fg-4)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.1em",
                marginTop: 2,
              }}
            >
              v2.0 · CALIBRATED
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="status">
            <div className="pulse" /> LIVE
          </div>
          <div className="mono" style={{ fontSize: 11 }}>
            {new Date()
              .toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })
              .toUpperCase()}
          </div>
          {user ? (
            <>
              <div
                style={{ width: 1, height: 18, background: "var(--line-2)" }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--fg-2)",
                    lineHeight: 1,
                  }}
                >
                  {user.user_metadata?.full_name || user.email}
                </div>
                {role && (
                  <div className="eyebrow" style={{ letterSpacing: "0.1em" }}>
                    {role}
                  </div>
                )}
              </div>
              {role === "Coach" && (
                <button
                  className="btn ghost sm"
                  onClick={() => navigate("/dashboard")}
                >
                  Dashboard
                </button>
              )}
              <button className="btn ghost sm" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <div
                style={{ width: 1, height: 18, background: "var(--line-2)" }}
              />
              <Link
                to="/login"
                className="btn ghost sm"
                style={{ textDecoration: "none" }}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="btn primary sm"
                style={{ textDecoration: "none" }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* HERO */}
      <div className="hero">
        <h1>
          Row<span className="slash">/</span>Right
          <em>Made for rowers, by rowers.</em>
        </h1>
        <EightLoader />
      </div>

      {/* TABS */}
      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${mode === t.id ? "active" : ""}`}
            onClick={() => setMode(t.id)}
          >
            <span className="num mono">{t.num}</span>
            {t.label}
            {t.count != null && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background:
                    mode === t.id ? "var(--accent-dim)" : "var(--bg-3)",
                  color: mode === t.id ? "var(--accent)" : "var(--fg-4)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ============ PREDICTOR ============ */}
      {mode === "predictor" && (
        <div>
          {/* Three-up hero */}
          <div className="predictor-hero">
            <div
              className="tile lead"
              style={{ backgroundColor: "rgb(255, 255, 255)" }}
            >
              <div className="eyebrow">
                <span className="dot" /> Predicted 2000m
              </div>
              <div className="hero-time" style={{ color: "rgb(0, 0, 0)" }}>
                {secondsToSplit(predicted2k).split(".")[0]}
                <span className="ms">
                  .{secondsToSplit(predicted2k).split(".")[1]}
                </span>
              </div>
              <div className="hero-sub">
                <span className="chip">{secondsToSplit(avgSplit)}</span>
                avg split · {estWatts}w
              </div>
            </div>

            <div className="tile">
              <div
                className="eyebrow"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  <span className="dot" /> Pacing curve
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--fg-4)", fontSize: 9 }}
                >
                  R-CLICK TO ADD
                </span>
              </div>
              <div className="graph-wrap">
                <canvas
                  ref={canvasRef}
                  onMouseDown={canvasMouseDown}
                  onTouchStart={canvasMouseDown}
                  onContextMenu={canvasRightClick}
                  style={{ height: 200, touchAction: "none" }}
                />
              </div>
              <div className="graph-hint">DRAG POINTS · SHAPE THE PIECE</div>
            </div>
          </div>

          {/* Points + profiles */}
          <div className="row-2">
            <div className="card">
              <div className="card-head">
                <h3>
                  Split Points{" "}
                  <span
                    className="mono"
                    style={{
                      color: "var(--fg-3)",
                      fontWeight: 400,
                      marginLeft: 8,
                    }}
                  >
                    · {splitPoints.length}
                  </span>
                </h3>
                <div className="btn-row">
                  <button className="btn ghost sm" onClick={resetDefault}>
                    Reset
                  </button>
                  <button
                    className="btn primary sm"
                    onClick={() => setShowSaveDialog(true)}
                  >
                    Save profile
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="points-list">
                  {[...splitPoints]
                    .sort((a, b) => a.distance - b.distance)
                    .map((p) => {
                      const idx = splitPoints.indexOf(p);
                      return (
                        <div key={idx} className="point-row">
                          <div className="dist">
                            {String(p.distance).padStart(4, "0")}m
                          </div>
                          <input
                            value={p.split}
                            inputMode="decimal"
                            onChange={(e) =>
                              updateSplit(idx, formatTimeInput(e.target.value))
                            }
                          />
                          {splitPoints.length > 2 && (
                            <button
                              className="rm"
                              onClick={() => removePoint(idx)}
                            >
                              REMOVE
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
                <div className="add-point">
                  <input
                    type="number"
                    placeholder="Add split at distance (0–2000)"
                    value={newSplitDistance}
                    onChange={(e) => setNewSplitDistance(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPoint()}
                  />
                  <button className="btn" onClick={addPoint}>
                    Add point
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>
                  Saved profiles{" "}
                  <span
                    className="mono"
                    style={{
                      color: "var(--fg-3)",
                      fontWeight: 400,
                      marginLeft: 8,
                    }}
                  >
                    · {savedProfiles.length}
                  </span>
                </h3>
              </div>
              <div className="card-body">
                {savedProfiles.length === 0 ? (
                  <div
                    style={{
                      padding: "40px 10px",
                      textAlign: "center",
                      color: "var(--fg-4)",
                      fontSize: 12,
                    }}
                  >
                    No profiles yet.
                    <br />
                    <span style={{ color: "var(--fg-3)" }}>
                      Save the current strategy to compare pacing.
                    </span>
                  </div>
                ) : (
                  <div className="profiles">
                    {savedProfiles.map((p) => (
                      <div key={p.id} className="profile-item">
                        <div>
                          <div className="name">{p.name}</div>
                          <div className="time">{p.time}</div>
                        </div>
                        <button className="mini" onClick={() => loadProfile(p)}>
                          LOAD
                        </button>
                        <button
                          className="mini del"
                          onClick={() => deleteProfile(p.id)}
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
        </div>
      )}

      {/* ============ SPLIT CALCULATOR ============ */}
      {mode === "calculator" && (
        <div className="calc-grid">
          <div className="card">
            <div className="card-head">
              <h3>Inputs</h3>
            </div>
            <div className="card-body">
              <div className="field">
                <label>Distance</label>
                <select
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                >
                  <option value="500">500m</option>
                  <option value="1000">1,000m</option>
                  <option value="2000">2,000m</option>
                  <option value="5000">5,000m</option>
                  <option value="6000">6,000m</option>
                  <option value="10000">10,000m</option>
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {distance === "custom" && (
                <div className="field">
                  <label>Custom distance (m)</label>
                  <input
                    className="mono-input"
                    type="number"
                    placeholder="e.g. 3000"
                    value={customDistance}
                    onChange={(e) => setCustomDistance(e.target.value)}
                  />
                </div>
              )}
              <div className="field">
                <label>Total time</label>
                <input
                  className="mono-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="7:30"
                  value={totalTime}
                  onChange={(e) =>
                    setTotalTime(formatTimeInput(e.target.value))
                  }
                />
              </div>
              <button
                className="btn primary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "14px",
                }}
                onClick={calcSplits}
              >
                Calculate splits
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Results</h3>
            </div>
            <div className="card-body">
              {splits ? (
                <>
                  <div className="eyebrow">
                    <span className="dot" /> Pace per 500m
                  </div>
                  <div className="result-big">{splits.split500}</div>
                  <div
                    className="mono"
                    style={{ color: "var(--fg-3)", fontSize: 12 }}
                  >
                    {splits.perMeter}s per meter
                  </div>
                  <div className="result-grid">
                    <div className="result-cell">
                      <div className="k">¼ Distance</div>
                      <div className="v">{splits.quarter}</div>
                    </div>
                    <div className="result-cell">
                      <div className="k">½ Distance</div>
                      <div className="v">{splits.half}</div>
                    </div>
                    <div className="result-cell">
                      <div className="k">Power</div>
                      <div className="v">{splits.watts}w</div>
                    </div>
                    <div className="result-cell">
                      <div className="k">Pace / 500m</div>
                      <div className="v" style={{ color: "var(--accent)" }}>
                        {splits.split500}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: "60px 10px",
                    textAlign: "center",
                    color: "var(--fg-4)",
                    fontSize: 13,
                  }}
                >
                  Enter distance and total time, then hit{" "}
                  <span style={{ color: "var(--fg-2)" }}>Calculate</span>.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ WATT / SPLIT ============ */}
      {mode === "watts" && (
        <div className="watt-grid">
          <div className="watt-main">
            <div className="watt-input-area">
              <div className="watt-toggle">
                <button
                  className={wattMode === "split-to-watts" ? "active" : ""}
                  onClick={() => setWattMode("split-to-watts")}
                >
                  Split → Watts
                </button>
                <button
                  className={wattMode === "watts-to-split" ? "active" : ""}
                  onClick={() => setWattMode("watts-to-split")}
                >
                  Watts → Split
                </button>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  {wattMode === "split-to-watts"
                    ? "Enter 500m split"
                    : "Enter power output"}
                </div>
                {wattMode === "split-to-watts" ? (
                  <>
                    <input
                      className="watt-big-input"
                      value={wattSplitInput}
                      onChange={(e) => setWattSplitInput(e.target.value)}
                      placeholder="1:45.0"
                    />
                    <div className="watt-unit">MIN:SEC.T per 500M</div>
                  </>
                ) : (
                  <>
                    <input
                      className="watt-big-input"
                      type="number"
                      value={wattsInput}
                      onChange={(e) => setWattsInput(e.target.value)}
                      placeholder="300"
                    />
                    <div className="watt-unit">WATTS</div>
                  </>
                )}
              </div>
            </div>

            <div className="watt-output">
              <div className="eyebrow">
                <span className="dot" />{" "}
                {wattMode === "split-to-watts" ? "Power output" : "Split pace"}
              </div>
              <div className="watt-out-big">
                {wattResult
                  ? wattMode === "split-to-watts"
                    ? wattResult.watts
                    : wattResult.split.split(".")[0]
                  : "—"}
              </div>
              <div className="watt-out-unit">
                {wattResult
                  ? wattMode === "split-to-watts"
                    ? "WATTS"
                    : `.${wattResult.split.split(".")[1]} per 500M`
                  : ""}
              </div>
              {wattResult && (
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: "var(--fg-3)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {wattMode === "split-to-watts"
                    ? `= ${wattResult.watts} W @ ${wattResult.split} /500m`
                    : `= ${wattResult.split} /500m @ ${wattResult.watts}W`}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 2" }}>
            <div className="card-head">
              <h3>Tip</h3>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-3)" }}
              >
                Formula: watts = 2.80 / pace³
              </div>
            </div>
            <div className="card-body">
              <div
                style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--mono)",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  i
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--fg-2)",
                    maxWidth: 640,
                  }}
                >
                  <span style={{ color: "var(--fg)", fontWeight: 600 }}>
                    Watts measure mechanical output, not effort.
                  </span>
                  {"\n"}
                  To train by intensity, pair your power numbers with heart-rate
                  zones. Easy pieces should sit in zones 1–2, threshold work in
                  zone 4, and race-pace efforts in zone 5. Your split tells you
                  how fast the boat moves; your heart rate tells you how hard
                  your body is working.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ SURVEY ============ */}
      {mode === "survey" && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3>Choose next season's kit</h3>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-3)" }}
              >
                {votesLoading ? "…" : `${totalVotes} votes cast`}
              </div>
            </div>
            <div className="card-body">
              <div className="survey-grid">
                {designs.map((d) => {
                  const count = voteCounts[d.id] || 0;
                  const pct =
                    totalVotes > 0
                      ? ((count / totalVotes) * 100).toFixed(0)
                      : 0;
                  const canSelect = user && !hasVoted;
                  return (
                    <div
                      key={d.id}
                      className={`uni-card ${selectedDesign === d.id ? "selected" : ""}`}
                      onClick={() => canSelect && setSelectedDesign(d.id)}
                      style={{ cursor: canSelect ? "pointer" : "default" }}
                    >
                      <div className="uni-preview">
                        <KitPreview pattern={d.pattern} />
                      </div>
                      <div className="uni-meta">
                        <div className="name">{d.name}</div>
                        <div className="desc">{d.desc}</div>
                        <div className="badge">
                          {hasVoted || !user
                            ? `${pct}% · ${count} VOTES`
                            : selectedDesign === d.id
                              ? "◉ SELECTED"
                              : "TAP TO PICK"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                {!user ? (
                  <Link to="/login" className="btn ghost">
                    Log in to vote
                  </Link>
                ) : hasVoted ? (
                  <button
                    className="btn ghost"
                    onClick={() => setSelectedDesign(null)}
                    disabled={votesLoading}
                  >
                    Change vote
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={submitVote}
                    disabled={votesLoading}
                    style={{
                      opacity: selectedDesign && !votesLoading ? 1 : 0.4,
                      pointerEvents:
                        selectedDesign && !votesLoading ? "auto" : "none",
                    }}
                  >
                    {votesLoading ? "Submitting…" : "Submit vote"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {(hasVoted || !user) && totalVotes > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>Results</h3>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--fg-3)" }}
                >
                  Leader: {designs.find((d) => d.id === winningDesign)?.name}
                </div>
              </div>
              <div className="card-body">
                {designs.map((d) => {
                  const count = voteCounts[d.id] || 0;
                  const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                  const isWin = d.id === winningDesign;
                  return (
                    <div
                      key={d.id}
                      className={`vote-row ${isWin ? "win" : ""}`}
                    >
                      <div className="vote-head">
                        <span>{d.name}</span>
                        <span className="n">
                          {count} · {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="vote-bar">
                        <div
                          className="vote-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ TRAILER LOADER ============ */}
      {mode === "trailer" && (
        <div>
          {role === "Coach" ? (
            /* ── Coach: full editable builder ── */
            <TrailerLoader onSave={handleTrailerSave} />
          ) : trailerPlansLoading ? (
            /* ── Loading ── */
            <div
              style={{
                paddingTop: 80,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <RowLoader size={96} />
            </div>
          ) : publishedPlans.length === 0 ? (
            /* ── No published plans yet ── */
            <div className="card">
              <div
                className="card-body"
                style={{ padding: "60px 24px", textAlign: "center" }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--bg-3)",
                    border: "1px solid var(--line)",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 16px",
                    fontSize: 20,
                  }}
                >
                  🚌
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--fg-2)",
                    marginBottom: 6,
                  }}
                >
                  No trailer plan published yet
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--fg-4)",
                    lineHeight: 1.6,
                    maxWidth: 320,
                    margin: "0 auto",
                  }}
                >
                  Your coach has not published a trailer plan yet. Check back
                  closer to your next event.
                </div>
              </div>
            </div>
          ) : (
            /* ── Athlete/Cox: read-only published plans ── */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--gap)",
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                <span className="dot" /> Team trailer plans
              </div>
              {publishedPlans.map((plan) => (
                <div key={plan.id} className="card">
                  <div
                    className="card-head"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() =>
                      setExpandedPlanId((cur) =>
                        cur === plan.id ? null : plan.id,
                      )
                    }
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <h3 style={{ fontSize: 14 }}>{plan.name}</h3>
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
                          }}
                        >
                          LIVE
                        </span>
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
                        {(() => {
                          const ld = parseLayoutData(plan.layout_data);
                          return ld
                            ? `${ld.rows ?? "?"}×${ld.cols ?? "?"} · ${Object.values(ld.placements ?? {}).flat().length} boats placed`
                            : "Trailer plan";
                        })()}
                        {" · "}
                        {new Date(plan.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--fg-4)",
                        flexShrink: 0,
                      }}
                    >
                      {expandedPlanId === plan.id
                        ? "▲ Collapse"
                        : "▼ View plan"}
                    </span>
                  </div>
                  {expandedPlanId === plan.id && (
                    <div style={{ borderTop: "1px solid var(--line)" }}>
                      <TrailerLoader
                        readOnly
                        boats={
                          parseLayoutData(plan.layout_data)?.boats || teamBoats
                        }
                        initialPlacements={
                          parseLayoutData(plan.layout_data)?.placements || {}
                        }
                        initialRows={
                          parseLayoutData(plan.layout_data)?.rows || 4
                        }
                        initialCols={
                          parseLayoutData(plan.layout_data)?.cols || 3
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ MY LINEUPS ============ */}
      {mode === "mylineups" && (
        <div>
          {myLineupsLoading ? (
            <div
              style={{
                paddingTop: 80,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <RowLoader size={96} />
            </div>
          ) : myLineups.length === 0 ? (
            <div className="card">
              <div
                className="card-body"
                style={{ padding: "60px 24px", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--fg-2)",
                    marginBottom: 6,
                  }}
                >
                  No lineups yet
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--fg-4)",
                    lineHeight: 1.6,
                    maxWidth: 320,
                    margin: "0 auto",
                  }}
                >
                  Your coach hasn't assigned you to any published lineups yet.
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--gap)",
              }}
            >
              {myLineups.map((lineup) => {
                const boatType = lineup.lineup_data?.boatType ?? "8+";
                const seats = lineup.lineup_data?.seats ?? {};
                const SEAT_LABELS = {
                  "8+": ["Stroke", "7", "6", "5", "4", "3", "2", "Bow", "Cox"],
                  "4+": ["Stroke", "3", "2", "Bow", "Cox"],
                  "4-": ["Stroke", "3", "2", "Bow"],
                  "2x": ["Stroke", "Bow"],
                  "1x": ["Sculler"],
                };
                const labels = SEAT_LABELS[boatType] ?? [];
                const filledCount = Object.keys(seats).length;
                const getMember = (uid) =>
                  myLineupsMembers.find((m) => m.user_id === uid);
                const mySeats = Object.entries(seats)
                  .filter(([, uid]) => uid === user.id)
                  .map(([seat]) => seat);
                const hasCox = labels.includes("Cox");

                return (
                  <div key={lineup.id} className="card">
                    <div
                      className="card-head"
                      style={{ flexWrap: "wrap", gap: 10 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                            marginBottom: 5,
                          }}
                        >
                          {lineup.name}
                        </h3>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "var(--fg-4)",
                            letterSpacing: "0.06em",
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <span>{boatType.toUpperCase()}</span>
                          {lineup.event_name && (
                            <>
                              <span style={{ color: "var(--line-2)" }}>·</span>
                              <span>{lineup.event_name}</span>
                            </>
                          )}
                          {lineup.event_date && (
                            <>
                              <span style={{ color: "var(--line-2)" }}>·</span>
                              <span>
                                {new Date(
                                  lineup.event_date + "T00:00:00",
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </>
                          )}
                          <span style={{ color: "var(--line-2)" }}>·</span>
                          <span
                            style={{
                              color:
                                filledCount === labels.length
                                  ? "var(--good)"
                                  : "var(--fg-4)",
                            }}
                          >
                            {filledCount}/{labels.length} filled
                          </span>
                        </div>
                      </div>
                      {mySeats.length > 0 && (
                        <div
                          style={{
                            padding: "6px 12px",
                            background: "var(--accent-dim)",
                            border: "1px solid oklch(0.72 0.18 25 / 0.35)",
                            borderRadius: "var(--radius-sm)",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            className="mono"
                            style={{
                              fontSize: 9,
                              color: "var(--fg-4)",
                              letterSpacing: "0.1em",
                              marginBottom: 2,
                            }}
                          >
                            YOUR SEAT
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "var(--accent)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {mySeats.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="card-body">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {labels.map((seat) => {
                          const isCox = seat === "Cox";
                          const m = seats[seat] ? getMember(seats[seat]) : null;
                          const isMe = seats[seat] === user.id;
                          return (
                            <div key={seat}>
                              {isCox && hasCox && (
                                <div
                                  style={{
                                    height: 1,
                                    background: "var(--line)",
                                    margin: "4px 0 2px",
                                  }}
                                />
                              )}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "72px 1fr",
                                  gap: 12,
                                  alignItems: "center",
                                  minHeight: 38,
                                  padding: "6px 12px",
                                  background: isMe
                                    ? "var(--accent-dim)"
                                    : m
                                      ? "var(--bg-3)"
                                      : "var(--bg-2)",
                                  border: `1px ${m ? "solid" : "dashed"} ${isMe ? "oklch(0.72 0.18 25 / 0.4)" : m ? "var(--line-2)" : "var(--line)"}`,
                                  borderRadius: 5,
                                }}
                              >
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: "0.1em",
                                    color: isMe
                                      ? "var(--accent)"
                                      : m
                                        ? isCox
                                          ? "var(--fg-3)"
                                          : "var(--accent)"
                                        : "var(--fg-4)",
                                  }}
                                >
                                  {seat.toUpperCase()}
                                </span>
                                {seats[seat] ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      minWidth: 0,
                                    }}
                                  >
                                    {m && (
                                      <span
                                        style={{
                                          fontFamily: "var(--mono)",
                                          fontSize: 9,
                                          fontWeight: 700,
                                          padding: "2px 6px",
                                          borderRadius: 999,
                                          background:
                                            m.role === "cox"
                                              ? "var(--fg-3)"
                                              : "var(--accent)",
                                          color: "var(--accent-fg)",
                                          letterSpacing: "0.04em",
                                          flexShrink: 0,
                                        }}
                                      >
                                        {m.role === "cox" ? "COX" : "ATH"}
                                      </span>
                                    )}
                                    <span
                                      className="mono"
                                      style={{
                                        fontSize: 12,
                                        fontWeight: isMe ? 700 : 500,
                                        color: isMe
                                          ? "var(--accent)"
                                          : "var(--fg)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {m
                                        ? m.full_name ||
                                          `…${m.user_id.slice(-8)}`
                                        : `…${seats[seat].slice(-8)}`}
                                      {isMe && " (you)"}
                                    </span>
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "var(--fg-4)",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    —
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {lineup.comments_enabled && (
                      <div
                        style={{
                          borderTop: "1px solid var(--line)",
                          padding: "var(--pad)",
                        }}
                      >
                        <div className="eyebrow" style={{ marginBottom: 12 }}>
                          <span className="dot" /> Comments
                        </div>
                        <CommentSection
                          lineupId={lineup.id}
                          user={user}
                          role={role}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------- DRAG TOOLTIP ---------- */}
      {tooltipPos.visible && (
        <div
          className="drag-tip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="d">{tooltipPos.distance}m</div>
          {tooltipPos.split}
          <span style={{ color: "var(--fg-3)", marginLeft: 4 }}>/500</span>
        </div>
      )}

      {/* ---------- SAVE DIALOG ---------- */}
      {showSaveDialog && (
        <div className="modal-back" onClick={() => setShowSaveDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              <span className="dot" /> Save profile
            </div>
            <h2>Name this pacing strategy</h2>
            <input
              autoFocus
              placeholder="e.g. Sprint Start, Negative Split…"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveProfile()}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn ghost"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={saveProfile}
              >
                Save profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- TWEAKS PANEL ---------- */}
      <div className={`tweaks-panel ${tweaksOpen ? "open" : ""}`}>
        <h4>
          <span>Tweaks</span>
          <button className="close" onClick={() => setTweaksOpen(false)}>
            ×
          </button>
        </h4>
        <div className="tweak-row">
          <div className="tlabel">
            <span>Accent hue</span>
            <span className="val">{tweaks.accentHue}°</span>
          </div>
          <div className="accent-swatches">
            {[25, 55, 95, 155, 220, 290].map((h) => (
              <div
                key={h}
                className={`sw ${tweaks.accentHue === h ? "active" : ""}`}
                style={{ background: `oklch(0.72 0.18 ${h})` }}
                onClick={() => updateTweak("accentHue", h)}
              />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <div className="tlabel">
            <span>Density</span>
            <span className="val">{tweaks.density}</span>
          </div>
          <div className="density-pick">
            {["compact", "cozy", "spacious"].map((d) => (
              <button
                key={d}
                className={tweaks.density === d ? "active" : ""}
                onClick={() => updateTweak("density", d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
