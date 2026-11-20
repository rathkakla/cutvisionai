# CutVision AI

Asisten rekomendasi gaya rambut barbershop. Pindai wajah, pilih karakter rambut dan preferensi gaya, lalu bawa panduan cukur yang teknis langsung ke barber.

Dibangun dengan **Expo SDK 58**, **React Native + TypeScript**, **Expo Router**, **NativeWind (Tailwind CSS)**, **MediaPipe Face Landmarker** (478 titik, di perangkat), dan **Gemini API** untuk rekomendasi gaya.

## Menjalankan

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# isi EXPO_PUBLIC_GEMINI_API_KEY di .env (ambil dari https://aistudio.google.com/apikey)
npx expo start
```

Scan QR dengan Expo Go, atau tekan `a` / `i` untuk emulator. Untuk melihat versi web: `npx expo start --web`.

> API key Gemini **tidak** membutuhkan langganan Gemini Pro. Kuota mengikuti *project* di
> Google AI Studio, bukan status langganan akun.

Ingin mencoba tanpa memakai kuota API? Jalankan mock server bawaan repo:

```bash
npm run mock:ai           # terminal 1: Gemini + DeepSeek + Fal tiruan di port 8787
npx expo start --web      # terminal 2
```

Lalu isi `.env` sesuai bagian **2a** di [TESTING.md](./TESTING.md). Panduan lengkap
(termasuk skenario error dan uji versi native) ada di file yang sama.

> Variabel `EXPO_PUBLIC_*` dibaca saat bundling. Setelah mengubah `.env`, **restart** `npx expo start` (bukan hanya reload aplikasi).

Pemeriksaan kode:

```bash
npx tsc --noEmit
npx eslint .
npx expo-doctor
```

## Alur Aplikasi

| Layar | File | Isi |
| --- | --- | --- |
| Welcome & privasi | `src/app/index.tsx` | Judul, tagline, kebijakan privasi, checkbox persetujuan eksplisit, CTA |
| Scan wajah | `src/app/scan.tsx` | Preview kamera depan + bingkai oval, opsi galeri, chip tipe rambut, pilihan preferensi gaya |
| Proses AI | `src/app/analyzing.tsx` | Scanner animasi, overlay 478 landmark, pengukuran rasio, panggilan Gemini, kartu error + **Coba Lagi** |
| Hasil | `src/app/result.tsx` | Bentuk wajah + sumber deteksi, simulasi Virtual Try-On, tab gaya dari AI, alasan, panduan barber, prompt visual, reset sesi |

Data sesi (foto, tipe rambut, preferensi, hasil deteksi, rekomendasi) disimpan di `src/context/cutvision-context.tsx` — hanya di memori React, tanpa AsyncStorage atau database.

## Deteksi Wajah

Pipeline ada di `src/services/`:

```
faceAnalysisService.ts          # orkestrasi: landmark → ukur → klasifikasi → fallback
faceLandmark/
  mediapipe.web.ts              # MediaPipe Face Landmarker (WASM + WebGL), web only
  mediapipe.ts                  # stub native → memicu fallback
  classify.ts                   # pengukuran rasio, aturan 6 bentuk, skor kandidat
  types.ts                      # tipe bersama + FaceCaptureError
