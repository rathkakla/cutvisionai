import { ApiError, fal } from '@fal-ai/client';

import { generateGeminiTryOn } from './geminiImageService';
import { buildTryOnPrompt, type TryOnAspectRatio } from './tryOnPrompt';
import { TryOnError, type TryOnErrorCode } from './tryOnTypes';

export type { TryOnErrorCode };
export { TryOnError };
export { pickTryOnAspectRatio, type TryOnAspectRatio } from './tryOnPrompt';

export type TryOnMode = 'mock' | 'fal' | 'gemini';

export interface GenerateTryOnOptions {
  /** Membatalkan request saat pengguna menghapus sesi. */
  signal?: AbortSignal;
  aspectRatio?: TryOnAspectRatio;
}

const MODEL = 'fal-ai/flux-pro/kontext';
const TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_500;

let configuredSignature: string | null = null;

/**
 * Menentukan backend try-on.
 *
 * `mock` = mock server lokal (gambar gradasi, gratis, untuk demo/uji error).
 * `fal`  = Fal.ai langsung atau lewat proxy.
 * `gemini` = Gemini image generation (butuh billing aktif).
 *
 * Kalau `EXPO_PUBLIC_TRYON_MODE` tidak diisi, urutannya ditebak dari variabel yang ada.
 */
export function getTryOnMode(): TryOnMode {
  const explicit = process.env.EXPO_PUBLIC_TRYON_MODE?.trim().toLowerCase();

  if (explicit === 'mock' || explicit === 'fal' || explicit === 'gemini') {
    return explicit;
  }

  if (process.env.EXPO_PUBLIC_FAL_PROXY_URL?.trim()) {
    return 'mock';
  }
  if (process.env.EXPO_PUBLIC_FAL_KEY?.trim()) {
    return 'fal';
  }
  if (process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim()) {
    return 'gemini';
  }

  return 'mock';
}

/** Dipakai UI untuk memberi label jujur saat hasilnya cuma contoh render. */
export function isTryOnMock(): boolean {
  return getTryOnMode() === 'mock';
}

interface FalRuntime {
  /** API key langsung dari aplikasi; kosong kalau memakai proxy. */
  credentials?: string;
  /** URL proxy backend/mock yang meneruskan request ke Fal. */
  proxyUrl?: string;
}

function readFalRuntime(): FalRuntime {
  const credentials = process.env.EXPO_PUBLIC_FAL_KEY?.trim() || undefined;
  const proxyUrl = process.env.EXPO_PUBLIC_FAL_PROXY_URL?.trim() || undefined;

  if (!credentials && !proxyUrl) {
    throw new TryOnError(
      'Fal.ai belum dikonfigurasi. Isi EXPO_PUBLIC_FAL_KEY (atau EXPO_PUBLIC_FAL_PROXY_URL) di file .env, atau ubah EXPO_PUBLIC_TRYON_MODE.',
      'missing-key',
    );
  }

  return { credentials, proxyUrl };
}

function configureFalClient(runtime: FalRuntime): void {
  const signature = `${runtime.credentials ?? ''}|${runtime.proxyUrl ?? ''}`;

  if (configuredSignature === signature) {
    return;
  }

  fal.config({
    ...(runtime.credentials ? { credentials: runtime.credentials } : {}),
    // `when: 'always'` supaya proxy juga dipakai di native (Expo Go), bukan hanya web.
    ...(runtime.proxyUrl ? { proxyUrl: { url: runtime.proxyUrl, when: 'always' as const } } : {}),
    // Peringatan bawaan client muncul sebagai LogBox merah di web; risikonya
    // sudah didokumentasikan di README. Untuk produksi, pakai proxy backend.
    suppressLocalCredentialsWarning: true,
  });
  configuredSignature = signature;
}

function toDataUri(base64: string): string {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!clean) {
    throw new TryOnError('Data foto kosong, simulasi tidak bisa dibuat.', 'invalid-response');
  }
  return `data:image/jpeg;base64,${clean}`;
}

