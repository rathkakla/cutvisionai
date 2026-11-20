export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/**
 * Hasil pemilihan foto dari galeri.
 *
 * - `picked`      → pengguna memilih foto dan fotonya berhasil dibaca.
 * - `cancelled`   → dialog ditutup tanpa memilih foto.
 * - `denied`      → izin galeri ditolak (hanya relevan di native).
 * - `unsupported` → file terpilih tapi tidak bisa dibaca sebagai gambar
 *                   (mis. HEIC di Chrome, atau file yang bukan gambar).
 */
export type PhotoPickOutcome =
  | { status: 'picked'; photo: PickedPhoto }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'unsupported' };
