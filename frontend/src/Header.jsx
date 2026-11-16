import { useMemo, useState } from "react";
import { BAHASA } from "./i18n.js";
import { useIdioma } from "./idioma.jsx";
import { Ikon } from "./icons.jsx";
import Logo from "./Logo.jsx";

const TAB = [
  { id: "udara", ikon: "activity", kunci: "nav.udara" },
  { id: "peta", ikon: "map", kunci: "nav.peta" },
  { id: "model", ikon: "fileText", kunci: "nav.model" },
];

export default function Header({ kota, pilihan, onPilih, halaman, onHalaman }) {
  const { bahasa, setBahasa, t } = useIdioma();
  const [q, setQ] = useState("");
  const [buka, setBuka] = useState(false);

  const hasil = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return kota;
    return kota.filter((k) => `${k.nama} ${k.provinsi}`.toLowerCase().includes(s));
  }, [q, kota]);

  function pilih(id) {
    onPilih(id);
    setQ("");
    setBuka(false);
  }

  return (
    <>
      <div className="banner">{t("banner")}</div>
      <header className="kepala">
        <a className="logo" href="#/" onClick={() => onHalaman("udara")}>
          <Logo />
          <span>UdaraKita</span>
        </a>
        <div className="kepala-kanan">
          <nav className="tab-utama" aria-label={t("nav.aria")}>
            {TAB.map((x) => (
              <button
                key={x.id}
                className={halaman === x.id ? "aktif" : ""}
                aria-current={halaman === x.id ? "page" : undefined}
                onClick={() => onHalaman(x.id)}
              >
                <Ikon nama={x.ikon} ukuran={16} />
                {t(x.kunci)}
              </button>
            ))}
          </nav>
          <div className="bahasa" role="group" aria-label="Language">
            {BAHASA.map((b) => (
              <button
                key={b.kode}
                className={bahasa === b.kode ? "aktif" : ""}
                aria-pressed={bahasa === b.kode}
                onClick={() => setBahasa(b.kode)}
                lang={b.kode}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {halaman === "udara" && (
        <div className="cari">
          <div className="cari-kotak">
            <Ikon nama="search" />
            <input
              value={q}
              placeholder={t("cari.placeholder")}
              aria-label={t("cari.aria")}
              onChange={(e) => {
                setQ(e.target.value);
                setBuka(true);
              }}
              onFocus={() => setBuka(true)}
              onBlur={() => setTimeout(() => setBuka(false), 120)}
            />
          </div>
          {buka && (
            <ul className="cari-daftar" role="listbox">
              {hasil.length === 0 && <li className="redup kosong">{t("cari.kosong")}</li>}
              {hasil.map((k) => (
                <li
                  key={k.id}
                  role="option"
                  aria-selected={k.id === pilihan}
                  className={k.id === pilihan ? "aktif" : ""}
                  onMouseDown={() => pilih(k.id)}
                >
                  <b>{k.nama}</b>
                  <span className="redup">, {k.provinsi}</span>
                  {!k.model_tervalidasi && (
                    <small className="redup"> · {t("cari.tanpaModel")}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
