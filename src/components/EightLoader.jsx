import "./EightLoader.css";

/* Animated rowing eight — 8 oars sweeping through the stroke, rowers as
   dots, water flowing past. `spm` (strokes per minute) sets the tempo. */
const SEAT_XS = [110, 127, 144, 161, 178, 195, 212, 229];

const EightLoader = ({ spm = 32 }) => {
  const dur = (60 / spm).toFixed(2) + "s";
  const seats = SEAT_XS.map((x, i) => {
    const top = i % 2 === 0;
    return {
      x,
      groupTransform: top
        ? `translate(${x},78)`
        : `translate(${x},92) scale(1,-1)`,
    };
  });

  return (
    <svg
      className="eight-loader"
      style={{ "--dur": dur }}
      width="340"
      height="180"
      viewBox="0 0 340 170"
      role="img"
      aria-label="Rowing eight"
    >
      {/* water motion lines */}
      <g strokeWidth="2" strokeLinecap="round">
        <line
          className="water"
          x1="320"
          y1="55"
          x2="20"
          y2="55"
          strokeDasharray="8 28"
        />
        <line
          className="water"
          x1="320"
          y1="115"
          x2="20"
          y2="115"
          strokeDasharray="8 28"
        />
      </g>

      {/* boat group */}
      <g className="boat">
        {/* oars */}
        {seats.map((seat, i) => (
          <g key={`oar-${i}`} transform={seat.groupTransform}>
            <g className="oar">
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="-42"
                stroke="#C9C4BC"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect
                className="blade"
                x="-4"
                y="-60"
                width="8"
                height="18"
                rx="4"
                fill="#FB6A57"
              />
            </g>
          </g>
        ))}

        {/* hull */}
        <path
          d="M320,85 C294,89.5 264,90.5 236,90.5 L104,90.5 C76,90.5 46,89.5 20,85 C46,80.5 76,79.5 104,79.5 L236,79.5 C264,79.5 294,80.5 320,85 Z"
          fill="#F2EFEA"
        />

        {/* rowers */}
        {seats.map((seat, i) => (
          <circle key={`row-${i}`} cx={seat.x} cy="85" r="3.6" fill="#FB6A57" />
        ))}
      </g>
    </svg>
  );
};

export default EightLoader;
