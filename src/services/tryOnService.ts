import { ApiError, fal } from '@fal-ai/client';

export type TryOnErrorCode = 'missing-key' | 'timeout' | 'network' | 'http' | 'invalid-response';

export class TryOnError extends Error {
  readonly code: TryOnErrorCode;
  readonly status?: number;

  constructor(message: string, code: TryOnErrorCode, status?: number) {
    super(message);
    this.name = 'TryOnError';
    this.code = code;
    this.status = status;
  }
}

/** Rasio yang didukung model Kontext, dipakai agar framing hasil sama dengan foto asli. */
export type TryOnAspectRatio =
  | '21:9'
  | '16:9'
  | '4:3'
  | '3:2'
  | '1:1'
  | '2:3'
  | '3:4'
  | '9:16'
  | '9:21';

export interface GenerateTryOnOptions {
  /** Membatalkan request saat pengguna menghapus sesi. */
  signal?: AbortSignal;
  aspectRatio?: TryOnAspectRatio;
}

const MODEL = 'fal-ai/flux-pro/kontext';
const TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_500;

const ASPECT_RATIOS: { label: TryOnAspectRatio; value: number }[] = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '1:1', value: 1 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '9:21', value: 9 / 21 },
];

let configuredSignature: string | null = null;

interface FalRuntime {
  /** API key langsung dari aplikasi; kosong kalau memakai proxy. */
  credentials?: string;
  /** URL proxy backend/mock yang meneruskan request ke Fal. */
  proxyUrl?: string;
}

function readRuntime(): FalRuntime {
  const credentials = process.env.EXPO_PUBLIC_FAL_KEY?.trim() || undefined;
  const proxyUrl = process.env.EXPO_PUBLIC_FAL_PROXY_URL?.trim() || undefined;

  if (!credentials && !proxyUrl) {
    throw new TryOnError(
      'API key Fal.ai belum diatur. Isi EXPO_PUBLIC_FAL_KEY di file .env (atau arahkan EXPO_PUBLIC_FAL_PROXY_URL ke proxy backend) lalu restart Expo.',
      'missing-key',
    );
  }

  return { credentials, proxyUrl };
}

function configureClient(runtime: FalRuntime): void {
  const signature = `${runtime.credentials ?? ''}|${runtime.proxyUrl ?? ''}`;

  if (configuredSignature === signature) {
    return;
  }

  fal.config({
    ...(runtime.credentials ? { credentials: runtime.credentials } : {}),
    // `when: 'always'` supaya proxy juga dipakai di native (Expo Go), bukan hanya web.
    ...(runtime.proxyUrl
      ? { proxyUrl: { url: runtime.proxyUrl, when: 'always' as const } }
      : {}),
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

function buildPrompt(namaGaya: string, promptVisual: string): string {
  return [
    'Edit the provided photo. Replace ONLY the hairstyle; everything else must stay identical.',
    '',
    `Target hairstyle: ${namaGaya}.`,
    promptVisual.trim(),
    '',
    'Hard requirements:',
    '- Keep the exact same person: identical face shape, facial features, eyes, nose, mouth, jawline, facial hair, expression, skin tone, age, and gender.',
    '- Keep the exact same background, clothing, head pose, camera angle, framing, and lighting as the input photo. Ignore any conflicting camera or lighting suggestion above.',
    '- Change only the hair: match the target length, silhouette, texture, and direction. Keep a natural hairline, realistic strands, and believable shadows.',
    '- The result must look photorealistic and unstyled, like a real photo of this same person with the new haircut.',
    '- Do not add text, watermarks, accessories, extra people, or a different environment.',
  ].join('\n');
}

/** Pilih rasio terdekat supaya model tidak mengubah framing foto pengguna. */
export function pickTryOnAspectRatio(width: number, height: number): TryOnAspectRatio | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const target = width / height;
  let closest = ASPECT_RATIOS[0];

  for (const ratio of ASPECT_RATIOS) {
    if (Math.abs(Math.log(ratio.value) - Math.log(target)) < Math.abs(Math.log(closest.value) - Math.log(target))) {
      closest = ratio;
    }
  }

  return closest.label;
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

function normalizeError(error: unknown): TryOnError {
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
export async function generateVirtualTryOn(
  base64FotoWajah: string,
  namaGaya: string,
  promptVisual: string,
  options: GenerateTryOnOptions = {},
): Promise<string> {
  const runtime = readRuntime();
  configureClient(runtime);

  const prompt = buildPrompt(namaGaya, promptVisual);

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
      throw new TryOnError('Fal.ai tidak mengembalikan gambar simulasi. Coba lagi.', 'invalid-response');
    }

    return url;
  } catch (error) {
    throw normalizeError(error);
  }
}
