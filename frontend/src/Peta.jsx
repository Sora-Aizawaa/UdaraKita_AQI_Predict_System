import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  SKALA_HUJAN,
  SKALA_SUHU,
  WARNA_AQI,
  warnaAqi,
  warnaSkala,
} from "./i18n.js";
import { Ikon, Judul } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";

const LAPISAN = ["aqiSekarang", "aqiBesok", "suhu", "hujan"];

/** Nilai, label, dan warna sebuah kota pada lapisan yang dipilih. */
function tampilan(k, lapisan) {
  if (lapisan === "aqiSekarang" || lapisan === "aqiBesok") {
    const v = lapisan === "aqiSekarang" ? k.aqi_sekarang : k.aqi_besok;
    if (v == null) return null;
    const w = warnaAqi(v);
    return { label: String(v), warna: w.warna, teks: w.teks };
  }
  if (lapisan === "suhu") {
    if (k.suhu_c == null) return null;
    const s = warnaSkala(SKALA_SUHU, k.suhu_c);
    return { label: `${Math.round(k.suhu_c)}°`, warna: s.warna, teks: s.teks };
  }
  if (k.hujan_mm == null) return null;
  const s = warnaSkala(SKALA_HUJAN, k.hujan_mm);
  return { label: String(k.hujan_mm), warna: s.warna, teks: s.teks };
}

function Kunci({ lapisan }) {
  const { t } = useIdioma();
  let butir;
  if (lapisan === "suhu") butir = SKALA_SUHU.map((s) => ({ warna: s.warna, label: s.label }));
  else if (lapisan === "hujan") butir = SKALA_HUJAN.map((s) => ({ warna: s.warna, label: s.label }));
  else butir = WARNA_AQI.map((w, i) => ({ warna: w.warna, label: t(`kategori.${i}`) }));
  return (
    <div className="kunci">
      <b>{t("peta.kunci")}</b>
      {butir.map((b) => (
        <span key={b.label}>
          <i style={{ background: b.warna }} />
          {b.label}
        </span>
      ))}
    </div>
  );
}

function Lencana({ nilai, lapisan, k }) {
  const tp = tampilan(k, lapisan);
  if (!tp) return <span className="redup">—</span>;
  return (
    <span className="lencana" style={{ background: tp.warna, color: tp.teks }}>
      {nilai ?? tp.label}
    </span>
  );
}

export default function Peta({ data, memuat, galat, lambat, onBuka }) {
  const { t } = useIdioma();
  const [lapisan, setLapisan] = useState("aqiSekarang");
  const wadah = useRef(null);
  const peta = useRef(null);
  const grup = useRef(null);
  const sudahPas = useRef(false);

  const kota = useMemo(() => data?.kota ?? [], [data]);

  // buat peta sekali
  useEffect(() => {
    if (!wadah.current || peta.current) return;
    const m = L.map(wadah.current, { center: [-2.5, 118], zoom: 5, minZoom: 3, worldCopyJump: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    grup.current = L.layerGroup().addTo(m);
    peta.current = m;
    return () => {
      m.remove();
      peta.current = null;
      sudahPas.current = false;
    };
  }, []);

  // gambar ulang penanda saat data, lapisan, atau bahasa berubah
  useEffect(() => {
    const m = peta.current;
    if (!m || !grup.current) return;
    grup.current.clearLayers();
    const titik = [];
    kota.forEach((k) => {
      const tp = tampilan(k, lapisan);
      if (!tp) return;
      const ikon = L.divIcon({
        className: "pin-peta",
        html: `<span style="background:${tp.warna};color:${tp.teks}">${tp.label}</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const mk = L.marker([k.lat, k.lon], {
        icon: ikon,
        title: k.nama,
        riseOnHover: true,
        zIndexOffset: Math.round((k.aqi_sekarang ?? 0) * 10),
      });
      const isi = document.createElement("div");
      isi.className = "pop-peta";
      const nama = document.createElement("b");
      nama.textContent = `${k.nama}, ${k.provinsi}`;
      isi.appendChild(nama);
      const baris = (teks) => {
        const p = document.createElement("div");
        p.textContent = teks;
        isi.appendChild(p);
      };
      baris(`${t("peta.lapisan.aqiSekarang")}: ${k.aqi_sekarang ?? "—"}`);
      baris(`${t("peta.lapisan.aqiBesok")}: ${k.aqi_besok ?? "—"}${k.sumber_besok === "cams" ? " *" : ""}`);
      baris(`${t("peta.suhu")}: ${k.suhu_c ?? "—"}°C`);
      baris(`${t("peta.hujan")}: ${k.hujan_mm ?? "—"} mm`);
      const tautan = document.createElement("a");
      tautan.href = "#/";
      tautan.textContent = t("peta.buka");
      tautan.onclick = (e) => {
        e.preventDefault();
        onBuka(k.id);
      };
      isi.appendChild(tautan);
      mk.bindPopup(isi);
      mk.addTo(grup.current);
      titik.push([k.lat, k.lon]);
    });
    if (titik.length && !sudahPas.current) {
      m.fitBounds(titik, { padding: [40, 40], maxZoom: 6 });
      sudahPas.current = true;
    }
  }, [kota, lapisan, t, onBuka]);

  return (
    <main>
      <div className="isi">
        <Judul ikon="map" tag="h1">
          {t("peta.judul")}
        </Judul>
        <p className="sub">{t("peta.sub")}</p>

        <div className="lapisan" role="tablist">
          <Ikon nama="layers" />
          {LAPISAN.map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={l === lapisan}
              className={l === lapisan ? "aktif" : ""}
              onClick={() => setLapisan(l)}
            >
              {t(`peta.lapisan.${l}`)}
            </button>
          ))}
        </div>

        {memuat && (
          <p className="redup">
            {t("memuat.peta")} {lambat && <span className="lambat">{t("memuat.lambat")}</span>}
          </p>
        )}
        {galat && <div className="galat">{galat}</div>}

        <div className="peta-wadah" ref={wadah} />
        <Kunci lapisan={lapisan} />

        {kota.length > 0 && (
          <section className="kartu ringkasan-peta">
            <Judul ikon="map">{t("peta.ringkasan")}</Judul>
            <table>
              <thead>
                <tr>
                  <th>{t("peta.kota")}</th>
                  <th>{t("peta.lapisan.aqiSekarang")}</th>
                  <th>{t("peta.lapisan.aqiBesok")}</th>
                  <th>
                    <Ikon nama="thermometer" ukuran={14} /> {t("peta.suhu")}
                  </th>
                  <th>
                    <Ikon nama="cloudRain" ukuran={14} /> {t("peta.hujan")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kota.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <a
                        className="tautan"
                        href="#/"
                        onClick={(e) => {
                          e.preventDefault();
                          onBuka(k.id);
                        }}
                      >
                        {k.nama}
                      </a>
                    </td>
                    <td>
                      <Lencana lapisan="aqiSekarang" k={k} />
                    </td>
                    <td>
                      <Lencana
                        lapisan="aqiBesok"
                        k={k}
                        nilai={k.aqi_besok != null ? `${k.aqi_besok}${k.sumber_besok === "cams" ? " *" : ""}` : null}
                      />
                    </td>
                    <td>{k.suhu_c != null ? `${k.suhu_c}°C` : "—"}</td>
                    <td>{k.hujan_mm != null ? `${k.hujan_mm} mm` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {kota.some((k) => k.sumber_besok === "cams") && (
              <p className="redup kecil">{t("peta.catatanBesok")}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
