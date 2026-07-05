import "./../pages/auth.css";

/* Shared split layout for the Sign in / Create account pages.
   Left: marketing panel. Right (or below, on phone): the auth card
   passed in as children. */
const AuthLayout = ({ children }) => (
  <div className="auth-wrap">
    <div className="auth-marketing">
      {/* Brand */}
      <div className="auth-brand">
        <div className="mark">R</div>
        <div>
          <div className="brand-name">
            <b>RowRight</b>
            <span> / Performance</span>
          </div>
          <div className="brand-ver">v2.0 · Calibrated</div>
        </div>
      </div>

      {/* Hero */}
      <div className="auth-hero">
        <h1>The operating system for your rowing team.</h1>
        <p>
          Coaches build the roster and lineups; athletes and coxes see it live
          from their phone. One team code, one shared plan.
        </p>
      </div>

      {/* Role cards — desktop */}
      <div className="auth-desktop-only">
        <div>
          <div className="auth-kicker">Built for every role</div>
          <div className="auth-roles">
            <div className="auth-role">
              <div className="ico">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="4" width="14" height="17" rx="2" />
                  <rect x="9" y="2" width="6" height="4" rx="1" />
                  <line x1="8" y1="11" x2="16" y2="11" />
                  <line x1="8" y1="15" x2="16" y2="15" />
                </svg>
              </div>
              <div className="name">Coach</div>
              <div className="desc">
                Full control: roster, lineups, trailer plans. Pays per seat.
              </div>
            </div>
            <div className="auth-role">
              <div className="ico">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
                </svg>
              </div>
              <div className="name">Athlete</div>
              <div className="desc">
                Joins with a team code — views lineups, plans, and comments.
              </div>
            </div>
            <div className="auth-role">
              <div className="ico">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="8" />
                  <line x1="12" y1="4" x2="12" y2="8" />
                  <line x1="12" y1="16" x2="12" y2="20" />
                </svg>
              </div>
              <div className="name">Cox</div>
              <div className="desc">
                Same access as an athlete — always knows the plan.
              </div>
            </div>
          </div>
        </div>

        {/* Feature grid — desktop */}
        <div className="auth-features">
          <div className="auth-feature">
            <div className="ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8" cy="12" r="1.4" />
                <circle cx="12" cy="12" r="1.4" />
                <circle cx="16" cy="12" r="1.4" />
              </svg>
            </div>
            <div>
              <div className="name">Lineup builder</div>
              <div className="sub">Drag rowers into seats, multiple boats</div>
            </div>
          </div>
          <div className="auth-feature">
            <div className="ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="8" width="20" height="6" rx="1" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="17" cy="18" r="2" />
              </svg>
            </div>
            <div>
              <div className="name">Trailer load planner</div>
              <div className="sub">Visual layout for travel day</div>
            </div>
          </div>
          <div className="auth-feature">
            <div className="ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="4" x2="7" y2="20" />
                <line x1="17" y1="4" x2="14" y2="20" />
              </svg>
            </div>
            <div>
              <div className="name">Team code sharing</div>
              <div className="sub">One code, instant join</div>
            </div>
          </div>
          <div className="auth-feature">
            <div className="ico">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3,17 9,10 13,13 21,4" />
              </svg>
            </div>
            <div>
              <div className="name">2K split predictor</div>
              <div className="sub">Pacing from your saved profile</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature chips — phone */}
      <div className="auth-mobile-only">
        <div className="auth-chips">
          <div className="auth-chip">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="#76767A"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8" cy="12" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="16" cy="12" r="1.4" />
            </svg>
            <span>Lineups</span>
          </div>
          <div className="auth-chip">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="#76767A"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="8" width="20" height="6" rx="1" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
            <span>Trailer plans</span>
          </div>
          <div className="auth-chip">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="#76767A"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3,17 9,10 13,13 21,4" />
            </svg>
            <span>2K splits</span>
          </div>
        </div>
      </div>

      {/* Coming soon */}
      <div className="auth-soon">
        <span className="tag">COMING SOON</span>
        <span className="txt">
          Global &amp; team rankings from Concept2 Logbook · boat↔erg speed
          calculator
        </span>
      </div>
    </div>

    <div className="auth-panel">{children}</div>
  </div>
);

export default AuthLayout;
