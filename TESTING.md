# Panduan Mengetes CutVision AI

Dokumen ini menjelaskan cara mengecek aplikasi dari level kode sampai alur UI,
termasuk menguji seluruh skenario sukses dan gagal **tanpa memakai kuota DeepSeek
atau Fal.ai**. Semua perintah ditulis untuk PowerShell (Windows), tapi juga jalan
di macOS/Linux dengan sedikit penyesuaian.

---

## 1. Cek statis (wajib sebelum menyatakan selesai)

```powershell
cd C:\Users\akhta\cutvision-app
npx tsc --noEmit
npx eslint .
npx expo-doctor
```

Yang diharapkan:

| Perintah | Hasil |
| --- | --- |
| `tsc --noEmit` | tidak ada output (0 error) |
| `eslint .` | tidak ada output (0 error) |
| `expo-doctor` | `20/20 checks passed` |

Cek juga bundle benar-benar bisa dibangun:

```powershell
npx expo export --platform web
npx expo export --platform android --output-dir dist-native
# hapus lagi setelah selesai
Remove-Item -Recurse -Force dist, dist-native
```

---

## 2. Uji alur lengkap dengan mock server (tanpa biaya API)

Mock server bawaan repo ini meniru DeepSeek **dan** antrean Fal.ai.

### 2a. Siapkan `.env` untuk testing

Buat file `.env` di root project:

```env
EXPO_PUBLIC_DEEPSEEK_API_KEY=test-key
EXPO_PUBLIC_DEEPSEEK_BASE_URL=http://localhost:8787
EXPO_PUBLIC_FAL_PROXY_URL=http://localhost:8787/fal-api
```

Catatan penting:

- `EXPO_PUBLIC_FAL_PROXY_URL` membuat aplikasi mengirim request Fal ke mock, jadi
  **tidak perlu** intercept browser atau memakai key asli.
- Kalau variabel ini diisi, `EXPO_PUBLIC_FAL_KEY` boleh kosong.
- Semua variabel `EXPO_PUBLIC_*` dibaca **saat bundling**. Setelah mengubah `.env`,
  wajib restart `npx expo start`, bukan hanya reload browser.

### 2b. Jalankan mock server

```powershell
npm run mock:ai
```

Output yang benar:

```
Mock AI siap di http://localhost:8787
  DeepSeek : http://localhost:8787/chat/completions
  Fal proxy: http://localhost:8787/fal-api
  Kesehatan: http://localhost:8787/health
```

Cek cepat dari terminal lain:

```powershell
Invoke-WebRequest http://localhost:8787/health -UseBasicParsing | Select-Object -ExpandProperty Content
```

### 2c. Jalankan aplikasi web

```powershell
npx expo start --web --port 8081
```

Buka `http://localhost:8081`.

### 2d. Checklist alur utama

Centang semuanya; kalau ada yang gagal, bagian 5 menjelaskan cara membaca gejalanya.

**Layar Welcome (`/`)**

- [ ] Tombol **Mulai Scan Wajah** disabled sebelum checkbox dicentang.
- [ ] Checkbox bisa dicentang dan tombol langsung aktif.
- [ ] Tiga poin privasi menyebut Fal.ai untuk simulasi dan DeepSeek hanya menerima teks.

**Layar Scan (`/scan`)**

- [ ] Tombol **Pilih dari Galeri** membuka dialog file, **tanpa** layar merah `removeChild`.
- [ ] Setelah memilih foto: muncul label `FOTO GALERI`, status "Foto galeri siap dianalisis",
      dan tombol **Pakai kamera** untuk kembali ke kamera.
- [ ] Memilih foto kedua kali tetap berfungsi (tidak error, tidak macet).
- [ ] Menutup dialog tanpa memilih foto tidak membuat layar macet.
- [ ] Chip tipe rambut: memilih satu menampilkan hint-nya; yang lain tidak aktif.
- [ ] Kartu preferensi: hanya satu yang aktif (border emas + titik penuh).
- [ ] Menekan **Analisis Gaya Rambut** tanpa tipe rambut/preferensi menampilkan pesan
      merah yang jelas (bukan crash).
- [ ] Status bar atas berubah dari "Kamera depan · mode potret" menjadi
      "Foto galeri siap dianalisis".

