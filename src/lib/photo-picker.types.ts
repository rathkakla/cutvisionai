export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/**
 * Hasil pemilihan foto dari galeri.
 *
 * - `picked`   → pengguna memilih foto.
 * - `cancelled` → dialog ditutup tanpa memilih foto.
 * - `denied`   → izin galeri ditolak (hanya relevan di native).
 */
export type PhotoPickOutcome =
  | { status: 'picked'; photo: PickedPhoto }
  | { status: 'cancelled' }
  | { status: 'denied' };
