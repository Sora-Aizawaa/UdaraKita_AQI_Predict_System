import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Judul } from "./icons.jsx";
import { useIdioma } from "./idioma.jsx";

function tambahHari(tgl, n) {
  const d = new Date(`${tgl}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Trend({ laporan }) {
  const { t } = useIdioma();
  const {
    riwayat,
    prediksi_besok: prediksi,
    prakiraan_cams_besok: cams,
  } = laporan;

  const data = riwayat.map((r) => ({
    tanggal: r.tanggal.slice(5),
    aktual: r.us_aqi,
  }));
  const terakhir = data[data.length - 1];

  if (prediksi || cams) {
    const tglBesok =
      prediksi?.tanggal ?? tambahHari(riwayat[riwayat.length - 1].tanggal, 1);
    const besok = { tanggal: tglBesok.slice(5) };
    if (prediksi) {
      terakhir.prediksi = terakhir.aktual;
      besok.prediksi = prediksi.us_aqi;
    }
    if (cams) {
      terakhir.cams = terakhir.aktual;
      besok.cams = cams.us_aqi;
    }
    data.push(besok);
  }

  const tertinggi = Math.max(
    200,
    ...data.flatMap((d) => [d.aktual, d.prediksi, d.cams].filter(Boolean)),
  );
  const atas = Math.ceil(tertinggi / 50) * 50;
  const ticks = Array.from({ length: atas / 50 + 1 }, (_, i) => i * 50);

  return (
    <div className="kartu">
      <Judul ikon="trendingUp">{t("tren.judul")}</Judul>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 16, left: -8, bottom: 0 }}
        >
          <XAxis dataKey="tanggal" />
          <YAxis domain={[0, atas]} ticks={ticks} />
          <Tooltip />
          <Legend />
          {[50, 100, 150, 200].map((y) => (
            <ReferenceLine key={y} y={y} stroke="#8884" strokeDasharray="4 4" />
          ))}
          <Line
            name={t("tren.aktual")}
            dataKey="aktual"
            stroke="#2b6cb0"
            strokeWidth={2}
            dot
          />
          <Line
            name={t("tren.model")}
            dataKey="prediksi"
            stroke="#d62728"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot
            connectNulls
          />
          <Line
            name={t("tren.cams")}
            dataKey="cams"
            stroke="#2f855a"
            strokeWidth={2}
            strokeDasharray="2 3"
            dot
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
