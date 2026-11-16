import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { ambilLaporanModel, urlGambar } from "./api";
import { Judul } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";
import { pesanGalat } from "./galat.js";

/* ---------- markdown minimal: paragraf, daftar "- ", **tebal**, `kode` ---------- */
function Inline({ s }) {
  return s
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((b, i) =>
      b.startsWith("**") ? (
        <b key={i}>{b.slice(2, -2)}</b>
      ) : b.startsWith("`") ? (
        <code key={i}>{b.slice(1, -1)}</code>
      ) : (
        b
      ),
    );
}

function Markdown({ teks }) {
  const keluar = [];
  teks.split(/\n\s*\n/).forEach((blok, i) => {
    let para = [],
      daftar = [];
    const tutupPara = () => {
      if (para.length)
        keluar.push(
          <p key={`${i}p${keluar.length}`}>
            <Inline s={para.join(" ")} />
          </p>,
        );
      para = [];
    };
    const tutupDaftar = () => {
      if (daftar.length)
        keluar.push(
          <ul key={`${i}u${keluar.length}`}>
            {daftar.map((l, j) => (
              <li key={j}>
                <Inline s={l} />
              </li>
            ))}
          </ul>,
        );
      daftar = [];
    };
    blok
      .split("\n")
      .filter(Boolean)
      .forEach((l) => {
        if (l.trim().startsWith("- ")) {
          tutupPara();
          daftar.push(l.trim().slice(2));
        } // daftar boleh menempel di bawah kalimat
        else {
          tutupDaftar();
          para.push(l.trim());
        }
      });
    tutupPara();
    tutupDaftar();
  });
  return keluar;
}

/* ---------- tabel nilai ---------- */
const ANGKA = /^-?\d[\d.,]*(e[+-]?\d+)?%?$/i;