**Layar Analyzing (`/analyzing`)**

- [ ] Foto tampil, ada garis pemindai yang bergerak.
- [ ] Tahap 1 (landmark/rasio) selesai → kartu bentuk wajah muncul dengan sumber
      "Diukur dari 468 landmark MediaPipe" atau "Estimasi rasio · fallback".
- [ ] Tahap 2 (DeepSeek) berjalan, lalu otomatis pindah ke `/result`.
- [ ] Tiga rasio (Panjang, Dahi, Rahang) tampil dengan format `1.34×` dst.

**Layar Result (`/result`)**

- [ ] Badge "SIMULASI AI" muncul **setelah** render selesai; selama render tampil
      pill kecil "Membuat simulasi…" di kanan atas foto.
- [ ] Tab **Gaya 2** dan **Gaya 3** memicu render baru saat pertama kali diklik.
- [ ] Kembali ke tab yang sudah pernah dirender **tidak** memicu request baru
      (cek `http://localhost:8787/fal/last` → `submitCount` tidak bertambah).
- [ ] Tombol **Prompt Visual (English)** membuka/menutup teks prompt.
- [ ] **Hapus Foto & Ulangi** langsung kembali ke `/`; foto asli dan semua hasil
      simulasi hilang dari memori (tab tidak menampilkan gambar lama saat sesi baru).

**Cek payload yang benar-benar dikirim**

```powershell
Invoke-WebRequest http://localhost:8787/fal/last -UseBasicParsing | Select-Object -ExpandProperty Content
```

Harapan:

- `submitCount` bertambah tepat 1 per gaya yang dirender.
- `lastInput.hasDataUri` = `true` (foto dikirim sebagai `data:image/...`).
- `lastInput.syncMode` = `true` (hasil tidak disimpan di riwayat Fal).
- `lastInput.aspectRatio` cocok dengan orientasi foto (contoh `2:3` untuk foto potret).
- `lastInput.promptPreview` menyebut "Replace ONLY the hairstyle" dan
  "identical face shape".

---

## 3. Skenario error (tanpa mengubah kode)

Mock punya mode yang bisa diganti kapan saja lewat URL. Setelah selesai, kembalikan
ke `ok` supaya alur normal jalan lagi.

| Skenario | Perintah | Yang harus muncul |
| --- | --- | --- |
| DeepSeek error 500 | `Invoke-WebRequest "http://localhost:8787/set?mode=fail" -UseBasicParsing` | Kartu error di `/analyzing`: "Server DeepSeek sedang bermasalah (500). Coba lagi beberapa saat." + tombol **Coba Lagi** |
| DeepSeek key ditolak | `.../set?mode=unauthorized` | "API key DeepSeek ditolak (401). Periksa kembali EXPO_PUBLIC_DEEPSEEK_API_KEY." |
| DeepSeek lambat | `.../set?mode=slow` | Progress tetap berjalan ±4 detik, tidak terlihat macet |
| DeepSeek balasan bukan JSON | `.../set?mode=invalid` | "DeepSeek tidak mengembalikan JSON yang bisa dibaca. Coba lagi." |
| Fal error 500 | `Invoke-WebRequest "http://localhost:8787/fal/set?mode=fail" -UseBasicParsing` | Overlay "Simulasi belum berhasil" + "Server Fal.ai sedang bermasalah (500)..." + **Coba Lagi** |
| Fal saldo habis / akun terkunci | `.../fal/set?mode=locked` | "Akun Fal.ai tidak bisa dipakai: saldo/kredit habis atau akun terkunci. Isi ulang di dashboard Fal.ai lalu coba lagi." |
| Fal lambat | `.../fal/set?mode=slow` | Pill "Membuat simulasi…" tampil ±3 detik lalu berganti ke hasil |
| Fal tanpa gambar | `.../fal/set?mode=invalid` | "Fal.ai tidak mengembalikan gambar simulasi. Coba lagi." |

**Uji pemulihan (retry):**

1. Set `mode=fail`, buka `/result`, tunggu overlay error.
2. Set `mode=ok`.
3. Klik **Coba Lagi** → hasil render muncul, overlay hilang, `submitCount` bertambah 1.

**Uji key belum diisi (tanpa mock):**

