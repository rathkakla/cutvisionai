# Panduan Mengetes CutVision AI

Dokumen ini menjelaskan cara mengecek aplikasi dari level kode sampai alur UI,
termasuk menguji seluruh skenario sukses dan gagal **tanpa memakai kuota Gemini
atau Fal.ai**. Semua perintah ditulis untuk PowerShell (Windows), tapi juga jalan
di macOS/Linux dengan sedikit penyesuaian.

---

## 1. Cek statis (wajib sebelum menyatakan selesai)

```powershell
cd C:\Users\akhta\cutvision-app
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

Yang diharapkan:

| Perintah | Hasil |
| --- | --- |
| `tsc --noEmit` | tidak ada output (0 error) |
| `expo lint` | 0 error (warning unused import di layar `(tabs)` memang sudah ada) |
| `expo-doctor` | semua check passed |

Cek juga bundle benar-benar bisa dibangun:

```powershell
npx expo export --platform web
npx expo export --platform android --output-dir dist-native
# hapus lagi setelah selesai
Remove-Item -Recurse -Force dist, dist-native
```

---

## 2. Uji alur lengkap dengan mock server (tanpa biaya API)

Mock server bawaan repo ini meniru **Gemini** (`/v1beta/models/{model}:generateContent`),
**Fal.ai** (antrean submit/status), dan DeepSeek lama.

### 2a. Siapkan `.env` untuk testing

```env
EXPO_PUBLIC_GEMINI_API_KEY=test-key
EXPO_PUBLIC_GEMINI_BASE_URL=http://localhost:8787/v1beta
EXPO_PUBLIC_TRYON_MODE=mock
EXPO_PUBLIC_FAL_PROXY_URL=http://localhost:8787/fal-api
```

Catatan penting:

- `EXPO_PUBLIC_GEMINI_BASE_URL` mengarahkan rekomendasi ke mock, jadi **tidak perlu**
  key asli dan tidak memakai kuota.
- `EXPO_PUBLIC_TRYON_MODE=mock` membuat try-on memakai gambar contoh dari mock.
  UI **wajib** menampilkan label `CONTOH RENDER · BUKAN HASIL AI`.
- Semua variabel `EXPO_PUBLIC_*` dibaca **saat bundling**. Setelah mengubah `.env`,
  wajib restart `npx expo start`, bukan hanya reload browser.

### 2b. Jalankan mock server

```powershell
npm run mock:ai
```

Output yang benar:

```
Mock AI siap di http://localhost:8787
  Gemini   : http://localhost:8787/v1beta/models/{model}:generateContent
  Fal proxy: http://localhost:8787/fal-api
  Kesehatan: http://localhost:8787/health
```

Cek cepat dari terminal lain:

```powershell
Invoke-WebRequest http://localhost:8787/health -UseBasicParsing | Select-Object -ExpandProperty Content
```

Harapan: ada field `geminiMode`, `geminiCount`, `falMode`, dan `falProxyPath`.

### 2c. Jalankan aplikasi web

```powershell
npx expo start --web --port 8081
```

Buka `http://localhost:8081`.

### 2d. Checklist alur utama

Centang semuanya; kalau ada yang gagal, bagian 6 menjelaskan cara membaca gejalanya.

**Layar Welcome (`/`)**

- [ ] Tombol **Mulai Scan Wajah** disabled sebelum checkbox dicentang.
- [ ] Checkbox bisa dicentang dan tombol langsung aktif.
- [ ] Tiga poin privasi menyebut: foto diproses di perangkat, Gemini hanya menerima
      teks/rasio, dan foto hanya dikirim ke penyedia render saat simulasi dibuat.

**Layar Scan (`/scan`)**

- [ ] Tombol **Pilih dari Galeri** membuka dialog file, **tanpa** layar merah `removeChild`.
- [ ] Setelah memilih foto: muncul label `FOTO GALERI`, status "Foto galeri siap dianalisis",
      dan tombol **Pakai kamera** untuk kembali ke kamera.
- [ ] Memilih foto kedua kali tetap berfungsi (tidak error, tidak macet).
- [ ] Menutup dialog tanpa memilih foto tidak membuat layar macet; tombol **Pilih dari
      Galeri** masih membuka dialog lagi.
- [ ] Memilih file yang bukan gambar (mis. `.jpg` berisi teks, atau HEIC di Chrome)
      menampilkan pesan "Foto itu tidak bisa dibaca browser ini…" — aplikasi tidak macet.
