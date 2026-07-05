import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

const ROLES = ["Coach", "Athlete", "Cox"];

const SignUp = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const intendedPath = useRef(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Athlete");
  const [teamCode, setTeamCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const needsTeamCode = role === "Athlete" || role === "Cox";

  useEffect(() => {
    if (session && intendedPath.current) {
      navigate(intendedPath.current, { replace: true });
    }
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Pre-submit validation — athletes and coxes must supply a team code
    if (needsTeamCode && !teamCode.trim()) {
      setError("Please enter your team code");
      return;
    }

    setLoading(true);

    // ── Step 1: store pending join in localStorage BEFORE signUp ──
    // AuthContext's onAuthStateChange will pick this up once the session
    // is fully established and insert the team_members row at that point.
    if (needsTeamCode) {
      const pendingJoin = JSON.stringify({
        teamCode: teamCode.trim().toUpperCase(),
        role,
      });
      localStorage.setItem("rowright_pending_join", pendingJoin);
    }

    // ── Step 2: create the auth account ──────────────────────
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    if (signUpError) {
      console.error("[signup] auth.signUp error:", signUpError);
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // navigation handled by useEffect once session propagates to context
    intendedPath.current = needsTeamCode ? "/pending" : "/dashboard";
  };

  return (
    <AuthLayout>
      <div className="rr-card">
        <div className="rr-card-head">
          <span className="title">Create account</span>
          <span className="eyebrow">
            <span className="dot" />
            Join your team
          </span>
        </div>
        <form className="rr-card-body" onSubmit={handleSubmit}>
          <div className="rr-field">
            <span className="rr-field-label">Full name</span>
            <input
              className="rr-input"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
            />
          </div>

          <div className="rr-field">
            <span className="rr-field-label">Email</span>
            <input
              className="rr-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="rr-field">
            <span className="rr-field-label">Password</span>
            <input
              className="rr-input"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {/* Role toggle */}
          <div className="rr-field">
            <span className="rr-field-label">Role</span>
            <div className="rr-roles">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rr-role-btn${role === r ? " active" : ""}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Team code — required for Athlete / Cox */}
          {needsTeamCode && (
            <div className="rr-field">
              <span className="rr-field-label">Team code</span>
              <input
                className="rr-input mono"
                type="text"
                placeholder="e.g. CAMB-2025"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                autoComplete="off"
              />
              <span className="rr-field-hint">
                Ask your coach for the team code.
              </span>
            </div>
          )}

          {error && <div className="rr-error">{error}</div>}

          <button type="submit" className="rr-btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <div className="rr-card-foot">
          Already have an account?{" "}
          <Link to="/login" className="rr-link">
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default SignUp;
