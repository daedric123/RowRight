import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

const Login = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // navigation handled by useEffect once session propagates to context
  };

  return (
    <AuthLayout>
      <div className="rr-card">
        <div className="rr-card-head">
          <span className="title">Sign in</span>
          <span className="eyebrow">
            <span className="dot" />
            Secure access
          </span>
        </div>
        <form className="rr-card-body" onSubmit={handleSubmit}>
          <div className="rr-field">
            <span className="rr-field-label">Email</span>
            <input
              className="rr-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="rr-field">
            <span className="rr-field-label">Password</span>
            <input
              className="rr-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="rr-error">{error}</div>}

          <button type="submit" className="rr-btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="rr-card-foot">
          No account?{" "}
          <Link to="/signup" className="rr-link">
            Create one
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Login;