```

- **Web**: `@mediapipe/tasks-vision` memuat **478 landmark** dari model `public/models/face_landmarker.task` (disajikan di `/models/face_landmarker.task`) dan runtime WASM dari jsDelivr. Delegate dicoba GPU lalu CPU.
- **Native/Expo Go**: runtime WASM + WebGL MediaPipe tidak tersedia dan modul face-detection native butuh development build. Aplikasi memakai **estimasi rasio** yang diberi label jelas di UI, dan **angkanya disembunyikan** karena bukan pengukuran.
- Landmark yang dipakai: `10`–`152` (panjang wajah), `234`–`454` (tulang pipi), `21`–`251` (lebar dahi di ujung luar alis), `172`–`397` (gonion/rahang), `33`–`263` (jarak antar mata sebagai pembanding skala).
- Pemilihan titik dahi diuji dengan 5 potret frontal. `103`–`332` (kontur atas dahi) selalu memberi 0.685–0.740 — membuat bentuk **Hati** mustahil tercapai; `127`–`356` (pelipis–telinga) selalu ≈ 1.0 — semua wajah jadi selebar tulang pipi. `21`–`251` memberi 0.905–0.955, paling dekat proporsi antropometri dan tidak bergantung garis rambut.
- Rasio dinormalisasi ke lebar tulang pipi, lalu tiap bentuk wajah diberi skor kemiripan (`scoreFaceShapes`). Label = bentuk dengan skor tertinggi, jadi label dan daftar alternatif tidak pernah bertentangan.
- Titik tengah (centroid) tiap bentuk dikalibrasi ke **ruang rasio pipeline ini**, bukan angka buku: `lengthToWidth` 1.14–1.29, `foreheadToCheek` 0.905–0.955, `jawToCheek` 0.795–0.838. Dengan begitu keenam bentuk tetap bisa tercapai.
- **Pose gating**: matriks transformasi MediaPipe (`outputFacialTransformationMatrixes`) dipakai menghitung yaw/pitch, sedangkan roll dihitung dari garis mata. Foto dengan yaw > 15°, pitch > 18°, atau roll > 12° ditolak dengan pesan "foto ulang", bukan diam-diam menghasilkan angka salah.
- **Validasi foto**: tanpa wajah (`no-face`), dua orang (`multi-face`), resolusi di bawah 320 px (`too-small`), atau kepala miring (`pose`) menghasilkan `FaceCaptureError` → layar analisis menampilkan **Ambil Foto Ulangi** tanpa tombol retry.
- **Overlay landmark**: `analyzing.tsx` menggambar titik landmark di atas foto sebagai bukti visual bahwa wajah benar-benar diukur.
- **Keyakinan** dihitung dari selisih skor bentuk terbaik vs kedua (≥0.5 tinggi, ≥0.2 sedang, sisanya rendah) — bukan dari jarak ke ambang aturan.
- `EXPO_PUBLIC_FORCE_FACE_FALLBACK=1` memaksa mode estimasi untuk menguji jalur fallback.

**Batasan yang perlu diketahui:** pengukuran ini memakai 2D landmark, jadi garis rambut turun, jenggot tebal, kacamata, atau pose ekstrem ikut menggeser titik ukur. Bentuk wajah adalah perkiraan terbaik dari geometri foto, bukan diagnosis — UI selalu menampilkan keyakinan dan kandidat bentuk kedua.
- Rasio dinormalisasi ke lebar tulang pipi, lalu diklasifikasikan ke **Oval, Bulat, Kotak, Persegi Panjang, Hati, Diamond**. Selain label utama, dihitung skor kemiripan tiap bentuk (`scoreFaceShapes`) sehingga dua kandidat terdekat bisa dikirim ke AI sebagai konteks.
- **Pose gating**: matriks transformasi MediaPipe (`outputFacialTransformationMatrixes`) dipakai menghitung yaw/pitch, sedangkan roll dihitung dari garis mata. Foto dengan yaw > 15°, pitch > 18°, atau roll > 12° ditolak dengan pesan "foto ulang", bukan diam-diam menghasilkan angka salah.
- **Validasi foto**: tanpa wajah (`no-face`), dua orang (`multi-face`), atau resolusi di bawah 320 px (`too-small`) menghasilkan `FaceCaptureError` → layar analisis menampilkan **Ambil Foto Ulang**.
- **Overlay landmark**: `analyzing.tsx` menggambar titik landmark di atas foto sebagai bukti visual bahwa wajah benar-benar diukur.
- `EXPO_PUBLIC_FORCE_FACE_FALLBACK=1` memaksa mode estimasi untuk menguji jalur fallback.

## Rekomendasi AI (Gemini)

`src/services/geminiService.ts` memanggil:

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Header: x-goog-api-key: <EXPO_PUBLIC_GEMINI_API_KEY>
```

- `gemini-3.1-flash-lite` sebagai model utama (sudah diuji: menjawab JSON schema dengan benar, ~5 detik untuk 2 rekomendasi).
- Output dipaksa lewat `responseMimeType: application/json` + `responseSchema`, jadi tidak ada parsing teks bebas.
- Input: `bentukWajah`, angka rasio terukur, tingkat keyakinan, kandidat bentuk kedua, `tipeRambut`, dan `preferensiGaya` — **foto tidak pernah dikirim**.
- `bentukWajah` di UI diambil dari hasil pengukuran kita sendiri (`analysis.faceShape`), bukan dari jawaban model.
- **Ketahanan**: 3 percobaan dengan jeda 0/800/2000 ms untuk 429/5xx, lalu turun ke `EXPO_PUBLIC_GEMINI_FALLBACK_MODELS`. Free tier sering membalas `503 high demand`, jadi rantai fallback ini wajib.
- Error dipetakan per kode: `missing-key`, `network`, `timeout`, `http`, `rate-limit`, `unavailable`, `invalid-response`.

Catatan:

- `EXPO_PUBLIC_GEMINI_BASE_URL` bisa diarahkan ke mock server (`http://localhost:8787/v1beta`) untuk testing tanpa kuota.
- **Jangan pakai API key produksi di aplikasi publik.** Apa pun yang berawalan `EXPO_PUBLIC_` ikut masuk ke bundle dan bisa dibaca pengguna. Untuk produksi, proxy-kan permintaan lewat backend sendiri.
- CORS `generativelanguage.googleapis.com` mengizinkan `x-goog-api-key` dari browser, jadi versi web bisa memanggil langsung.

## Virtual Try-On

`src/services/tryOnService.ts` adalah satu pintu untuk tiga backend, dipilih lewat
`EXPO_PUBLIC_TRYON_MODE`:

| Mode | Backend | Biaya | Catatan |
| --- | --- | --- | --- |
| `mock` (default) | mock server lokal | gratis | Gambar gradasi. UI memberi label **"CONTOH RENDER · BUKAN HASIL AI"** |
| `gemini` | `src/services/geminiImageService.ts` | ±$0.03–0.07/gambar | **Tidak ada free tier** untuk model image; butuh billing aktif |
| `fal` | `fal-ai/flux-pro/kontext` | per gambar | Kode lama, dipertahankan |

- Prompt try-on dipakai bersama oleh Gemini dan Fal (`src/services/tryOnPrompt.ts`) dan menegaskan wajah, ekspresi, warna kulit, pakaian, pose, sudut kamera, dan latar **harus identik**; hanya rambut yang diganti.
- `result.tsx` menyimpan hasil per index gaya di state + ref. Layar pertama otomatis merender gaya 1; pindah tab memakai cache, tidak memanggil API lagi.
- **Hapus Foto & Ulangi** membatalkan request yang berjalan (AbortController), mengosongkan base64 foto, cache gambar, dan state sesi sebelum kembali ke layar awal.
- Kalau Gemini membalas `429` karena project belum punya billing, pesannya menjelaskan hal itu secara eksplisit (kode `billing`).

Catatan keamanan dan privasi:

- Pada mode `gemini`/`fal`, **foto dikirim ke penyedia render** hanya untuk membuat simulasi. Kebijakan privasi di layar awal sudah menjelaskan ini.
- **Jangan pakai API key produksi di aplikasi publik.** Untuk produksi, proxy-kan lewat backend dan tunjuk `EXPO_PUBLIC_FAL_PROXY_URL` / `EXPO_PUBLIC_GEMINI_BASE_URL` ke proxy itu.
- `.env` berubah → restart `npx expo start`.

## Galeri di Web

`src/lib/photo-picker.web.ts` dipakai khusus di web, menggantikan `expo-image-picker`.
Implementasi bawaan library membuat `<input type="file">` baru setiap pemanggilan lalu
menghapusnya dengan `document.body.removeChild(input)`; di React 19 kombinasi itu
melempar `NotFoundError` yang tampil sebagai layar LogBox dan memblokir UI. Pemilih
versi aplikasi ini membuat input **sekali**, memasangnya permanen, dan tidak pernah
melepasnya — jadi error tersebut tidak bisa terjadi. Versi native tetap memakai
`expo-image-picker` lewat `src/lib/photo-picker.ts`.

## Struktur

```
src/
  app/              # route Expo Router (root: src/app)
  components/       # komponen UI (brand, chip, tombol, overlay, preview)
  context/          # state sesi CutVision
  data/             # opsi tipe rambut & preferensi
  lib/              # kompresi/base64 foto, pemilih galeri (native & web)
  services/         # face-landmark, klasifikasi, Gemini, try-on (mock/gemini/fal)
scripts/
  mock-ai-server.js # mock Gemini + DeepSeek + antrean Fal untuk testing tanpa biaya
public/
  models/           # face_landmarker.task (disajikan sebagai /models/...)
```

## Catatan Implementasi

- Foto kamera/galeri dikompres ke lebar maksimal **800px** (JPEG, kualitas 0.7) sebelum dianalisis. Untuk try-on, foto dibaca ulang pada lebar maksimal **1024px** (kualitas 0.8) agar detail wajah tetap tajam.
- Preview Virtual Try-On menampilkan hasil backend yang aktif. Pada mode `mock`, badge di preview menyatakan bahwa gambar hanyalah contoh render.
- Kebijakan privasi di aplikasi: foto hanya hidup di state React, tidak masuk galeri, dan dihapus saat pengguna menekan **Hapus Foto & Ulangi**. Yang dikirim ke Gemini hanya teks terukur; foto hanya dikirim ke penyedia render saat simulasi dibuat.
- Tema gelap: latar `#121212`, kartu `#1E1E1E`, aksen emas `#D9822B` (didefinisikan di `tailwind.config.js`).
