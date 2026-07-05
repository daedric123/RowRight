const KitPreview = ({ pattern }) => {
  const accent = 'var(--accent)';
  const base = 'var(--bg-3)';
  const stroke = 'var(--fg-4)';
  return (
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="jersey">
          <path d="M25 15 L40 10 L60 10 L75 15 L92 25 L84 40 L72 36 L72 105 L28 105 L28 36 L16 40 L8 25 Z" />
        </clipPath>
      </defs>
      {/* base */}
      <path d="M25 15 L40 10 L60 10 L75 15 L92 25 L84 40 L72 36 L72 105 L28 105 L28 36 L16 40 L8 25 Z"
        fill={base} stroke={stroke} strokeWidth="0.5" />
      {/* pattern */}
      <g clipPath="url(#jersey)">
        {pattern === 'wave' && <>
          <path d="M0 60 Q25 50 50 60 T100 60 L100 70 Q75 60 50 70 T0 70 Z" fill={accent} />
          <path d="M0 75 Q25 68 50 75 T100 75 L100 80 Q75 73 50 80 T0 80 Z" fill={accent} opacity="0.5" />
        </>}
        {pattern === 'stripes' && <>
          <rect x="36" y="0" width="6" height="120" fill={accent} />
          <rect x="58" y="0" width="6" height="120" fill={accent} opacity="0.6" />
        </>}
        {pattern === 'sleeves' && <>
          <path d="M8 25 L16 40 L28 36 L28 48 L12 44 Z" fill={accent} />
          <path d="M92 25 L84 40 L72 36 L72 48 L88 44 Z" fill={accent} />
          <circle cx="50" cy="55" r="6" fill="none" stroke={accent} strokeWidth="1.5" />
        </>}
        {pattern === 'blocks' && <>
          <rect x="0" y="60" width="100" height="45" fill={accent} />
          <text x="50" y="45" textAnchor="middle" fill="var(--fg-2)" fontFamily="JetBrains Mono" fontSize="8" fontWeight="700">RR</text>
        </>}
      </g>
    </svg>
  );
};

export default KitPreview;
