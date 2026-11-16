#!/usr/bin/env python3
"""Mengubah OUTPUT notebook (tabel nilai dan gambar matplotlib) menjadi data laporan untuk aplikasi.

Pemakaian:   python bangun_laporan.py "D:\\path\\Predicting_Air_Quality_Index.ipynb"
Hasil:       laporan/laporan.json  dan  laporan/gambar/*.png
Jalankan ulang setiap kali notebook diperbarui, lalu muat ulang backend.
"""
import base64
import json
import re
import shutil
import struct
import sys
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
KELUARAN = BASE / "laporan"
GAMBAR = KELUARAN / "gambar"
URL_GAMBAR = "/api/laporan-model/gambar"

# Pengelompokan bagian notebook (nomor "## N." pada judul) menjadi tab laporan
GRUP = [
    ("data",      "Data dan pembersihan", list(range(2, 13))),
    ("eda",       "EDA",                  [13]),
    ("model",     "Fitur dan model",      [14, 15, 16, 17]),
    ("tuning",    "Tuning dan model final", [18, 19, 20]),
    ("fitur",     "Feature importance",   [21]),
    ("prediksi",  "Prediksi dan kesalahan", [22, 23, 24, 25, 26]),
    ("multikota", "Multi-kota",           ["multi"]),
]

RE_JUDUL = re.compile(r"^#{1,3}\s*(\d+)\.\s*(.+?)\s*$")
RE_JUDUL_GAMBAR = re.compile(r"(?:suptitle|set_title|title)\(\s*f?[\"'](.+?)[\"']")


