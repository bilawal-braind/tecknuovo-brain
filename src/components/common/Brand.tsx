// Tecknuovo "tn" mark (their real glyph) co-branded with BraindAI.
export function TnMark({ size = 30, color = '#131720' }: { size?: number; color?: string }) {
  const w = size
  const h = (size * 86) / 118
  return (
    <svg width={w} height={h} viewBox="0 0 118 86" fill="none" aria-label="Tecknuovo">
      <path
        d="M36.54 68.16C33.59 68.16 31.36 67.44 29.84 66.01C28.32 64.58 27.56 62.3 27.56 59.18V30.7H44.72V15.49H27.56V15.47H21.5V13.69C25.15 13.36 27.34 10.37 27.52 4.87V0.299997L27.57 0.279999H16.91L15.48 8.99C15.13 11.51 14.26 13.26 12.88 14.26C11.49 15.26 9.33 15.8 6.38 15.88H0.26L0 30.18H9.62V60.09C9.62 68.85 11.42 75.24 15.02 79.27C18.62 83.3 24.27 85.32 31.99 85.32C33.72 85.32 35.7 85.19 37.91 84.93C40.12 84.67 42.57 84.11 45.26 83.24V65.95C44.05 66.73 42.68 67.3 41.16 67.64C39.64 67.99 38.1 68.16 36.54 68.16Z"
        fill={color}
      />
      <path
        d="M52.01 83.76V15.49H67.35L67.22 36.95H69C70.13 31.75 72.27 27.42 74.31 23.95C76.35 20.48 78.95 17.9 82.11 16.21C85.27 14.52 89.07 13.67 93.49 13.67C101.29 13.67 107.23 16.42 111.3 21.93C115.37 27.44 117.41 36 117.41 47.61V83.76H98.69V49.69C98.69 42.67 97.65 37.53 95.57 34.28C93.49 31.03 90.45 29.4 86.47 29.4C83 29.4 80.12 30.46 77.82 32.59C75.52 34.72 73.77 37.62 72.55 41.3C71.33 44.98 70.73 49.12 70.73 53.72V83.76H52.01Z"
        fill={color}
      />
    </svg>
  )
}

export function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <TnMark size={30} />
      <div className="leading-tight">
        <div className="text-[14px] font-bold tracking-tight">
          Tecknuovo <span className="text-muted-2 font-medium">× BraindAI</span>
        </div>
        <div className="text-[11px] text-muted-2">Second Brain</div>
      </div>
    </div>
  )
}
