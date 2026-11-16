import { formatJam, hariDariIso } from "./i18n.js";
import { Judul } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";

export default function PerJam({ laporan }) {
  const { bahasa, t } = useIdioma();
  const jam = laporan.per_jam ?? [];
  if (jam.length === 0) return null;

  return (
    <section className="kartu perjam">
      <Judul ikon="clock">{t("perjam.judul")}</Judul>
      <p className="redup">{t("perjam.sub", { kota: laporan.kota.nama })}</p>
      <div className="strip" role="list">
        {jam.map((j, i) => (
          <div key={j.waktu} className="strip-item" role="listitem">
            <div className="strip-jam">
              {i === 0
                ? t("perjam.sekarang")
                : j.jam === "00.00"
                  ? hariDariIso(j.waktu, bahasa)
                  : formatJam(j.jam, bahasa)}
            </div>
            <div className="strip-aqi" style={{ background: j.warna, color: j.warna_teks }}>
              {j.us_aqi}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
