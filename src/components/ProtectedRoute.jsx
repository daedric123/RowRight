import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RowLoader from "./RowLoader";

// If auth never resolves (e.g. the Supabase project is paused/unreachable and
// fetchRole can't complete), don't trap the user on an infinite loader — after
// this long, surface an actionable fallback instead.
const AUTH_TIMEOUT_MS = 12000;

const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
};

const ProtectedRoute = ({ children }) => {
  const { session, authReady } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (authReady) return;
    const t = setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [authReady]);

  if (!authReady) {
    if (timedOut)
      return (
        <div style={wrap}>
          <div
            style={{ textAlign: "center", maxWidth: 340, padding: "0 24px" }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--fg-2)",
                marginBottom: 8,
              }}
            >
              Can't reach the server
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--fg-4)",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              The backend may be waking up or temporarily unavailable. Retry in
              a moment, or sign in again if the problem persists.
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
              }}
            >
              <button
                className="btn primary sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
              <Link
                to="/login"
                className="btn ghost sm"
                style={{ textDecoration: "none" }}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      );

    return (
      <div style={wrap}>
        <RowLoader />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;
