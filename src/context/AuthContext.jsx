import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const PENDING_JOIN_KEY = "rowright_pending_join";

// Calls the join_team_by_code SECURITY DEFINER function.
// That function runs as its owner and bypasses all RLS, so it works
// even when a brand-new user's JWT hasn't propagated to the JS client.
const attemptTeamJoin = async (user, teamCode, role) => {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.rpc("join_team_by_code", {
      _user_id: user.id,
      _team_code: teamCode.trim(),
      _role: role,
      _full_name: user.user_metadata?.full_name || null,
      _email: user.email || null,
    });

    // RPC-level error payloads are deterministic (bad code, invalid role) — don't retry.
    if (data?.error) {
      console.error("[auth] join_team_by_code rejected:", data.error);
      localStorage.removeItem(PENDING_JOIN_KEY);
      return;
    }

    if (!error) {
      localStorage.removeItem(PENDING_JOIN_KEY);
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      console.error("[auth] join_team_by_code failed after retries:", error);
      localStorage.removeItem(PENDING_JOIN_KEY);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(null);
  const [roleReady, setRoleReady] = useState(false);
  // Track the user ID we last fetched a role for so we don't double-fetch
  const roleFetchedFor = useRef(null);

  // Derive role from the database — never trust user_metadata, which is
  // user-editable via supabase.auth.updateUser().
  const fetchRole = async (user) => {
    if (!user) {
      setRole(null);
      setRoleReady(true);
      roleFetchedFor.current = null;
      return;
    }
    if (roleFetchedFor.current === user.id) return;
    roleFetchedFor.current = user.id;
    const { data, error } = await supabase
      .from("teams")
      .select("id")
      .eq("coach_id", user.id)
      .maybeSingle();
    if (error) {
      // Don't commit a (possibly wrong) role on a transient failure — allow a retry
      // on the next auth event. Leave roleReady false so the UI keeps showing LOADING.
      console.error("[auth] fetchRole failed:", error);
      roleFetchedFor.current = null;
      return;
    }
    setRole(data ? "Coach" : "Athlete");
    setRoleReady(true);
  };

  useEffect(() => {
    // Prime session state from the stored session before the auth listener
    // settles — some supabase-js versions don't emit INITIAL_SESSION on
    // subscribe, which leaves `session` undefined and `authReady` false forever.
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only commit if onAuthStateChange hasn't already set us — avoids
      // clobbering a fresher session value with a stale stored one.
      setSession((prev) => (prev === undefined ? session : prev));
      // fetchRole has its own ref-based guard against double-fetching.
      fetchRole(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === "SIGNED_OUT") {
        setRole(null);
        setRoleReady(true);
        roleFetchedFor.current = null;
        return;
      }

      if (session?.user) {
        fetchRole(session.user);

        if (event === "SIGNED_IN") {
          const raw = localStorage.getItem(PENDING_JOIN_KEY);
          if (raw) {
            try {
              const { teamCode, role } = JSON.parse(raw);
              attemptTeamJoin(session.user, teamCode, role);
            } catch (e) {
              console.error("[auth] failed to parse pending join data:", e);
              localStorage.removeItem(PENDING_JOIN_KEY);
            }
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  const user = session?.user ?? null;
  // true once we know both whether there's a session AND what role the user has
  const authReady = session !== undefined && roleReady;

  return (
    <AuthContext.Provider value={{ session, user, role, authReady, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
