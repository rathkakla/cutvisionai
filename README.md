# CutVision AI

Asisten rekomendasi gaya rambut barbershop. Pindai wajah, pilih karakter rambut dan preferensi gaya, lalu bawa panduan cukur yang teknis langsung ke barber.

Dibangun dengan **Expo SDK 58**, **React Native + TypeScript**, **Expo Router**, **NativeWind (Tailwind CSS)**, **MediaPipe Face Landmarker** (web), **DeepSeek Chat**, dan **Fal.ai Kontext**.

## Menjalankan

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# isi EXPO_PUBLIC_DEEPSEEK_API_KEY dan EXPO_PUBLIC_FAL_KEY di .env
npx expo start
```

Scan QR dengan Expo Go, atau tekan `a` / `i` untuk emulator. Untuk melihat versi web: `npx expo start --web`.

Ingin mencoba tanpa memakai kuota API? Jalankan mock server bawaan repo:

```bash
npm run mock:ai           # terminal 1: DeepSeek + Fal tiruan di port 8787
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
| Proses AI | `src/app/analyzing.tsx` | Scanner animasi, deteksi landmark, pengukuran rasio, panggilan DeepSeek, kartu error + **Coba Lagi** |
| Hasil | `src/app/result.tsx` | Bentuk wajah + sumber deteksi, simulasi Virtual Try-On, tab gaya dari AI, alasan, panduan barber, prompt visual, reset sesi |

Data sesi (foto, tipe rambut, preferensi, hasil deteksi, rekomendasi) disimpan di `src/context/cutvision-context.tsx` — hanya di memori React, tanpa AsyncStorage atau database.

## Deteksi Wajah

Pipeline ada di `src/services/`:

```
faceAnalysisService.ts          # orkestrasi: landmark → ukur → klasifikasi → fallback
faceLandmark/
  mediapipe.web.ts              # MediaPipe Face Landmarker (WASM + WebGL), web only
  mediapipe.ts                  # stub native → memicu fallback
  classify.ts                   # pengukuran rasio + aturan 6 bentuk wajah
  types.ts                      # tipe bersama
```

- **Web**: `@mediapipe/tasks-vision` memuat 468 landmark dari model `public/models/face_landmarker.task` (disajikan di `/models/face_landmarker.task`) dan runtime WASM dari jsDelivr. Delegate dicoba GPU lalu CPU.
- **Native/Expo Go**: runtime WASM + WebGL MediaPipe tidak tersedia dan modul face-detection native butuh development build. Aplikasi otomatis memakai **estimasi rasio** yang diberi label jelas di UI, bukan crash.
- Landmark yang dipakai: `10`–`152` (panjang wajah), `234`–`454` (tulang pipi), `127`–`356` (dahi), `172`–`397` (rahang).
- Rasio dinormalisasi ke lebar tulang pipi, lalu diklasifikasikan ke **Oval, Bulat, Kotak, Persegi Panjang, Hati, Diamond**.
- `EXPO_PUBLIC_FORCE_FACE_FALLBACK=1` memaksa mode estimasi untuk menguji jalur fallback.

## DeepSeek

`src/services/deepseekService.ts` memanggil `POST https://api.deepseek.com/chat/completions` dengan:

- `model: "deepseek-chat"` dan `response_format: { type: "json_object" }`.
- Input: `bentukWajah`, `tipeRambut`, `preferensiGaya` — **foto tidak pernah dikirim**.
- System prompt: hairstylist/barber senior Indonesia dengan aturan fisika rambut (Kribo/Mengembang/Kaku dilarang dipaksa jatuh lurus tanpa styling berat).
- Output divalidasi dan dinormalisasi sebelum masuk UI; field wajib string tidak kosong.

Error ditangani per kode (`missing-key`, `network`, `timeout`, `http`, `invalid-response`) dan layar analisis menampilkan pesan + tombol **Coba Lagi**. Retry hanya mengulang panggilan API bila deteksi wajah sudah berhasil.

Catatan:

