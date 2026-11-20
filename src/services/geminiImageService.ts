import { buildTryOnPrompt, type TryOnAspectRatio } from './tryOnPrompt';
import { TryOnError } from './tryOnTypes';

/**
 * Virtual Try-On lewat Gemini image generation (`gemini-3.1-flash-image` dan sejenisnya).
 *
 * Catatan biaya: semua model image Gemini **tidak punya free tier**. Kalau project
 * belum mengaktifkan billing, API membalas 429 dan aplikasi menampilkan pesan khusus.
 */

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 120_000;

/** Rasio yang diterima model image Gemini. Nilai lain diabaikan, bukan dipaksakan. */
const SUPPORTED_ASPECT_RATIOS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9']);

export interface GeminiTryOnOptions {
  signal?: AbortSignal;
  aspectRatio?: TryOnAspectRatio;
}

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (!key) {
    throw new TryOnError(
      'API key Gemini belum diatur. Isi EXPO_PUBLIC_GEMINI_API_KEY di file .env lalu restart Expo.',
      'missing-key',
    );
  }
  return key;
}

function getEndpoint(): string {
  const base = (
    process.env.EXPO_PUBLIC_GEMINI_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
  const model = process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  return `${base}/models/${encodeURIComponent(model)}:generateContent`;
}

function toBase64(base64: string): string {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!clean) {
    throw new TryOnError('Data foto kosong, simulasi tidak bisa dibuat.', 'invalid-response');
  }
  return clean;
}

interface GeminiImagePart {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
  text?: string;
}

function readImagePart(parts: GeminiImagePart[] | undefined): string | null {
  for (const part of parts ?? []) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      const mime = part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? 'image/png';
      return `data:${mime};base64,${inline.data}`;
    }
  }
  return null;
}

function describeError(status: number, body: string): TryOnError {
  const detail = body.slice(0, 220).trim();

  if (status === 400) {
    return new TryOnError(
      detail
        ? `Gemini menolak permintaan simulasi (400): ${detail}`
        : 'Gemini menolak permintaan simulasi. Coba gaya lain atau foto yang lebih jelas.',
      'http',
      status,
    );
  }

  if (status === 401 || status === 403) {
    return new TryOnError(
      'API key Gemini ditolak. Periksa kembali EXPO_PUBLIC_GEMINI_API_KEY.',
      'missing-key',
      status,
    );
  }

  if (status === 429) {
    return new TryOnError(
      'Akun Gemini ini belum punya kuota untuk membuat gambar (free tier tidak termasuk). Aktifkan billing di Google AI Studio, atau pakai mode try-on lain.',
      'billing',
      status,
    );
  }

  if (status >= 500) {
    return new TryOnError(
      `Server Gemini sedang bermasalah (${status}). Coba lagi beberapa saat.`,
      'http',
      status,
    );
  }

  return new TryOnError(`Gemini menolak permintaan simulasi (${status}). Coba lagi.`, 'http', status);
}

export async function generateGeminiTryOn(
  base64FotoWajah: string,
  namaGaya: string,
  promptVisual: string,
  options: GeminiTryOnOptions = {},
): Promise<string> {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const aspectRatio =
    options.aspectRatio && SUPPORTED_ASPECT_RATIOS.has(options.aspectRatio)
      ? options.aspectRatio
      : undefined;

  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: toBase64(base64FotoWajah) } },
          { text: buildTryOnPrompt(namaGaya, promptVisual) },
        ],
      },
    ],
    generationConfig: {
      // Wajib: tanpa ini model membalas teks saja.
      responseModalities: ['IMAGE'],
      ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
    },
  };

  let response: Response;

  try {
    response = await fetch(getEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TryOnError('Simulasi dibatalkan.', 'network');
    }
    throw new TryOnError(
      'Tidak bisa menghubungi Gemini. Periksa koneksi internetmu lalu coba lagi.',
      'network',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw describeError(response.status, text);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        candidates?: { content?: { parts?: GeminiImagePart[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      }
    | null;

  if (!payload) {
    throw new TryOnError('Respons Gemini tidak bisa dibaca.', 'invalid-response');
  }

  if (payload.promptFeedback?.blockReason) {
    throw new TryOnError(
      'Permintaan simulasi diblokir filter keamanan Gemini. Coba foto lain.',
      'invalid-response',
    );
  }

  const candidate = payload.candidates?.[0];
  const image = readImagePart(candidate?.content?.parts);

  if (!image) {
    throw new TryOnError(
      candidate?.finishReason && candidate.finishReason !== 'STOP'
        ? `Gemini berhenti sebelum membuat gambar (${candidate.finishReason}). Coba lagi.`
        : 'Gemini tidak mengembalikan gambar simulasi. Coba lagi.',
      'invalid-response',
    );
  }

  return image;
}