# ------------------------------------------------------------------ penguraian tabel
def _angka(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


def _tepi_header(header: str):
    """(nama, posisi_akhir) tiap kolom. Nama kolom dipisah >= 2 spasi; pandas meratakan ke kanan."""
    h = header.rstrip().rstrip("\\").rstrip()
    return [(m.group(0), m.end()) for m in re.finditer(r"\S+(?: \S+)*", h)]


def _sel_baris(baris: str, tepi):
    """Pisahkan satu baris data berdasarkan tepi kanan kolom. None bila ada sel yang tidak selaras."""
    token = [(m.start(), m.end(), m.group(0)) for m in re.finditer(r"\S+", baris)]
    sel = []
    for e in tepi:
        cocok = [x for x in token if x[1] == e]
        if len(cocok) != 1:
            return None
        sel.append(cocok[0])
    awal = sel[0][0]
    if [x for x in token if x not in sel and x[0] >= awal]:       # ada token yang tidak masuk kolom mana pun
        return None
    return baris[:awal].strip(), [x[2] for x in sel]


def _parse_seri(lines):
    """Hasil print(Series): 'label   nilai', nilai rata kanan, diakhiri baris dtype/Name."""
    pasangan, nama, akhir = [], None, set()
    for l in lines:
        s = l.rstrip()
        st = s.strip()
        if not st:
            continue
        if st.startswith("Name:"):
            m = re.match(r"Name:\s*(.+?),\s*dtype", st)
            nama = m.group(1) if m else None
            continue
        if st.startswith(("dtype:", "Length:")):
            continue
        m = re.match(r"^(.*\S)\s{2,}(\S+)$", s)
        if not m or m.group(1).endswith(":") or m.group(2).startswith(":") or "  " in m.group(1):
            return None                                            # label Series tidak memuat 2 spasi berurutan
        pasangan.append([m.group(1).strip(), m.group(2)])
        akhir.add(m.end(2))
    if len(pasangan) < 2 or len(akhir) != 1:                       # semua nilai harus rata kanan
        return None
    return {"kolom": ["", nama or "nilai"], "baris": pasangan}


def _parse_frame(lines):
    """Hasil print(DataFrame): header, (opsional) baris nama index, lalu baris data selaras kolom."""
    isi = [l for l in lines if l.strip()]
    if len(isi) < 2:
        return None
    kol = _tepi_header(isi[0])
    if len(kol) < 2 or any(_angka(n) for n, _ in kol) or any(n.startswith(":") for n, _ in kol):
        return None
    tepi = [e for _, e in kol]
    data = isi[1:]
    if len(data) > 1 and len(data[0].split()) == 1 and _sel_baris(data[0], tepi) is None:
        data = data[1:]                                            # baris 'model', 'bulan', 'kota', dst.
    baris = []
    for l in data:
        r = _sel_baris(l, tepi)
        if r is None:
            return None
        baris.append(r)
    if not baris:
        return None
    ada_label = [bool(lb) for lb, _ in baris]
    if all(ada_label):
        return {"kolom": [""] + [n for n, _ in kol], "baris": [[lb] + v for lb, v in baris]}
    if not any(ada_label):
        return {"kolom": [n for n, _ in kol], "baris": [v for _, v in baris]}
    return None


def _parse_tabel(lines):
    return _parse_seri(lines) or _parse_frame(lines)


def _cari_tabel(lines):
    """Cari tabel pertama di dalam blok: (awal, akhir, tabel); baris di luarnya dianggap teks."""
    n = len(lines)
    for j in range(n - 1):
        for k in range(n, j + 1, -1):
            t = _parse_tabel(lines[j:k])
            if t:
                return j, k, t
    return None


def _gabung_lebar(bagian):
    """Tabel lebar yang terpotong di print (baris diakhiri '\\') digabung menyamping."""
    parsed = [_parse_frame(p) for p in bagian]
    if any(p is None for p in parsed):
        return None
    label = [r[0] for r in parsed[0]["baris"]]
    if any([r[0] for r in p["baris"]] != label for p in parsed):
        return None
    kolom = [""] + [k for p in parsed for k in p["kolom"][1:]]
    baris = [[label[i]] + [v for p in parsed for v in p["baris"][i][1:]] for i in range(len(label))]
    return {"kolom": kolom, "baris": baris}


def segmen_teks(teks: str):
    """Pecah satu output teks menjadi potongan {'jenis': 'tabel'|'teks'}."""
    lines = teks.rstrip().splitlines()
    hasil, buf, i = [], [], 0

    def tutup_teks():
        isi = "\n".join(buf).strip("\n")
        if isi.strip():
            hasil.append({"jenis": "teks", "isi": isi})
        buf.clear()

    while i < len(lines):
        if lines[i].rstrip().endswith("\\"):                      # awal tabel lebar
            bagian, j = [], i
            while True:
                part = []
                while j < len(lines) and lines[j].strip():
                    part.append(lines[j]); j += 1
                bagian.append(part)
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if part and part[0].rstrip().endswith("\\") and j < len(lines):
                    continue
                break
            t = _gabung_lebar(bagian)
            if t:
                tutup_teks()
                hasil.append({"jenis": "tabel", **t})
            else:
                buf.extend(l for p in bagian for l in p)
            i = j
            continue

        # blok biasa sampai baris kosong
        j, blok = i, []
        while j < len(lines) and lines[j].strip() and not lines[j].rstrip().endswith("\\"):
            blok.append(lines[j]); j += 1
        if blok:
            sisa = blok
            while sisa:
                ada = _cari_tabel(sisa)
                if not ada:
                    buf.extend(sisa); break
                awal, akhir, t = ada
                buf.extend(sisa[:awal]); tutup_teks()
                hasil.append({"jenis": "tabel", **t})
                sisa = sisa[akhir:]
        else:
            j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        i = j
    tutup_teks()
    return hasil


# ------------------------------------------------------------------ notebook
def _ukuran_png(data: bytes):
    return struct.unpack(">II", data[16:24])


def _judul_gambar(kode: str, cadangan: str):
    m = RE_JUDUL_GAMBAR.search(kode)
    if m:
        return m.group(1)
    baris = kode.strip().splitlines()
    if baris and baris[0].startswith("#"):
        return baris[0].lstrip("# ").strip()
    return cadangan


def _keterangan_kode(kode: str):
    baris = kode.strip().splitlines()
    if baris and baris[0].startswith("#"):
        return baris[0].lstrip("# ").strip()
    return None


def bangun(path_notebook: Path):
    nb = json.loads(path_notebook.read_text(encoding="utf-8"))
    if GAMBAR.exists():
        shutil.rmtree(GAMBAR)
    GAMBAR.mkdir(parents=True, exist_ok=True)

    judul_laporan, bagian, sekarang = None, [], None
    kesimpulan_md = ""

    for idx, sel in enumerate(nb["cells"]):
        sumber = "".join(sel["source"])
        if sel["cell_type"] == "markdown":
            baris = sumber.strip().splitlines()
            if not baris:
                continue
            kepala = baris[0].strip()
            m = RE_JUDUL.match(kepala)
            if m:
                sekarang = {"nomor": int(m.group(1)), "judul": m.group(2), "item": []}
                bagian.append(sekarang)
                badan = "\n".join(baris[1:]).strip()
                if badan:
                    sekarang["item"].append({"jenis": "markdown", "isi": badan})
            elif kepala.startswith("# ") and judul_laporan is None:
                judul_laporan = kepala.lstrip("# ").strip()
                sekarang = {"nomor": 0, "judul": "Pendahuluan", "item": []}
                badan = "\n".join(baris[1:]).strip()
                if badan:
                    sekarang["item"].append({"jenis": "markdown", "isi": badan})
                bagian.append(sekarang)
            elif len(baris) == 1 and kepala.startswith("- ") and kepala[2:].isupper():
                sekarang = {"nomor": "multi", "judul": kepala[2:].title().replace("Multi Kota", "Validasi multi-kota"),
                            "item": []}
                bagian.append(sekarang)
            elif sekarang is not None:
                sekarang["item"].append({"jenis": "markdown", "isi": sumber.strip()})
            continue

        if sekarang is None:
            continue
        for k, o in enumerate(sel.get("outputs", [])):
            tipe = o.get("output_type")
            if tipe == "stream" and o.get("name") != "stderr":
                for potong in segmen_teks("".join(o["text"])):
                    sekarang["item"].append({**potong, "keterangan": _keterangan_kode(sumber)})
            elif tipe in ("execute_result", "display_data"):
                d = o.get("data", {})
                if "image/png" in d:
                    png = base64.b64decode("".join(d["image/png"]))
                    nama = f"s{str(sekarang['nomor']).zfill(2)}_c{idx}_{k}.png"
                    (GAMBAR / nama).write_bytes(png)
                    w, h = _ukuran_png(png)
                    sekarang["item"].append({"jenis": "gambar", "url": f"{URL_GAMBAR}/{nama}",
                                             "judul": _judul_gambar(sumber, sekarang["judul"]),
                                             "lebar": w, "tinggi": h})
                elif "text/plain" in d:
                    teks = "".join(d["text/plain"])
                    if teks.startswith(("<IPython", "<Figure", "<Axes")):
                        continue
                    for potong in segmen_teks(teks):
                        sekarang["item"].append({**potong, "keterangan": _keterangan_kode(sumber)})
            elif tipe == "error":
                sekarang["item"].append({"jenis": "teks", "isi": f"{o['ename']}: {o['evalue']}", "keterangan": "ERROR"})

    # kesimpulan (bagian 27) dipisah agar tampil di tab Ringkasan
    for b in list(bagian):
        if b["nomor"] == 27:
            kesimpulan_md = "\n\n".join(i["isi"] for i in b["item"] if i["jenis"] == "markdown")
            bagian.remove(b)

    # --- ringkasan per kota dari tabel validasi multi-kota
    ringkasan_kota = []
    for b in bagian:
        for it in b["item"]:
            if it["jenis"] == "tabel" and {"mae_baseline", "mae_model"} <= set(it["kolom"]):
                kol = {k: i for i, k in enumerate(it["kolom"])}
                for r in it["baris"]:
                    mb, mm = float(r[kol["mae_baseline"]]), float(r[kol["mae_model"]])
                    ringkasan_kota.append({
                        "kota": r[0], "mae_baseline": mb, "mae_model": mm,
                        "perbaikan_persen": round((1 - mm / mb) * 100, 1),
                        "perbaikan_kota_baru_persen": (round(float(r[kol["perbaikan_kota_baru_%"]]), 1)
                                                       if "perbaikan_kota_baru_%" in kol else None),
                        "bias": float(r[kol["bias_model"]]) if "bias_model" in kol else None,
                        "tervalidasi": r[kol["tervalidasi"]].strip() == "True" if "tervalidasi" in kol else None,
                    })

    # --- kelompokkan menjadi tab
    tab = []
    for kode, nama, nomor in GRUP:
        isi = [b for b in bagian if b["nomor"] in nomor]
        if isi:
            tab.append({"id": kode, "nama": nama, "bagian": isi})

    keluaran = {
        "judul": judul_laporan or "Laporan Model",
        "sumber_notebook": path_notebook.name,
        "dibuat": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "kesimpulan_md": kesimpulan_md,
        "ringkasan_kota": ringkasan_kota,
        "tab": tab,
    }
    (KELUARAN / "laporan.json").write_text(json.dumps(keluaran, ensure_ascii=False, indent=1), encoding="utf-8")

    n_tabel = sum(1 for t in tab for b in t["bagian"] for i in b["item"] if i["jenis"] == "tabel")
    n_teks = sum(1 for t in tab for b in t["bagian"] for i in b["item"] if i["jenis"] == "teks")
    n_gbr = sum(1 for t in tab for b in t["bagian"] for i in b["item"] if i["jenis"] == "gambar")
    print(f"selesai: {len(tab)} tab | {n_tabel} tabel | {n_teks} teks | {n_gbr} gambar | {len(ringkasan_kota)} kota")
    return keluaran


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit('Pemakaian: python bangun_laporan.py "path\\ke\\notebook.ipynb"')
    sumber = Path(sys.argv[1])
    if not sumber.exists():
        sys.exit(f"File tidak ditemukan: {sumber}")
    KELUARAN.mkdir(exist_ok=True)
    bangun(sumber)