// Ikon garis (gaya Lucide) ditulis langsung sebagai SVG supaya tidak butuh pustaka tambahan.
const P = {
  cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  cloudSun: (
    <>
      <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
    </>
  ),
  cloudRain: (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" />
      <path d="M16 14v6M8 14v6M12 16v6" />
    </>
  ),
  cloudLightning: (
    <>
      <path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97" />
      <path d="m13 12-3 5h4l-3 5" />
    </>
  ),
  cloudFog: (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24" />
      <path d="M16 17H7M17 21H9" />
    </>
  ),
  thermometer: <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />,
  wind: <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2" />,
  droplet: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
  map: <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />,
  layers: (
    <>
      <path d="m12 2 10 5-10 5L2 7z" />
      <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  gauge: (
    <>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </>
  ),
  trendingUp: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" />,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  barChart: <path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-8" />,
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" />
    </>
  ),
};

export function Ikon({ nama, ukuran = 18, kelas = "", ...sisa }) {
  return (
    <svg
      className={`ikon ${kelas}`}
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...sisa}
    >
      {P[nama] ?? P.cloud}
    </svg>
  );
}

const KONDISI_IKON = {
  clear: "sun",
  partly: "cloudSun",
  cloudy: "cloud",
  haze: "cloudFog",
  fog: "cloudFog",
  light_rain: "cloudRain",
  rain: "cloudRain",
  heavy_rain: "cloudRain",
  thunder: "cloudLightning",
};
export function IkonKondisi({ kode, ukuran = 18 }) {
  return <Ikon nama={KONDISI_IKON[kode] ?? "cloud"} ukuran={ukuran} />;
}

/** Judul kartu dengan ikon di kiri. */
export function Judul({ ikon, children, tag: Tag = "h3" }) {
  return (
    <Tag className="judul-ikon">
      <Ikon nama={ikon} />
      <span>{children}</span>
    </Tag>
  );
}
