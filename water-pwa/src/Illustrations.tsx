export function WavesHero({
  progress = 0,
  width = 520,
  height = 220
}: {
  progress?: number; // 0..1
  width?: number;
  height?: number;
}) {
  const p = Math.max(0, Math.min(1, progress));
  // altura del “agua”
  const waterY = 155 - p * 85;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(78,161,255,0.35)" />
          <stop offset="0.55" stopColor="rgba(53,208,127,0.18)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>

        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(78,161,255,0.95)" />
          <stop offset="1" stopColor="rgba(78,161,255,0.45)" />
        </linearGradient>

        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="rgba(0,0,0,0.35)" />
        </filter>

        {/* máscara del vaso */}
        <mask id="glassMask">
          <rect x="0" y="0" width={width} height={height} fill="black" />
          <rect x="330" y="32" width="140" height="170" rx="26" fill="white" />
        </mask>

        {/* máscara del agua dentro del vaso */}
        <mask id="waterMask">
          <rect x="0" y="0" width={width} height={height} fill="black" />
          <rect x="330" y="32" width="140" height="170" rx="26" fill="white" />
          {/* recortamos el agua por arriba con un rect */}
          <rect x="330" y="32" width="140" height={Math.max(0, waterY - 32)} fill="black" />
        </mask>
      </defs>

      {/* fondo suave */}
      <rect x="0" y="0" width={width} height={height} rx="22" fill="url(#bgGrad)" />

      {/* ondas del fondo */}
      <path
        d="M0 150 C 80 130, 140 190, 230 165 C 320 140, 360 110, 520 150 L520 220 L0 220 Z"
        fill="rgba(78,161,255,0.16)"
      />
      <path
        d="M0 165 C 95 145, 145 210, 260 175 C 375 140, 410 140, 520 170 L520 220 L0 220 Z"
        fill="rgba(78,161,255,0.10)"
      />

      {/* gota grande */}
      <g filter="url(#softShadow)" transform="translate(70 30)">
        <path
          d="M80 20 C 65 46, 40 72, 40 105 C 40 145, 69 174, 110 174 C 151 174, 180 145, 180 105 C 180 72, 155 46, 140 20 C 130 0, 90 0, 80 20 Z"
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.18)"
        />
        <path
          d="M90 38 C 78 58, 60 78, 60 104 C 60 132, 81 153, 110 153 C 139 153, 160 132, 160 104 C 160 78, 142 58, 130 38 C 123 25, 97 25, 90 38 Z"
          fill="url(#waterGrad)"
          opacity="0.95"
        />
        {/* brillo */}
        <path
          d="M88 86 C 83 96, 83 110, 92 121"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>

      {/* vaso a la derecha */}
      <g filter="url(#softShadow)">
        <rect
          x="330"
          y="32"
          width="140"
          height="170"
          rx="26"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.18)"
        />
        {/* agua */}
        <g mask="url(#waterMask)">
          <rect x="330" y="32" width="140" height="170" rx="26" fill="url(#waterGrad)" />
          {/* onda del agua */}
          <path
            d={`M330 ${waterY} C 360 ${waterY - 10}, 400 ${waterY + 14}, 470 ${waterY} L470 210 L330 210 Z`}
            fill="rgba(255,255,255,0.10)"
            opacity="0.9"
          >
            <animate
              attributeName="d"
              dur="3.2s"
              repeatCount="indefinite"
              values={`
                M330 ${waterY} C 360 ${waterY - 10}, 400 ${waterY + 14}, 470 ${waterY} L470 210 L330 210 Z;
                M330 ${waterY} C 360 ${waterY + 14}, 410 ${waterY - 10}, 470 ${waterY} L470 210 L330 210 Z;
                M330 ${waterY} C 360 ${waterY - 10}, 400 ${waterY + 14}, 470 ${waterY} L470 210 L330 210 Z
              `}
            />
          </path>
        </g>

        {/* reflejo del vaso */}
        <rect x="345" y="48" width="14" height="140" rx="7" fill="rgba(255,255,255,0.12)" />
      </g>
    </svg>
  );
}
