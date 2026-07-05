// Animated rowing-shell loader. Ported from the standalone "RowRight Loading Icon"
// design. strokeRate (spm) sets the tempo: one full stroke cycle = 60 / spm seconds.
const RowLoader = ({ size = 160, strokeRate = 32, label = true }) => {
  const dur = `${(60 / strokeRate).toFixed(2)}s`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <style>{`
        @keyframes rl-oarRotate {
          0% { transform: rotate(46deg); animation-timing-function: cubic-bezier(0.45,0,0.3,1); }
          36% { transform: rotate(-32deg); animation-timing-function: cubic-bezier(0.4,0,0.55,1); }
          100% { transform: rotate(46deg); }
        }
        @keyframes rl-boatSurge {
          0% { transform: translateY(2.5px); animation-timing-function: cubic-bezier(0.45,0,0.3,1); }
          36% { transform: translateY(-2px); animation-timing-function: cubic-bezier(0.4,0,0.55,1); }
          100% { transform: translateY(2.5px); }
        }
        @keyframes rl-waterFlow {
          0% { stroke-dashoffset: 0; animation-timing-function: cubic-bezier(0.45,0,0.3,1); }
          36% { stroke-dashoffset: -26; animation-timing-function: cubic-bezier(0.4,0,0.55,1); }
          100% { stroke-dashoffset: -36; }
        }
        @keyframes rl-bladeOpacity {
          0% { opacity: 1; }
          36% { opacity: 1; }
          44% { opacity: 0.5; animation-timing-function: linear; }
          92% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        role="img"
        aria-label="Loading"
      >
        {/* water motion lines (boat moving up = water streaming down) */}
        <g stroke="#252525" strokeWidth="2" strokeLinecap="round">
          <line
            x1="46"
            y1="34"
            x2="46"
            y2="166"
            strokeDasharray="8 28"
            style={{ animation: `rl-waterFlow ${dur} linear infinite` }}
          />
          <line
            x1="154"
            y1="34"
            x2="154"
            y2="166"
            strokeDasharray="8 28"
            style={{ animation: `rl-waterFlow ${dur} linear infinite` }}
          />
        </g>

        {/* boat group: surges slightly with each drive */}
        <g style={{ animation: `rl-boatSurge ${dur} linear infinite` }}>
          {/* port oar */}
          <g
            style={{
              animation: `rl-oarRotate ${dur} linear infinite`,
              transformOrigin: "95px 100px",
            }}
          >
            <line
              x1="95"
              y1="100"
              x2="36"
              y2="100"
              stroke="#C9C4BC"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <rect
              x="18"
              y="96"
              width="20"
              height="8"
              rx="4"
              fill="#FB6A57"
              style={{ animation: `rl-bladeOpacity ${dur} linear infinite` }}
            />
          </g>

          {/* starboard oar: mirror of the port oar so both share one animation */}
          <g transform="translate(200,0) scale(-1,1)">
            <g
              style={{
                animation: `rl-oarRotate ${dur} linear infinite`,
                transformOrigin: "95px 100px",
              }}
            >
              <line
                x1="95"
                y1="100"
                x2="36"
                y2="100"
                stroke="#C9C4BC"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect
                x="18"
                y="96"
                width="20"
                height="8"
                rx="4"
                fill="#FB6A57"
                style={{ animation: `rl-bladeOpacity ${dur} linear infinite` }}
              />
            </g>
          </g>

          {/* hull */}
          <path
            d="M100,16 C104.5,42 105.5,72 105.5,100 C105.5,128 104.5,158 100,184 C95.5,158 94.5,128 94.5,100 C94.5,72 95.5,42 100,16 Z"
            fill="#F2EFEA"
          />

          {/* cockpit + rower */}
          <rect
            x="96.6"
            y="86"
            width="6.8"
            height="28"
            rx="3.4"
            fill="#141414"
          />
          <circle cx="100" cy="97" r="3.2" fill="#FB6A57" />
        </g>
      </svg>

      {label && (
        <div
          style={{
            fontFamily: "'JetBrains Mono','SF Mono',ui-monospace,monospace",
            fontSize: 12,
            letterSpacing: "0.35em",
            color: "#7A7A7A",
            paddingLeft: "0.35em",
          }}
        >
          LOADING
        </div>
      )}
    </div>
  );
};

export default RowLoader;