- `EXPO_PUBLIC_DEEPSEEK_BASE_URL` bisa diarahkan ke mock server untuk testing.
- **Jangan pakai API key produksi di aplikasi publik.** Apa pun yang berawalan `EXPO_PUBLIC_` ikut masuk ke bundle dan bisa dibaca pengguna. Untuk produksi, proxy-kan permintaan lewat backend sendiri.
- Permintaan langsung dari **browser web** bisa diblokir CORS oleh DeepSeek. Aplikasi native tidak terkena CORS.

## Virtual Try-On (Fal.ai)

`src/services/tryOnService.ts` memanggil `fal-ai/flux-pro/kontext` lewat `@fal-ai/client`:

- Input: foto wajah (JPEG base64 → data URI), `prompt` hasil gabungan `namaGaya` + `promptVisual`, `aspect_ratio` terdekat dengan foto asli, `sync_mode: true`.
- Prompt menegaskan wajah, ekspresi, warna kulit, pakaian, pose, sudut kamera, dan latar **harus identik**; hanya rambut yang diganti. Prompt dari DeepSeek yang menyarankan sudut/pencahayaan lain diabaikan secara eksplisit.
- Hasil diminta inline sebagai data URI, jadi gambar simulasi hanya hidup di memori aplikasi dan tidak tersimpan di riwayat request Fal.
- `result.tsx` menyimpan hasil per index gaya di state + ref. Layar pertama otomatis merender gaya 1; pindah tab memakai cache, tidak memanggil API lagi. Tab yang masih diproses menampilkan indikator loading kecil di atas foto.
- **Hapus Foto & Ulangi** membatalkan request yang berjalan (AbortController), mengosongkan base64 foto, cache gambar, dan state sesi sebelum kembali ke layar awal.

Biaya: Kontext ditagih per gambar yang dihasilkan. Satu sesi bisa memicu hingga 3 render (satu per gaya) plus retry manual. Cek tarif terkini di [halaman model Fal.ai](https://fal.ai/models/fal-ai/flux-pro/kontext) sebelum memakai key produksi.

Catatan keamanan dan privasi:

- **Foto kini dikirim ke Fal.ai** saat simulasi dibuat. Kebijakan privasi di layar awal dan persetujuan pengguna sudah diperbarui. DeepSeek tetap hanya menerima teks.
- **Jangan pakai API key produksi di aplikasi publik.** `EXPO_PUBLIC_FAL_KEY` ikut ter-bundle dan bisa dibaca pengguna. Untuk produksi, proxy-kan lewat backend (`@fal-ai/server-proxy`) dan tunjuk `EXPO_PUBLIC_FAL_PROXY_URL` ke proxy itu; kalau proxy dipakai, key tidak perlu ada di aplikasi.
- Permintaan langsung dari browser bisa terkena CORS; aplikasi native tidak.
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
  services/         # face-landmark, klasifikasi, DeepSeek, Fal.ai try-on
  global.css        # direktif Tailwind
scripts/
  mock-ai-server.js # mock DeepSeek + antrean Fal untuk testing tanpa biaya
public/
  models/           # face_landmarker.task (disajikan sebagai /models/...)
```

## Catatan Implementasi

- Foto kamera/galeri dikompres ke lebar maksimal **800px** (JPEG, kualitas 0.7) sebelum dianalisis. Untuk try-on, foto dibaca ulang pada lebar maksimal **1024px** (kualitas 0.8) agar detail wajah tetap tajam.
- Preview Virtual Try-On dirender oleh Fal.ai Kontext, bukan siluet ilustratif. Selama render, foto asli tetap tampil dengan indikator loading kecil.
- Kebijakan privasi di aplikasi: foto hanya hidup di state React, tidak masuk galeri, dan dihapus saat pengguna menekan **Hapus Foto & Ulangi**. Yang dikirim ke DeepSeek hanya bentuk wajah, tipe rambut, dan preferensi; foto dikirim ke Fal.ai hanya untuk merender simulasi.
- Tema gelap: latar `#121212`, kartu `#1E1E1E`, aksen emas `#D9822B` (didefinisikan di `tailwind.config.js`).
#   c u t v i s i o n a i  
 