function describeHttpError(error: ApiError<unknown>): string {
  const { status } = error;
  const rawBody = error.body;

  // Fal mengirim detail yang sangat berguna; tampilkan kalau ada supaya pesan
  // tidak menebak salah penyebab (mis. 403 karena saldo habis, bukan key salah).
  const detail =
    typeof rawBody === 'string'
      ? rawBody.slice(0, 200)
      : rawBody && typeof rawBody === 'object'
        ? String(
            (rawBody as { detail?: unknown; message?: unknown }).detail ??
              (rawBody as { detail?: unknown; message?: unknown }).message ??
              '',
          ).slice(0, 200)
        : '';

  if (status === 401 || status === 403) {
    if (/balance|locked|exhausted|quota|credit/i.test(detail)) {
      return 'Akun Fal.ai tidak bisa dipakai: saldo/kredit habis atau akun terkunci. Isi ulang di dashboard Fal.ai lalu coba lagi.';
    }
    return detail
      ? `API key Fal.ai ditolak (${status}): ${detail}`
      : 'API key Fal.ai ditolak. Periksa kembali EXPO_PUBLIC_FAL_KEY.';
  }
  if (status === 402) {
    return 'Saldo akun Fal.ai habis. Isi ulang di dashboard Fal.ai lalu coba lagi.';
  }
  if (status === 429) {
    return 'Permintaan terlalu sering ke Fal.ai. Tunggu sebentar lalu coba lagi.';
  }
  if (status === 400 || status === 422) {
    return 'Fal.ai menolak permintaan simulasi. Coba gaya lain atau foto yang lebih jelas.';
  }
  if (status >= 500) {
    return `Server Fal.ai sedang bermasalah (${status}). Coba lagi beberapa saat.`;
  }

  return `Fal.ai menolak permintaan (${status}). Coba lagi.`;
}

function normalizeFalError(error: unknown): TryOnError {
  if (error instanceof TryOnError) {
    return error;
  }

  if (error instanceof ApiError) {
    return new TryOnError(describeHttpError(error), 'http', error.status);
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new TryOnError('Simulasi dibatalkan.', 'network');
    }
    if (/timed out|timeout/i.test(error.message)) {
      return new TryOnError(
        'Fal.ai tidak menyelesaikan simulasi dalam 2 menit. Coba lagi dengan koneksi yang lebih stabil.',
        'timeout',
      );
    }
    if (/network|fetch|failed to load|load failed/i.test(error.message)) {
      return new TryOnError(
        'Tidak bisa menghubungi Fal.ai. Periksa koneksi internetmu lalu coba lagi.',
        'network',
      );
    }
  }

  return new TryOnError('Simulasi gagal dibuat karena kendala tak terduga. Coba lagi.', 'network');
}

/**
 * Membuat simulasi gaya rambut dari foto asli memakai Fal.ai Kontext.
 *
 * Foto dikirim sebagai data URI dan hasilnya diminta inline (`sync_mode`), jadi
 * gambar simulasi hanya hidup di memori aplikasi, tidak disimpan di riwayat Fal.
 */
async function generateFalTryOn(
  base64FotoWajah: string,
  namaGaya: string,
  promptVisual: string,
  options: GenerateTryOnOptions,
): Promise<string> {
  const runtime = readFalRuntime();
  configureFalClient(runtime);

  const prompt = buildTryOnPrompt(namaGaya, promptVisual);

  try {
    const result = await fal.subscribe(MODEL, {
      input: {
        prompt,
        image_url: toDataUri(base64FotoWajah),
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '2',
        sync_mode: true,
        ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      },
      timeout: TIMEOUT_MS,
      pollInterval: POLL_INTERVAL_MS,
      logs: false,
      abortSignal: options.signal,
    });

    const url = result.data?.images?.[0]?.url;

    if (typeof url !== 'string' || !/^(https?:\/\/|data:image\/)/i.test(url)) {
      throw new TryOnError(
        'Fal.ai tidak mengembalikan gambar simulasi. Coba lagi.',
        'invalid-response',
      );
    }

    return url;
  } catch (error) {
    throw normalizeFalError(error);
  }
}

/**
 * Titik masuk tunggal Virtual Try-On. Backend dipilih lewat `EXPO_PUBLIC_TRYON_MODE`
 * sehingga mengganti penyedia tidak perlu mengubah layar hasil.
 */
export async function generateVirtualTryOn(
  base64FotoWajah: string,
  namaGaya: string,
  promptVisual: string,
  options: GenerateTryOnOptions = {},
): Promise<string> {
  const mode = getTryOnMode();

  if (mode === 'gemini') {
    return generateGeminiTryOn(base64FotoWajah, namaGaya, promptVisual, options);
  }

  return generateFalTryOn(base64FotoWajah, namaGaya, promptVisual, options);
}