- [ ] Foto besar (mis. 3000×3750) tetap terkirim ke analisis dan tampil sebagai versi
      kompres 800px.
- [ ] Chip tipe rambut: memilih satu menampilkan hint-nya; yang lain tidak aktif.
- [ ] Kartu preferensi: hanya satu yang aktif (border emas + titik penuh).
- [ ] Menekan **Analisis Gaya Rambut** tanpa tipe rambut/preferensi menampilkan pesan
      merah yang jelas (bukan crash).

**Layar Analyzing (`/analyzing`)**

- [ ] Foto tampil utuh (`contentFit: contain`), garis pemindai bergerak.
- [ ] Kartu bentuk wajah muncul dengan sumber **"Face-landmark · MediaPipe"**.
- [ ] Titik-titik landmark emas terlihat di atas foto (bukti wajah benar-benar diukur).
- [ ] Tiga rasio (Panjang, Dahi, Rahang) tampil, mis. `1.18×`, `0.94×`, `0.83×`.
- [ ] Tahap 2 menyebut **Gemini**, lalu otomatis pindah ke `/result`.
- [ ] Kalau Gemini membalas 503 dua kali, aplikasi tetap berhasil (retry 0/800/2000 ms).

**Layar Result (`/result`)**

- [ ] Badge bentuk wajah memakai **hasil pengukuran sendiri**, bukan jawaban model.
- [ ] Teks "{n} opsi dari Gemini" tampil, dan nama gaya **bukan** tiga nama hardcoded
      mock (`Textured French Crop`, `Short Taper dengan Tekstur`, `Modern Side Part Rendah`)
      kalau memakai API asli.
- [ ] Chip "Diukur dari 478 landmark MediaPipe" tampil berwarna hijau.
- [ ] Mode `mock`: label `CONTOH RENDER · BUKAN HASIL AI` + hint "Mode contoh:" tampil.
- [ ] Tombol **Prompt Visual (English)** membuka/menutup teks prompt.
- [ ] **Hapus Foto & Ulangi** langsung kembali ke `/`; foto asli dan semua hasil
      simulasi hilang dari memori (tab tidak menampilkan gambar lama saat sesi baru).

**Mode Barber (`/profile` → switch "Mode Barber (Tukang Cukur)")**

- [ ] Switch awalnya mati; menyalakannya memunculkan teks "Mode Barber aktif: layar scan…".
- [ ] Reload halaman: switch tetap menyala (`localStorage` key `cutvision.barberMode` = `"true"`).
- [ ] Di `/scan` muncul kartu "Mode Barber aktif — preferensi gaya tidak wajib", judul
      **Preferensi Gaya** tanpa tanda wajib, hint berbunyi "Opsional di mode barber…".
- [ ] Analisis dengan **hanya** tipe rambut (preferensi kosong) tetap jalan — tidak muncul
      "Pilih preferensi gaya yang paling kamu suka.".
- [ ] Di `/result` ada badge **MODE BARBER** dan kartu "Panduan Cukur untuk Barber" ukuran
      besar **di atas** Preview Virtual Try-On, lengkap dengan target potongan, chip bentuk
      wajah/rambut, serta tiga rasio (`×`).
- [ ] Tombol **Tampilkan Layar Penuh untuk Barber** membuka modal "Barber Brief" kontras
      tinggi; **Tutup** mengembalikan ke halaman hasil tanpa kehilangan state.
- [ ] Matikan switch, reload: nilai jadi `"false"`; `/scan` kembali mewajibkan preferensi
      dan analisis tanpa preferensi ditolak.
- [ ] Di `/result` mode normal: badge **HASIL ANALISIS**, urutannya Preview Virtual Try-On →
      Kenapa Cocok Untukmu → Panduan Cukur (tanpa tombol layar penuh).

**Cek payload yang benar-benar dikirim**

```powershell
Invoke-WebRequest http://localhost:8787/gemini/last -UseBasicParsing | Select-Object -ExpandProperty Content
```

Harapan:

- `lastBody.hasImage` = `false` — **foto tidak pernah dikirim** ke Gemini.
- `lastBody.hasSchema` = `true` dan `responseMimeType` = `application/json`.
- `lastBody.userPrompt` berisi `bentukWajah`, `rasio`, `keyakinanPengukuran`,
  `alternatifBentuk`, `tipeRambut`, `preferensiGaya`.
