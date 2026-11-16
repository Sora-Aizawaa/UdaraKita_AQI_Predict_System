import Wajah from "./Wajah.jsx";
import { Ikon, IkonKondisi } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";

export default function KartuAqi({ laporan }) {
  const { t } = useIdioma();
  const data = laporan.saat_ini ?? {
    us_aqi: Math.round(laporan.hari_ini.us_aqi),
    nivel: laporan.hari_ini.nivel,
    warna: laporan.hari_ini.warna,
    warna_teks: laporan.hari_ini.warna_teks,
    polutan_utama: null,
  };
  const utama = data.polutan_utama;
  const cuaca = laporan.cuaca?.sekarang;

  return (
    <aside className="aqi" style={{ background: data.warna, color: data.warna_teks }}>
      <div className="aqi-atas">
        <div className="aqi-kotak">
          <b>{data.us_aqi}</b>
          <small>AQI⁺ US</small>
        </div>
        <div className="aqi-kategori">{t(`kategori.${data.nivel}`)}</div>
        <Wajah aqi={data.us_aqi} />
      </div>

      <div className="aqi-polutan">
        <span>
          {t("kartu.polutanUtama")}: <b>{utama?.nama ?? "—"}</b>
        </span>
        {utama?.konsentrasi != null && (
          <b>
            {utama.konsentrasi} {utama.satuan}
          </b>
        )}
      </div>

      <div className="aqi-cuaca">
        {cuaca ? (
          <>
            {cuaca.kondisi_kode && (
              <span className="aqi-kondisi">
                <IkonKondisi kode={cuaca.kondisi_kode} />
                {t(`kondisi.${cuaca.kondisi_kode}`)}
              </span>
            )}
            <span title={t("cuaca.suhu")}>
              <Ikon nama="thermometer" /> {cuaca.suhu_c ?? "—"}°
            </span>
            <span title={t("cuaca.angin")}>
              <Ikon nama="wind" /> {cuaca.angin_kmj ?? "—"} {t("satuan.kmj")}
            </span>
            <span title="%">
              <Ikon nama="droplet" /> {cuaca.kelembapan_persen ?? "—"}%
            </span>
          </>
        ) : (
          <span className="redup">{t("kartu.tanpaCuaca")}</span>
        )}
      </div>
    </aside>
  );
}
