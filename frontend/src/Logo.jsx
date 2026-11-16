export default function Logo({ ukuran = 36 }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 48 48" role="img" aria-label="UdaraKita">
      <defs>
        <linearGradient id="logo-cincin" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="0.35" stopColor="#eab308" />
          <stop offset="0.65" stopColor="#22c55e" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="none" stroke="url(#logo-cincin)" strokeWidth="5" />
      <path
        d="M17 31h13a5 5 0 0 0 .9-9.92A7 7 0 0 0 17.6 20.6 5.2 5.2 0 0 0 17 31Z"
        fill="#2563eb"
      />
    </svg>
  );
}
