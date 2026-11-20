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
 *
 * Input sengaja TIDAK memakai `display: none`: Safari iOS mengabaikan `click()` pada
 * input yang benar-benar tidak dirender, sehingga dialog galeri tidak pernah terbuka.
 * Pola yang dipakai adalah "off-screen 1px" yang diterima semua browser modern.
 */

/** Jeda setelah jendela kembali fokus sebelum dialog dianggap batal. */
const CANCEL_GRACE_MS = 700;

/** Batas waktu membaca file jadi gambar; di atas ini file dianggap tidak didukung. */
const DECODE_TIMEOUT_MS = 20_000;

interface PendingPick {
  /** Dipanggil sekali saat hasil final diketahui. */
  resolve: (outcome: PhotoPickOutcome) => void;
  /** Sudah ada file terpilih; mencegah fallback `focus` salah menganggap batal. */
  gotFile: boolean;
  /**
   * Jendela sempat kehilangan fokus (dialog file benar-benar terbuka). Tanpa ini,
   * `focus` yang muncul tepat saat tombol diketuk (perilaku sebagian browser mobile)
   * akan disalahartikan sebagai "dialog ditutup" dan membatalkan pilihan pengguna.
   */
  sawBlur: boolean;
  focusHandler: (() => void) | null;
  blurHandler: (() => void) | null;
  cancelTimer: ReturnType<typeof setTimeout> | null;
  /** Timer pengaman kalau browser tidak mengirim `change` maupun `cancel`. */
  watchdogTimer: ReturnType<typeof setTimeout> | null;
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
  if (request.blurHandler) {
    window.removeEventListener('blur', request.blurHandler);
  }
  if (request.cancelTimer) {
    clearTimeout(request.cancelTimer);
  }
  if (request.watchdogTimer) {
    clearTimeout(request.watchdogTimer);
  }

  request.resolve(outcome);
}

/**
 * Apakah file ini gambar yang mungkin dibaca browser. Tipe kosong dibiarkan lolos
 * karena sebagian file manager tidak mengisi MIME; validasi sebenarnya tetap decode.
 */
function looksLikeImage(file: File): boolean {
  return file.type === '' || /^image\//i.test(file.type);
}

/** Membaca dimensi asli foto; menolak kalau browser tidak bisa men-decode filenya. */
function readImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let done = false;

    const finish = (size: { width: number; height: number } | null) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(size);
    };

    const timer = setTimeout(() => finish(null), DECODE_TIMEOUT_MS);

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      finish(width > 0 && height > 0 ? { width, height } : null);
    };
    image.onerror = () => finish(null);
    image.src = uri;
  });
}

async function toPickedPhoto(file: File): Promise<PickedPhoto | null> {
  const uri = URL.createObjectURL(file);
  createdUrls.add(uri);

  const size = await readImageSize(uri);

  if (!size) {
    // File tidak bisa dibaca sebagai gambar (mis. HEIC di Chrome). Blob-nya langsung
    // dilepas supaya tidak menahan memori, dan pemanggil mendapat pesan yang jelas.
    URL.revokeObjectURL(uri);
    createdUrls.delete(uri);
    return null;
  }

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
  input.setAttribute('data-cutvision-gallery', 'true');
  // Off-screen, bukan `display: none` — Safari iOS tidak membuka dialog untuk input
  // yang tidak dirender sama sekali.
  input.style.position = 'fixed';
  input.style.left = '-10000px';
  input.style.top = '0';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

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
    // Wajib dikosongkan: tanpa ini, memilih file yang sama dua kali tidak memicu
    // event `change` lagi dan UI terlihat "tidak bisa upload".
    input.value = '';

    if (!file) {
      settle({ status: 'cancelled' });
      return;
    }

    if (!looksLikeImage(file)) {
      settle({ status: 'unsupported' });
      return;
    }

    void toPickedPhoto(file)
      .then((photo) => settle(photo ? { status: 'picked', photo } : { status: 'unsupported' }))
      .catch(() => settle({ status: 'unsupported' }));
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
      sawBlur: false,
      focusHandler: null,
      blurHandler: null,
      cancelTimer: null,
      watchdogTimer: null,
    };

    // Dialog file membuat jendela kehilangan fokus. Penanda ini dipakai supaya
    // event `focus` yang datang tanpa didahului blur (spurious focus saat klik)
    // tidak dianggap sebagai "dialog sudah ditutup".
    request.blurHandler = () => {
      request.sawBlur = true;
    };

    // Fallback untuk browser yang tidak mengirim event `cancel`: setelah jendela
    // kembali fokus tanpa file terpilih, anggap pengguna membatalkan.
    request.focusHandler = () => {
      if (!request.sawBlur) {
        return;
      }
      request.cancelTimer = setTimeout(() => {
        if (pending === request && !request.gotFile) {
          settle({ status: 'cancelled' });
        }
      }, CANCEL_GRACE_MS);
    };

    // Pengaman terakhir: kalau dialog tidak pernah memberi kabar apa pun (browser
    // embedded/WebView tertentu), promise tetap selesai sehingga tombol galeri
    // tidak "mati" untuk pemanggilan berikutnya.
    request.watchdogTimer = setTimeout(() => {
      if (pending === request && !request.gotFile) {
        settle({ status: 'cancelled' });
      }
    }, 5 * 60_000);

    pending = request;
    window.addEventListener('blur', request.blurHandler, { once: true });
    window.addEventListener('focus', request.focusHandler, { once: true });

    try {
      input.click();
    } catch {
      settle({ status: 'cancelled' });
    }
  });
}
