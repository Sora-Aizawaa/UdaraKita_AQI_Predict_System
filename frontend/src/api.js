const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, ""); // kosong saat dev (memakai proxy Vite)

export class GalatApi extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
  }
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET dengan dua perbaikan untuk Render gratis:
 * - `onLambat` dipanggil bila respons belum datang dalam 4 detik (server sedang bangun dari tidur),
 * - percobaan ulang untuk galat jaringan dan 502/504.
 */
async function get(path, { signal, onLambat } = {}) {
  const pengatur = onLambat ? setTimeout(onLambat, 4000) : null;
  try {
    for (let coba = 0; ; coba++) {
      try {
        const r = await fetch(`${BASE}${path}`, { signal });
        if (r.ok) return await r.json();
        if ([502, 504].includes(r.status) && coba < 3) {
          await tunggu(4000);
          continue;
        }
        const e = await r.json().catch(() => ({}));
        throw new GalatApi(r.status, e.detail);
      } catch (e) {
        if (e.name === "AbortError" || e instanceof GalatApi) throw e;
        if (coba >= 3) throw new GalatApi(0, "jaringan");
        await tunggu(4000);
      }
    }
  } finally {
    if (pengatur) clearTimeout(pengatur);
  }
}

export const daftarKota = (opsi) => get("/api/kota", opsi);
export const ambilLaporan = (id, opsi) => get(`/api/laporan/${id}`, opsi);
export const ambilPeta = (opsi) => get("/api/peta", opsi);
export const ambilLaporanModel = (bahasa, opsi) => get(`/api/laporan-model?bahasa=${bahasa}`, opsi);
export const urlGambar = (u) => `${BASE}${u}`; // gambar disajikan oleh backend
