import { useCallback, useEffect, useState } from "react";
import { ambilLaporan, ambilPeta, daftarKota } from "./api";
import { formatWaktu } from "./i18n.js";
import { pesanGalat } from "./galat.js";
import { Judul } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";
import Header from "./Header.jsx";
import KartuAqi from "./KartuAqi.jsx";
import PerJam from "./PerJam.jsx";
import Trend from "./Trend.jsx";
import { CuacaBmkg, CuacaOpenMeteo } from "./Cuaca.jsx";
import LaporanModel from "./LaporanModel.jsx";
import Peta from "./Peta.jsx";

const RUTE = { "#/peta": "peta", "#/laporan-model": "model" };
const HASH = { udara: "#/", peta: "#/peta", model: "#/laporan-model" };
const halamanDariHash = () => RUTE[window.location.hash] ?? "udara";

function simpanKota(id) {
  try {
    localStorage.setItem("kota", id);
  } catch {
    /* abaikan */
  }
}
function kotaTersimpan() {
  try {
    return localStorage.getItem("kota") || "jakarta";
  } catch {
    return "jakarta";
  }
}

export default function App() {
  const { bahasa, t } = useIdioma();
  const [kota, setKota] = useState([]);
  const [pilihan, setPilihan] = useState(kotaTersimpan);
  const [laporan, setLaporan] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState(null);
  const [lambat, setLambat] = useState(false);
  const [halaman, setHalaman] = useState(halamanDariHash());

  // peta: dimuat sekali saat halaman peta dibuka pertama kali
  const [peta, setPeta] = useState(null);
  const [memuatPeta, setMemuatPeta] = useState(false);
  const [galatPeta, setGalatPeta] = useState(null);
  const [lambatPeta, setLambatPeta] = useState(false);

  useEffect(() => {
    const f = () => setHalaman(halamanDariHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const pindahHalaman = useCallback((h) => {
    window.location.hash = HASH[h] ?? "#/";
  }, []);

  useEffect(() => {
    daftarKota()
      .then(setKota)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (halaman !== "udara") return;
    const kendali = new AbortController();
    setMemuat(true);
    setGalat(null);
    setLambat(false);
    simpanKota(pilihan);
    ambilLaporan(pilihan, { signal: kendali.signal, onLambat: () => setLambat(true) })
      .then((d) => {
        setLaporan(d);
        setMemuat(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setGalat(e);
          setLaporan(null);
          setMemuat(false);
        }
      });
    return () => kendali.abort();
  }, [pilihan, halaman]);

  useEffect(() => {
    if (halaman !== "peta" || peta) return;
    const kendali = new AbortController();
    setMemuatPeta(true);
    setGalatPeta(null);
    ambilPeta({ signal: kendali.signal, onLambat: () => setLambatPeta(true) })
      .then((d) => {
        setPeta(d);
        setMemuatPeta(false);
        setLambatPeta(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setGalatPeta(e);
          setMemuatPeta(false);
        }
      });
    return () => kendali.abort();
  }, [halaman, peta]);

  const bukaKota = useCallback(
    (id) => {
      setPilihan(id);
      pindahHalaman("udara");
    },
    [pindahHalaman],
  );

  const p = laporan?.prediksi_besok;
  const warnaLatar = laporan?.saat_ini?.warna ?? laporan?.hari_ini?.warna ?? "#e2e8f0";

  return (
    <>
      <Header
        kota={kota}
        pilihan={pilihan}
        onPilih={setPilihan}
        halaman={halaman}
        onHalaman={pindahHalaman}
      />

      {halaman === "model" ? (
        <LaporanModel />
      ) : halaman === "peta" ? (
        <Peta
          data={peta}
          memuat={memuatPeta}
          lambat={lambatPeta}
          galat={pesanGalat(galatPeta, t)}
          onBuka={bukaKota}
        />
      ) : (
        <main
          id="laporan"
          style={{ backgroundImage: `linear-gradient(180deg, ${warnaLatar}33, transparent 420px)` }}
        >
          <div className="isi">
            {memuat && (
              <p className="redup">
                {t("memuat.laporan")} {lambat && <span className="lambat">{t("memuat.lambat")}</span>}
              </p>
            )}
            {galat && <div className="galat">{pesanGalat(galat, t)}</div>}

            {laporan && !memuat && (
              <>
                <nav className="remah" aria-label="Lokasi">
                  {t("remah.dunia")} / {t("remah.negara")} / {laporan.kota.provinsi} /{" "}
                  <b>{laporan.kota.nama}</b>
                </nav>

                <section className="hero">
                  <div>
                    <h1>{t("hero.judul", { kota: laporan.kota.nama })}</h1>
                    <p className="sub">
                      {t("hero.sub", {
                        kota: laporan.kota.nama,
                        waktu: formatWaktu(laporan.saat_ini?.waktu ?? laporan.diperbarui, bahasa),
                      })}
                    </p>
                    <details className="atribusi">
                      <summary>{t("atribusi.judul")}</summary>
                      <ul>
                        <li>{t("atribusi.1")}</li>
                        <li>{t("atribusi.2")}</li>
                      </ul>
                    </details>
                  </div>
                  <KartuAqi laporan={laporan} />
                </section>

                <PerJam laporan={laporan} />

                <section id="prediksi" className="kartu">
                  <Judul ikon="gauge">{t("besok.judul", { tanggal: p?.tanggal ?? "—" })}</Judul>
                  {p ? (
                    <div className="prediksi">
                      <div
                        className="prediksi-angka"
                        style={{ background: p.warna, color: p.warna_teks }}
                      >
                        {p.us_aqi}
                      </div>
                      <div>
                        <b>{t(`kategori.${p.nivel}`)}</b>
                        <p>
                          {t("besok.rentang", { a: p.rentang[0], b: p.rentang[1] })}{" "}
                          <span className="redup">
                            {t("besok.galat", { x: p.galat_rata_rata_uji })}
                          </span>
                        </p>
                        {laporan.prakiraan_cams_besok && (
                          <p className="redup">
                            {t("besok.cams", { x: laporan.prakiraan_cams_besok.us_aqi })}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="redup">{t("besok.tanpaModel")}</p>
                      {laporan.prakiraan_cams_besok && (
                        <p>
                          {t("besok.cams", { x: laporan.prakiraan_cams_besok.us_aqi })} (
                          {t(`kategori.${laporan.prakiraan_cams_besok.nivel}`)})
                        </p>
                      )}
                    </>
                  )}
                  <p className="saran">{t(`saran.${laporan.hari_ini.nivel}`)}</p>
                </section>

                <Trend laporan={laporan} />

                <section className="tiga">
                  <div className="kartu">
                    <Judul ikon="activity">{t("polutan.judul")}</Judul>
                    <table>
                      <tbody>
                        {Object.entries(laporan.polutan).map(([k, v]) => (
                          <tr key={k}>
                            <td>{t(`polutan.${k}`)}</td>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="redup">{t("polutan.aqiRata", { x: laporan.hari_ini.us_aqi })}</p>
                  </div>
                  <CuacaOpenMeteo cuaca={laporan.cuaca} />
                  <CuacaBmkg cuaca={laporan.cuaca} />
                </section>

                <footer id="tentang">
                  <p>{t("footer.1", { waktu: formatWaktu(laporan.diperbarui, bahasa) })}</p>
                  <p>{t("footer.2")}</p>
                  <p>{t("footer.3")}</p>
                </footer>
              </>
            )}
          </div>
        </main>
      )}
    </>
  );
}
