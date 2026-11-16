const MULUT = [
  "M14 28 Q24 38 34 28", // 0 baik
  "M15 30 Q24 35 33 30", // 1 sedang
  "M15 32 L33 32", // 2 sensitif
  "M15 34 Q24 29 33 34", // 3 tidak sehat
  "M14 36 Q24 26 34 36", // 4 sangat tidak sehat
  "M14 37 Q24 24 34 37", // 5 berbahaya
];

export function tingkat(aqi) {
  return aqi <= 50
    ? 0
    : aqi <= 100
      ? 1
      : aqi <= 150
        ? 2
        : aqi <= 200
          ? 3
          : aqi <= 300
            ? 4
            : 5;
}

export default function Wajah({ aqi, ukuran = 56 }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 22 C10 8 38 8 38 22 C38 36 32 44 24 44 C16 44 10 36 10 22 Z" />
      <circle cx="18" cy="21" r="1.4" fill="currentColor" />
      <circle cx="30" cy="21" r="1.4" fill="currentColor" />
      <path d={MULUT[tingkat(aqi)]} />
    </svg>
  );
}