- Mode barber tanpa preferensi: `preferensiGaya` = `"Netral (diserahkan ke barber)"`
  (bukan `null`, bukan string kosong).

```powershell
Invoke-WebRequest http://localhost:8787/fal/last -UseBasicParsing | Select-Object -ExpandProperty Content
```

Harapan (hanya kalau `EXPO_PUBLIC_TRYON_MODE=fal`): `submitCount` bertambah tepat 1
per gaya, `lastInput.hasDataUri` = `true`, `syncMode` = `true`, dan prompt menyebut
"Replace ONLY the hairstyle" serta "identical face shape".

---

## 3. Uji kualitas tangkapan wajah (MediaPipe)

Jalankan di web dengan WebGL aktif. Siapkan 4 file uji:

| File | Cara membuat | Hasil yang diharapkan |
| --- | --- | --- |
| Foto frontal jelas | potret resmi, wajah menghadap kamera | lolos, sumber MediaPipe |
| Foto tanpa wajah | pemandangan/benda | kartu **"Foto belum bisa dipakai"** → "Tidak ada wajah yang terdeteksi di foto." + tombol **Ambil Foto Ulangi** (tanpa **Coba Lagi**) |
| Foto dua orang | dua wajah dengan ukuran mirip | "Ada lebih dari satu wajah di foto." |
| Foto yang diputar ±20° | rotasi file foto frontal | "Posisi kepala belum tegak…" (roll > 12°) |
| Foto resolusi < 320 px | perkecil sisi terpendek ke 200 px | "Resolusi foto terlalu kecil untuk diukur." |

Catatan: kesalahan tangkapan **tidak** memakai fallback estimasi, karena estimasi
akan menghasilkan angka karangan. Hanya kegagalan teknis (WebGL/model gagal dimuat)
yang jatuh ke fallback.

---

## 4. Skenario error API (tanpa mengubah kode)

Mock punya mode yang bisa diganti kapan saja lewat URL. Setelah selesai, kembalikan
ke `ok` supaya alur normal jalan lagi.

| Skenario | Perintah | Yang harus muncul |
| --- | --- | --- |
| Gemini 503 | `Invoke-WebRequest "http://localhost:8787/gemini/set?mode=fail" -UseBasicParsing` | Retry otomatis 3× lalu (kalau masih gagal) "Server Gemini sedang sibuk (503)…" + **Coba Lagi** |
| Gemini key ditolak | `.../gemini/set?mode=unauthorized` | "API key Gemini ditolak. Periksa kembali EXPO_PUBLIC_GEMINI_API_KEY…" |
| Gemini lambat | `.../gemini/set?mode=slow` | Progress tetap berjalan ~4 detik, tidak terlihat macet |
| Gemini balasan bukan JSON | `.../gemini/set?mode=invalid` | "JSON dari Gemini tidak bisa dibaca. Coba lagi." |
| Fal error 500 | `.../fal/set?mode=fail` | Overlay "Simulasi belum berhasil" + pesan server Fal + **Coba Lagi** |
| Fal saldo habis | `.../fal/set?mode=locked` | "Akun Fal.ai tidak bisa dipakai: saldo/kredit habis atau akun terkunci…" |
| Fal tanpa gambar | `.../fal/set?mode=invalid` | "Fal.ai tidak mengembalikan gambar simulasi. Coba lagi." |

**Uji pemulihan (retry) Gemini:**

1. `.../gemini/set?mode=fail`, jalankan alur sampai `/analyzing`.
2. Set `.../gemini/set?mode=ok` sebelum percobaan ketiga habis (atau tunggu kartu error).
3. Klik **Coba Lagi** → rekomendasi muncul, `geminiCount` bertambah.

**Uji key belum diisi (tanpa mock):**

1. Kosongkan `EXPO_PUBLIC_GEMINI_API_KEY`, restart Expo.
2. Jalankan alur sampai `/analyzing` → kartu "API key Gemini belum diatur…".

**Uji try-on Gemini tanpa billing:**

1. Set `EXPO_PUBLIC_TRYON_MODE=gemini` + key asli, restart Expo.
2. Buka `/result`. Model image Gemini tanpa billing membalas **429** → overlay
   "Akun Gemini ini belum punya kuota untuk membuat gambar (free tier tidak termasuk)…".
   Ini perilaku yang benar: mode `gemini` butuh billing aktif.

