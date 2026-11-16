BATAS = [
    (50,  "Baik",                                "#a8e05f", "#1a1a1a",
     "Kualitas udara baik. Aktivitas luar ruangan aman."),
    (100, "Sedang",                              "#fdd64b", "#1a1a1a",
     "Dapat diterima. Orang yang sangat sensitif sebaiknya mengurangi aktivitas berat di luar ruangan."),
    (150, "Tidak sehat untuk kelompok sensitif", "#ff9b57", "#1a1a1a",
     "Anak, lansia, dan penderita gangguan pernapasan atau jantung sebaiknya membatasi aktivitas di luar ruangan."),
    (200, "Tidak sehat",                         "#fe6a69", "#1a1a1a",
     "Kurangi aktivitas berat di luar ruangan. Pertimbangkan memakai masker (N95/KN95) bila harus keluar."),
    (300, "Sangat tidak sehat",                  "#a97abc", "#ffffff",
     "Hindari aktivitas di luar ruangan. Tutup jendela dan gunakan masker bila harus keluar."),
    (500, "Berbahaya",                           "#a87383", "#ffffff",
     "Darurat kesehatan. Tetap di dalam ruangan dan hindari semua aktivitas luar ruangan."),
]

NAMA_POLUTAN = {
    "us_aqi_pm2_5": "PM2.5", "us_aqi_pm10": "PM10", "us_aqi_ozone": "Ozon (O3)",
    "us_aqi_nitrogen_dioxide": "NO2", "us_aqi_sulphur_dioxide": "SO2",
    "us_aqi_carbon_monoxide": "CO",
}


def kategori(aqi: float) -> dict:
    """`nivel` (0-5) dipakai frontend untuk menerjemahkan nama kategori dan saran ke 3 bahasa."""
    for nivel, (batas, nama, warna, teks, saran) in enumerate(BATAS):
        if aqi <= batas:
            return {"kategori": nama, "nivel": nivel, "warna": warna, "warna_teks": teks, "saran": saran}
    n = BATAS[-1]
    return {"kategori": n[1], "nivel": len(BATAS) - 1, "warna": n[2], "warna_teks": n[3], "saran": n[4]}


def polutan_utama(sub_indeks: dict):
    valid = {k: v for k, v in sub_indeks.items() if v is not None and k in NAMA_POLUTAN}
    if not valid:
        return None
    return NAMA_POLUTAN[max(valid, key=valid.get)]


KUNCI_KONSENTRASI = {
    "us_aqi_pm2_5": "pm2_5", "us_aqi_pm10": "pm10", "us_aqi_ozone": "ozone",
    "us_aqi_nitrogen_dioxide": "nitrogen_dioxide", "us_aqi_sulphur_dioxide": "sulphur_dioxide",
    "us_aqi_carbon_monoxide": "carbon_monoxide",
}


def polutan_utama_detail(sub_indeks: dict, konsentrasi: dict):
    """Nama polutan dengan sub-indeks tertinggi beserta konsentrasinya (ug/m3)."""
    valid = {k: v for k, v in sub_indeks.items() if v is not None and k in NAMA_POLUTAN}
    if not valid:
        return None
    kunci = max(valid, key=valid.get)
    nilai = konsentrasi.get(KUNCI_KONSENTRASI[kunci])
    return {"kode": KUNCI_KONSENTRASI[kunci], "nama": NAMA_POLUTAN[kunci],
            "konsentrasi": None if nilai is None else round(float(nilai), 1),
            "satuan": "µg/m³"}