function Tabel({ t }) {
  return (
    <div className="tabel-gulir">
      <table className="tabel-data">
        <thead>
          <tr>
            {t.kolom.map((k, i) => (
              <th key={i}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.baris.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={ANGKA.test(c) ? "angka" : ""}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Blok({ it }) {
  if (it.jenis === "markdown")
    return (
      <div className="md">
        <Markdown teks={it.isi} />
      </div>
    );
  if (it.jenis === "tabel")
    return (
      <figure>
        {it.keterangan && <figcaption>{it.keterangan}</figcaption>}
        <Tabel t={it} />
      </figure>
    );
  if (it.jenis === "gambar")
    return (
      <figure>
        <img
          src={urlGambar(it.url)}
          alt={it.judul}
          width={it.lebar}
          height={it.tinggi}
          loading="lazy"
        />
        <figcaption>{it.judul}</figcaption>
      </figure>
    );
  return (
    <figure>
      {it.keterangan && <figcaption>{it.keterangan}</figcaption>}
      <pre className="teks">{it.isi}</pre>
    </figure>
  );
}

/* ---------- ringkasan ---------- */
function Ringkasan({ data }) {
  const { t } = useIdioma();
  const kota = data.ringkasan_kota ?? [];
  const m = data.model_aktif;
  const urut = [...kota].sort(
    (a, b) => b.perbaikan_persen - a.perbaikan_persen,
  );
  const lulus = kota.filter((k) => k.tervalidasi).length;

  return (
    <>
      <div className="kartu">
        <Judul ikon="award">{t("model.dipakai")}</Judul>
        <dl className="info">
          <dt>{t("model.berkas")}</dt>
          <dd>{m.file_model}</dd>
          <dt>{t("model.dilatih")}</dt>
          <dd>{m.dilatih_pada ?? "—"}</dd>
          <dt>{t("model.versiXgb")}</dt>
          <dd>{m.versi_xgboost ?? "—"}</dd>
          <dt>{t("model.kotaPrediksi")}</dt>
          <dd>
            {kota.length
              ? t("model.dariKota", { n: m.kota_tervalidasi.length, m: kota.length })
              : m.kota_tervalidasi.length}
          </dd>
        </dl>
      </div>

      {kota.length > 0 && (
        <>
          <div className="kartu">
            <Judul ikon="barChart">{t("model.grafik")}</Judul>
            <p className="redup">{t("model.grafikPenjelasan", { n: lulus })}</p>
            <ResponsiveContainer
              width="100%"
              height={Math.max(300, urut.length * 38)}
            >
              <BarChart
                data={urut}
                layout="vertical"
                margin={{ top: 28, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#8883" />
                <XAxis type="number" unit="%" />
                <YAxis type="category" dataKey="nama" width={90} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <ReferenceLine x={0} stroke="#888" />
                <ReferenceLine
                  x={15}
                  stroke="#d62728"
                  strokeDasharray="5 4"
                  label={{
                    value: t("model.syarat"),
                    position: "top",
                    fill: "#d62728",
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="perbaikan_persen"
                  name={t("model.ikutDilatih")}
                  fill="#2f855a"
                >
                  {urut.map((r) => (
                    <Cell
                      key={r.kota}
                      fill={r.tervalidasi ? "#2f855a" : "#a0aec0"}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="perbaikan_kota_baru_persen"
                  name={t("model.tidakDilatih")}
                  fill="#3b82c4"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="kartu">
            <Judul ikon="fileText">{t("model.tabel")}</Judul>
            <div className="tabel-gulir">
              <table className="tabel-data">
                <thead>
                  <tr>
                    <th>{t("model.kolomKota")}</th>
                    <th>{t("model.kolomBaseline")}</th>
                    <th>{t("model.kolomModel")}</th>
                    <th>{t("model.kolomPerbaikan")}</th>
                    <th>{t("model.kolomBaru")}</th>
                    <th>{t("model.kolomBias")}</th>
                    <th>{t("model.kolomStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {kota.map((r) => (
                    <tr key={r.kota}>
                      <td>{r.nama}</td>
                      <td className="angka">{r.mae_baseline.toFixed(2)}</td>
                      <td className="angka">{r.mae_model.toFixed(2)}</td>
                      <td className="angka">
                        {r.perbaikan_persen.toFixed(1)}%
                      </td>
                      <td className="angka">
                        {r.perbaikan_kota_baru_persen == null
                          ? "—"
                          : `${r.perbaikan_kota_baru_persen.toFixed(1)}%`}
                      </td>
                      <td className="angka">
                        {r.bias == null ? "—" : r.bias.toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`status ${r.tervalidasi ? "lulus" : "gagal"}`}
                        >
                          {r.tervalidasi ? t("model.lulus") : t("model.gagal")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="redup">{t("model.catatanMae")}</p>
          </div>
        </>
      )}

      {data.kesimpulan_md && (
        <div className="kartu">
          <Judul ikon="info">{t("model.kesimpulan")}</Judul>
          <div className="md">
            <Markdown teks={data.kesimpulan_md} />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- halaman ---------- */
export default function LaporanModel() {
  const { bahasa, t } = useIdioma();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  const [tab, setTab] = useState("ringkasan");

  const [lambat, setLambat] = useState(false);

  // dimuat ulang saat bahasa berubah: backend menerjemahkan teks laporan
  useEffect(() => {
    const kendali = new AbortController();
    setGalat(null);
    ambilLaporanModel(bahasa, { signal: kendali.signal, onLambat: () => setLambat(true) })
      .then((d) => {
        setData(d);
        setLambat(false);
      })
      .catch((e) => e.name !== "AbortError" && setGalat(e));
    return () => kendali.abort();
  }, [bahasa]);

  if (galat)
    return (
      <main>
        <div className="isi">
          <div className="galat">{pesanGalat(galat, t)}</div>
        </div>
      </main>
    );
  if (!data)
    return (
      <main>
        <div className="isi">
          <p className="redup">
            {t("memuat.model")} {lambat && <span className="lambat">{t("memuat.lambat")}</span>}
          </p>
        </div>
      </main>
    );

  const daftarTab = [{ id: "ringkasan", nama: t("model.ringkasan") }, ...data.tab];
  const aktif = data.tab.find((t) => t.id === tab);

  return (
    <main>
      <div className="isi">
        <Judul ikon="fileText" tag="h1">
          {t("model.judul")}
        </Judul>
        <p className="sub">{data.judul}</p>

        <div className="subtab" role="tablist">
          {daftarTab.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              className={t.id === tab ? "aktif" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.nama}
            </button>
          ))}
        </div>

        {tab === "ringkasan" && <Ringkasan data={data} />}
        {aktif &&
          aktif.bagian.map((b) => (
            <section key={b.nomor} className="kartu bagian">
              <h2>
                {typeof b.nomor === "number" ? `${b.nomor}. ` : ""}
                {b.judul}
              </h2>
              {b.item.map((it, i) => (
                <Blok key={i} it={it} />
              ))}
            </section>
          ))}

        <footer>
          <p>
            {t("model.footer", { nb: data.sumber_notebook, waktu: data.dibuat.replace("T", " ") })}
          </p>
          <p>{t("model.catatanGambar")}</p>
        </footer>
      </div>
    </main>
  );
}