1. Kosongkan `EXPO_PUBLIC_DEEPSEEK_API_KEY` (atau hapus barisnya), restart Expo.
2. Jalankan alur sampai `/analyzing` → muncul kartu "API key DeepSeek belum diatur...".
3. Isi kembali, restart Expo → alur normal.

**Uji Fal key belum diisi:**

Hapus `EXPO_PUBLIC_FAL_KEY` **dan** `EXPO_PUBLIC_FAL_PROXY_URL`, restart Expo, buka
`/result` → overlay "API key Fal.ai belum diatur. Isi EXPO_PUBLIC_FAL_KEY di file
.env (atau arahkan EXPO_PUBLIC_FAL_PROXY_URL ke proxy backend) lalu restart Expo."

**Uji reset saat render masih berjalan (penting):**

1. `.../fal/set?mode=slow` lalu masuk ke `/result`.
2. Saat pill "Membuat simulasi…" masih tampil, tekan **Hapus Foto & Ulangi**.
3. Harapan: langsung kembali ke `/`, dan setelah 5 detik `submitCount` **tidak**
   bertambah lagi serta tidak ada error baru di console.

---

## 4. Uji fallback MediaPipe (perangkat tanpa WebGL)

Tambah di `.env`, lalu restart Expo:

```env
EXPO_PUBLIC_FORCE_FACE_FALLBACK=1
```

Harapan: kartu bentuk wajah menampilkan sumber **"Estimasi rasio · fallback"** dengan
keyakinan **rendah** dan catatan bahwa hasil terbaik didapat di versi web. Alur ke
`/result` tetap berjalan.

Untuk menguji MediaPipe sungguhan: jalankan versi web di browser desktop dengan
WebGL aktif (Chrome/Edge/Firefox terbaru). Kartu harus menampilkan
"Diukur dari 468 landmark MediaPipe". Kalau model gagal dimuat, aplikasi otomatis
jatuh ke fallback dan tetap menyelesaikan alur — itu perilaku yang benar, bukan bug.

---

## 5. Uji versi native (Expo Go)

```powershell
npx expo start
```

Scan QR dengan Expo Go, lalu ulangi checklist bagian 2d. Perbedaan yang wajar:

- MediaPipe tidak berjalan di native → sumber selalu "Estimasi rasio · fallback".
- Dialog galeri memakai UI sistem dan meminta izin galeri lebih dulu.
- Mock server hanya bisa dijangkau dari HP kalau memakai IP LAN, bukan `localhost`:

```env
EXPO_PUBLIC_DEEPSEEK_BASE_URL=http://192.168.1.10:8787
EXPO_PUBLIC_FAL_PROXY_URL=http://192.168.1.10:8787/fal-api
```

Ganti `192.168.1.10` dengan IP komputer (`ipconfig`). Pastikan Windows Firewall
mengizinkan port 8787, dan HP berada di jaringan Wi-Fi yang sama.

---

## 6. Kalau ada masalah

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| Layar merah `removeChild` / `NotFoundError` | versi lama pemilih galeri web | sudah diperbaiki di `src/lib/photo-picker.web.ts`; pastikan file itu ada dan tidak ada `ImagePicker` yang diimpor langsung di `scan.tsx` |
| `API key ... belum diatur` padahal `.env` sudah diisi | `EXPO_PUBLIC_*` dibaca saat bundling | stop `expo start`, jalankan ulang |
| Mock tidak terpanggil | `EXPO_PUBLIC_FAL_PROXY_URL`/`BASE_URL` salah atau mock mati | cek `http://localhost:8787/health`; restart `npm run mock:ai` |
| CORS di browser | request langsung ke API asli | pakai mock (`EXPO_PUBLIC_FAL_PROXY_URL`, `EXPO_PUBLIC_DEEPSEEK_BASE_URL`) atau proxy backend |
| Port 8081/8787 sudah dipakai | server lama masih hidup | `Get-NetTCPConnection -LocalPort 8081,8787 -State Listen` lalu hentikan prosesnya |
| LogBox menutupi tombol | error dev dari library pihak ketiga | selesaikan error aslinya; di build production LogBox tidak ada |

Setelah selesai menguji dengan mock, kembalikan `.env` ke key asli (atau hapus `.env`)
dan jangan pernah commit `.env`.