**Uji reset saat render masih berjalan:**

1. `.../fal/set?mode=slow` (atau `EXPO_PUBLIC_TRYON_MODE=fal` + `mode=slow`), buka `/result`.
2. Saat status "Membuat simulasi" masih tampil, tekan **Hapus Foto & Ulangi**.
3. Harapan: langsung kembali ke `/`, dan setelah 5 detik `submitCount` **tidak**
   bertambah lagi serta tidak ada error baru di console.

---

## 5. Uji fallback MediaPipe (perangkat tanpa WebGL)

Tambah di `.env`, lalu restart Expo:

```env
EXPO_PUBLIC_FORCE_FACE_FALLBACK=1
```

Harapan: kartu bentuk wajah menampilkan sumber **"Estimasi rasio · fallback"**,
keyakinan **rendah**, angka rasio **disembunyikan** (diganti `—`), dan catatan bahwa
hasil terbaik didapat di versi web. Alur ke `/result` tetap berjalan.

Untuk menguji MediaPipe sungguhan: jalankan versi web di browser desktop dengan
WebGL aktif (Chrome/Edge/Firefox terbaru). Kartu harus menampilkan
"Face-landmark · MediaPipe". Kalau model gagal dimuat, aplikasi otomatis jatuh ke
fallback dan tetap menyelesaikan alur — itu perilaku yang benar, bukan bug.

---

## 6. Uji versi native (Expo Go)

```powershell
npx expo start
```

Scan QR dengan Expo Go, lalu ulangi checklist bagian 2d. Perbedaan yang wajar:

- MediaPipe (WASM + WebGL) tidak berjalan di native → sumber selalu
  "Estimasi rasio · fallback" dan angka rasio disembunyikan.
- Dialog galeri memakai UI sistem dan meminta izin galeri lebih dulu.
- Mock server hanya bisa dijangkau dari HP kalau memakai IP LAN, bukan `localhost`:

```env
EXPO_PUBLIC_GEMINI_BASE_URL=http://192.168.1.10:8787/v1beta
EXPO_PUBLIC_FAL_PROXY_URL=http://192.168.1.10:8787/fal-api
```

Ganti `192.168.1.10` dengan IP komputer (`ipconfig`). Pastikan Windows Firewall
mengizinkan port 8787, dan HP berada di jaringan Wi-Fi yang sama.

---

## 7. Kalau ada masalah

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| Layar merah `removeChild` / `NotFoundError` | versi lama pemilih galeri web | sudah diperbaiki di `src/lib/photo-picker.web.ts`; pastikan tidak ada `ImagePicker` yang diimpor langsung di `scan.tsx` |
| `Requiring unknown module "NNN"` / 500 di browser | cache Metro tidak sinkron setelah edit file | `Ctrl+C` lalu `npx expo start --clear` |
| `API key ... belum diatur` padahal `.env` sudah diisi | `EXPO_PUBLIC_*` dibaca saat bundling | stop `expo start`, jalankan ulang |
| Mock tidak terpanggil | `EXPO_PUBLIC_GEMINI_BASE_URL`/`FAL_PROXY_URL` salah atau mock mati | cek `http://localhost:8787/health`; restart `npm run mock:ai` |
| Gemini 404 model | nama model tidak tersedia untuk akun itu | ganti `EXPO_PUBLIC_GEMINI_MODEL`, restart |
| Gemini 429 pada rekomendasi | kuota harian free tier habis | tunggu, atau ganti model di `EXPO_PUBLIC_GEMINI_MODEL` |
| 429 pada try-on tapi rekomendasi lancar | model image memang tanpa free tier | aktifkan billing, atau pakai `EXPO_PUBLIC_TRYON_MODE=mock` |
| Bentuk wajah selalu "Oval" | foto frontal dengan proporsi netral, atau landmark tertutup rambut/jenggot | coba foto lain; jenggot tebal dan garis rambut turun ikut menggeser titik ukur |
| CORS di browser | request langsung ke API asli dengan origin tak diizinkan | pakai mock atau proxy backend |
| Port 8081/8787 sudah dipakai | server lama masih hidup | `Get-NetTCPConnection -LocalPort 8081,8787 -State Listen` lalu hentikan prosesnya |

Setelah selesai menguji dengan mock, kembalikan `.env` ke key asli (atau hapus `.env`)
dan jangan pernah commit `.env`.
