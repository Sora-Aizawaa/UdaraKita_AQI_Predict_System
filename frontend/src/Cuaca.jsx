import { formatSlotBmkg, formatTanggal } from "./i18n.js";
import { IkonKondisi, Judul } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";

function Kondisi({ kode }) {
  const { t } = useIdioma();
  return (
    <span className="kondisi">
      <IkonKondisi kode={kode} />
      {t(`kondisi.${kode ?? "unknown"}`)}
    </span>
  );
}

const angka = (v, satuan = "") => (v == null ? "—" : `${v}${satuan}`);

/** Kotak prakiraan harian dari Open-Meteo. */
export function CuacaOpenMeteo({ cuaca }) {
  const { bahasa, t } = useIdioma();
  const harian = cuaca?.open_meteo?.harian;
  return (
    <div className="kartu">
      <Judul ikon="cloudSun">{t("cuaca.om")}</Judul>
      {!harian ? (
        <p className="redup">{t("cuaca.tidakAda")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("cuaca.tanggal")}</th>
              <th>{t("cuaca.kondisi")}</th>
              <th>{t("cuaca.suhu")}</th>
              <th>{t("cuaca.hujan")}</th>
            </tr>
          </thead>
          <tbody>
            {harian.map((h) => (
              <tr key={h.tanggal}>
                <td>{formatTanggal(h.tanggal, bahasa)}</td>
                <td>
                  <Kondisi kode={h.kondisi_kode} />
                </td>
                <td>
                  {h.suhu_min_c}–{h.suhu_maks_c}°C
                </td>
                <td>{angka(h.hujan_mm, " mm")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Kotak prakiraan per 3 jam dari BMKG (hanya kota yang punya kode `bmkg_adm4` di cities.json). */
export function CuacaBmkg({ cuaca }) {
  const { t } = useIdioma();
  const b = cuaca?.bmkg;
  return (
    <div className="kartu">
      <Judul ikon="cloud">{t("cuaca.bmkg")}</Judul>
      {!b ? (
        <p className="redup">
          {cuaca?.bmkg_didukung === false ? t("cuaca.bmkgTidakAda") : t("cuaca.bmkgGagal")}
        </p>
      ) : (
        <>
          {b.lokasi && <p className="redup kecil">{t("cuaca.lokasi", { x: b.lokasi })}</p>}
          <table>
            <thead>
              <tr>
                <th>{t("cuaca.waktu")}</th>
                <th>{t("cuaca.kondisi")}</th>
                <th>{t("cuaca.suhu")}</th>
                <th>{t("cuaca.hujan")}</th>
              </tr>
            </thead>
            <tbody>
              {b.prakiraan.map((p) => (
                <tr key={p.waktu}>
                  <td>{formatSlotBmkg(p.waktu)}</td>
                  <td>
                    <Kondisi kode={p.kondisi_kode} />
                  </td>
                  <td>{angka(p.suhu_c, "°C")}</td>
                  <td>{angka(p.hujan_mm, " mm")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
