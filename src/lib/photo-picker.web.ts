import type { PhotoPickOutcome, PickedPhoto } from './photo-picker.types';

/**
 * Pemilih galeri versi web.
 *
 * Kenapa tidak memakai `expo-image-picker` di web: implementasinya membuat
 * `<input type="file">` baru setiap pemanggilan lalu menghapusnya dengan
 * `document.body.removeChild(input)`. Di React 19 / react-native-web kombinasi itu
 * melempar `NotFoundError: Failed to execute 'removeChild' on 'Node'`, yang muncul
 * sebagai layar error LogBox dan memblokir seluruh UI.
 *
 * Di sini input dibuat sekali, dipasang permanen di `document.body`, dan tidak pernah
 * dilepas. Karena tidak ada node yang dihapus, error tersebut tidak bisa terjadi.
 */

/** Jeda setelah jendela kembali fokus sebelum dialog dianggap batal. */
const CANCEL_GRACE_MS = 700;

interface PendingPick {
  /** Dipanggil sekali saat hasil final diketahui. */
  resolve: (outcome: PhotoPickOutcome) => void;
  /** Sudah ada file terpilih; mencegah fallback `focus` salah menganggap batal. */
  gotFile: boolean;
  focusHandler: (() => void) | null;
  cancelTimer: ReturnType<typeof setTimeout> | null;
}

let fileInput: HTMLInputElement | null = null;
let pending: PendingPick | null = null;
/** Object URL foto yang pernah dipilih; dilepas saat sesi dihapus. */
const createdUrls = new Set<string>();

function settle(outcome: PhotoPickOutcome): void {
  const request = pending;
  if (!request) {
    return;
  }

  pending = null;

  if (request.focusHandler) {
    window.removeEventListener('focus', request.focusHandler);
  }
  if (request.cancelTimer) {
    clearTimeout(request.cancelTimer);
  }

  request.resolve(outcome);
}

function readImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = uri;
  });
}

async function toPickedPhoto(file: File): Promise<PickedPhoto> {
  const uri = URL.createObjectURL(file);
  createdUrls.add(uri);
  const size = await readImageSize(uri);
  return { uri, width: size.width, height: size.height };
}

/**
 * Melepas semua object URL foto yang dibuat pemilih ini. Dipanggil saat sesi
 * dihapus supaya blob foto benar-benar dibebaskan dari memori browser.
 */
export function releasePickedPhotos(): void {
  createdUrls.forEach((uri) => URL.revokeObjectURL(uri));
  createdUrls.clear();
}

function getFileInput(): HTMLInputElement {
  if (fileInput) {
    return fileInput;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.setAttribute('data-cutvision-gallery', 'true');

  input.addEventListener('change', () => {
    const request = pending;

    if (!request) {
      // Tidak ada permintaan aktif: buang nilai supaya file yang sama bisa dipilih lagi.
      input.value = '';
      return;
    }

    const file = input.files?.[0] ?? null;
    // Tandai lebih dulu. `input.value` dikosongkan di bawah, jadi fallback `focus`
    // tidak boleh menyimpulkan "batal" hanya karena daftar file sudah kosong.
    request.gotFile = Boolean(file);
    input.value = '';

    if (!file) {
      settle({ status: 'cancelled' });
      return;
    }

    void toPickedPhoto(file)
      .then((photo) => settle({ status: 'picked', photo }))
      .catch(() => settle({ status: 'cancelled' }));
  });

  // Browser modern mengirim event `cancel` saat dialog ditutup tanpa memilih file.
  input.addEventListener('cancel', () => settle({ status: 'cancelled' }));

  document.body.appendChild(input);
  fileInput = input;
  return input;
}

export function pickPhotoFromLibrary(): Promise<PhotoPickOutcome> {
  if (typeof document === 'undefined') {
    return Promise.resolve({ status: 'cancelled' });
  }

  // Kalau pemanggilan sebelumnya belum selesai, tutup dulu supaya promise-nya
  // tidak menggantung dan input berikutnya tidak berebut hasil.
  settle({ status: 'cancelled' });

  const input = getFileInput();

  return new Promise((resolve) => {
    const request: PendingPick = {
      resolve,
      gotFile: false,
      focusHandler: null,
      cancelTimer: null,
    };

    // Fallback untuk browser yang tidak mengirim event `cancel`: setelah jendela
    // kembali fokus tanpa file terpilih, anggap pengguna membatalkan.
    request.focusHandler = () => {
      request.cancelTimer = setTimeout(() => {
        if (pending === request && !request.gotFile) {
          settle({ status: 'cancelled' });
        }
      }, CANCEL_GRACE_MS);
    };

    pending = request;
    window.addEventListener('focus', request.focusHandler, { once: true });
    input.click();
  });
}
