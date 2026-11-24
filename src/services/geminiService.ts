import type { AnalysisConfidence, FaceRatios, FaceShapeLabel } from './faceLandmark/types';

export type GeminiErrorCode =
  | 'missing-key'
  | 'timeout'
  | 'network'
  | 'http'
  | 'rate-limit'
  | 'unavailable'
  | 'invalid-response';

interface GeminiErrorOptions {
  status?: number;
  /** `true` = layak dicoba ulang (503/429/5xx). Error lain langsung dilempar. */
  retryable?: boolean;
}

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, code: GeminiErrorCode, options: GeminiErrorOptions = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export interface HairstyleRecommendation {
  namaGaya: string;
  alasanCocok: string;
  panduanBarber: string;
  promptVisual: string;
}

export interface AiRecommendation {
  bentukWajah: string;
  rekomendasi: HairstyleRecommendation[];
}

export interface ShapeAlternatives {
  bentuk: FaceShapeLabel;
  score: number;
}

export interface RecommendationRequest {
  bentukWajah: FaceShapeLabel;
  /** Rasio terukur (panjang, dahi, rahang) supaya model tahu angkanya, bukan cuma label. */
  ratios: FaceRatios;
  confidence: AnalysisConfidence;
  /** Kandidat bentuk terdekat kedua; dipakai agar model bisa memberi catatan proporsi. */
  alternatifBentuk?: ShapeAlternatives[];
  /** Label Indonesia: Lurus, Ikal, Mengembang, Kaku / Jigrak, Kribo. */
  tipeRambut: string;
  /** Label Indonesia: Rapi & Formal, Kasual & Natural, dst. */
  preferensiGaya: string;
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview'];
const REQUEST_TIMEOUT_MS = 45_000;
const ATTEMPT_DELAYS_MS = [0, 800, 2_000];
const MAX_RECOMMENDATIONS = 3;

const SHAPE_ALIASES: [RegExp, FaceShapeLabel][] = [
  [/^(persegi\s*panjang|oblong|rectangle|rectangular|long)$/i, 'Persegi Panjang'],
  [/^(diamond|berlian)$/i, 'Diamond'],
  [/^oval$/i, 'Oval'],
  [/^(bulat|round)$/i, 'Bulat'],
  [/^(kotak|square)$/i, 'Kotak'],
  [/^(hati|heart)$/i, 'Hati'],
];

const SYSTEM_PROMPT = `Kamu adalah hairstylist sekaligus barber profesional senior di Indonesia dengan pengalaman 15 tahun menangani berbagai tekstur rambut pria tropis. Kamu membumi, jujur, dan tidak pernah menyarankan potongan yang mustahil dibentuk dengan tekstur rambut pelanggan.

Tugasmu: beri 3 rekomendasi gaya rambut yang realistis untuk satu pelanggan, berdasarkan bentuk wajah, angka rasio wajah yang benar-benar terukur, tipe rambut asli, dan preferensi gayanya.

ATURAN FISIKA RAMBUT (WAJIB DIPATUHI):
1. Kribo: DILARANG KERAS menyarankan potongan yang memaksakan rambut jatuh lurus dan rata (slick back, side part klimis, comb over, curtain lurus, Korean comma hair) KECUALI kamu menjelaskan bahwa itu butuh rebonding/relaxer dan styling panas berat. Prioritaskan potongan yang memanfaatkan coil: taper afro, curly top dengan panjang cukup, fade dengan bagian atas dibiarkan mengembang, atau twist/coil terdefinisi.
2. Mengembang: jangan sarankan gaya yang butuh rambut jatuh rata tanpa kontrol volume. Wajib sebut pengurangan massa (thinning/layering), taper di samping, dan produk yang menahan volume. Hindari "smoothed down" sebagai satu-satunya solusi.
3. Kaku/Jigrak: serat rambut berdiri sendiri dan sulit jatuh. Hindari side part klimis atau gaya yang hanya bisa jadi dengan blow dry + pomade berat, kecuali kamu menyebut kebutuhan styling harian itu. Prioritaskan textured crop, French crop, short layer, atau potongan pendek yang memanfaatkan serat kaku.
4. Lurus: aman untuk banyak gaya, tapi sebut perlunya tekstur/layer supaya tidak terlihat licin dan datar.
5. Ikal: manfaatkan pola ikal, jaga panjang saat basah, dan sebut teknik styling ringan.

ATURAN BENTUK WAJAH:
- Oval: hampir semua aman, jaga proporsi alami.
- Bulat: tambah tinggi/volume di atas, jaga sisi rapat.
- Kotak: jangan menambah lebar di rahang, beri sedikit tinggi dan tekstur lembut.
- Persegi Panjang: hindari volume berlebih di atas, beri lebar di samping.
- Hati: dahi lebar, hindari volume berlebih di atas dahi, beri keseimbangan di rahang.
- Diamond: dahi dan dagu sempit, beri lebar di dahi/pipi, hindari sisi terlalu tipis.

ATURAN MEMBACA DATA RASIO:
- "lengthToWidth" = panjang wajah dibagi lebar tulang pipi. Nilai > 1.5 berarti wajah panjang; < 1.25 berarti pendek/lebar.
- "foreheadToCheek" = lebar dahi dibagi lebar tulang pipi.
- "jawToCheek" = lebar rahang dibagi lebar tulang pipi.
- Gunakan angka ini hanya untuk mengambil keputusan. JANGAN menyebut angka mentah ke pelanggan.
- Kolom "alternatifBentuk" berisi kandidat bentuk terdekat. Kalau selisihnya kecil, sebutkan bahwa hasilnya berada di antara dua bentuk dan gaya yang dipilih tetap aman untuk keduanya.

ATURAN PREFERENSI:
- Rapi & Formal: tetap bisa disisir rapi, tidak ekstrem.
- Kasual & Natural: tekstur longgar, tidak terlihat terlalu dirapikan.
- Pendek Praktis: perawatan harian maksimal 2 menit.
- Trendy/Kekinian: bentuk modern barbershop, tetap realistis untuk teksturnya.
- "Netral (diserahkan ke barber)": pelanggan menyerahkan keputusan ke barber. Pilih 3 gaya yang paling aman untuk bentuk wajah dan teksturnya, paling mudah dieksekusi dengan clipper, dan paling sedikit butuh styling harian. Untuk ketiga gaya ini, "panduanBarber" wajib menyebut angka guard clipper di samping, panjang bagian atas dalam cm, teknik blending/elevasi fade, dan cara mengecek hasilnya sebelum pelanggan keluar dari kursi.

GAYA BAHASA:
- "alasanCocok": bahasa Indonesia santai, 2-3 kalimat, jelaskan kaitan bentuk wajah DAN tekstur rambut asli. Jangan mengulang angka rasio.
- "panduanBarber": bahasa Indonesia teknis untuk barber, 2-4 kalimat. Sebut angka clipper guard di samping, panjang bagian atas dalam cm, teknik texturizing/layering, dan finishing garis leher.
- "promptVisual": bahasa Inggris, 1-3 kalimat, deskriptif untuk image generator. Jelaskan perubahan gaya rambut pada foto orang yang sama, pertahankan identitas wajah, tampak fotorealistis, pencahayaan studio lembut, sudut tiga per empat.

FORMAT OUTPUT (WAJIB):
Isi "rekomendasi" tepat 3 item. Semua field wajib string tidak kosong.`;

/** Skema respons: Gemini memaksa bentuk JSON ini, jadi tidak perlu parsing teks bebas. */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bentukWajah: { type: 'STRING' },
    rekomendasi: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          namaGaya: { type: 'STRING' },
          alasanCocok: { type: 'STRING' },
          panduanBarber: { type: 'STRING' },
          promptVisual: { type: 'STRING' },
        },
        required: ['namaGaya', 'alasanCocok', 'panduanBarber', 'promptVisual'],
      },
    },
  },
  required: ['bentukWajah', 'rekomendasi'],
};

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (!key) {
    throw new GeminiError(
      'API key Gemini belum diatur. Isi EXPO_PUBLIC_GEMINI_API_KEY di file .env lalu restart Expo.',
      'missing-key',
    );
  }
  return key;
}

function getBaseUrl(): string {
  const base = (
    process.env.EXPO_PUBLIC_GEMINI_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
  return base;
}

/**
 * Urutan model: yang di-pin di .env lebih dulu, lalu fallback bawaan.
 * Saat pengujian, `gemini-3.5-flash-lite` sempat membalas 503 "high demand",
 * jadi rantai fallback ini bukan hiasan.
 */
function getModelChain(): string[] {
  const configured = (process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || DEFAULT_MODEL)
    .split(',')
    .map((model: string) => model.trim())
    .filter(Boolean);

  const extra = (
    process.env.EXPO_PUBLIC_GEMINI_FALLBACK_MODELS?.trim() || FALLBACK_MODELS.join(',')
  )
    .split(',')
    .map((model: string) => model.trim())
    .filter(Boolean);

  return [...new Set([...configured, ...extra])];
}

function normalizeShape(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) {
    return null;
  }

  for (const [pattern, label] of SHAPE_ALIASES) {
    if (pattern.test(clean)) {
      return label;
    }
  }

  return clean;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GeminiError(
      'Gemini mengembalikan format rekomendasi yang tidak lengkap. Coba lagi.',
      'invalid-response',
    );
  }
  return value.trim();
}

/** Membersihkan dan memvalidasi output model sebelum masuk ke UI. */
export function parseRecommendation(raw: string, fallbackShape: string): AiRecommendation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiError('JSON dari Gemini tidak bisa dibaca. Coba lagi.', 'invalid-response');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GeminiError('Struktur respons Gemini tidak dikenali.', 'invalid-response');
  }

  const record = parsed as Record<string, unknown>;
  const list = record.rekomendasi;

  if (!Array.isArray(list) || list.length === 0) {
    throw new GeminiError('Gemini tidak memberi daftar rekomendasi. Coba lagi.', 'invalid-response');
  }

  const rekomendasi = list.slice(0, MAX_RECOMMENDATIONS).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new GeminiError(
        'Ada item rekomendasi yang formatnya salah. Coba lagi.',
        'invalid-response',
      );
    }

    const entry = item as Record<string, unknown>;

    return {
      namaGaya: readString(entry, 'namaGaya'),
      alasanCocok: readString(entry, 'alasanCocok'),
      panduanBarber: readString(entry, 'panduanBarber'),
      promptVisual: readString(entry, 'promptVisual'),
    };
  });

  return {
    bentukWajah: normalizeShape(record.bentukWajah) ?? fallbackShape,
    rekomendasi,
  };
}

function describeHttpError(status: number, body: string): GeminiError {
  const detail = body.slice(0, 200).trim();

  if (status === 400) {
    return new GeminiError(
      detail
        ? `Gemini menolak permintaan (400): ${detail}`
        : 'Gemini menolak permintaan (400). Periksa nama model di EXPO_PUBLIC_GEMINI_MODEL.',
      'http',
      { status },
    );
  }
  if (status === 401 || status === 403) {
    return new GeminiError(
      'API key Gemini ditolak. Periksa kembali EXPO_PUBLIC_GEMINI_API_KEY di file .env.',
      'http',
      { status },
    );
  }
  if (status === 404) {
    return new GeminiError(
      'Model Gemini tidak tersedia untuk akun ini. Ganti EXPO_PUBLIC_GEMINI_MODEL lalu restart Expo.',
      'http',
      { status },
    );
  }
  if (status === 429) {
    return new GeminiError(
      'Kuota Gemini untuk akun ini sedang penuh. Tunggu sebentar lalu coba lagi.',
      'rate-limit',
      { status, retryable: true },
    );
  }
  if (status >= 500) {
    return new GeminiError(
      `Server Gemini sedang sibuk (${status}). Mencoba model lain…`,
      'unavailable',
      { status, retryable: true },
    );
  }

  return new GeminiError(
    detail ? `Gemini menolak permintaan (${status}): ${detail}` : `Gemini menolak permintaan (${status}).`,
    'http',
    { status },
  );
}

interface ModelAnswer {
  text: string;
  model: string;
}

async function callModel(
  model: string,
  body: string,
  apiKey: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<ModelAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Gemini memakai header ini, bukan `Authorization: Bearer`.
          'x-goog-api-key': apiKey,
        },
        body,
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GeminiError(
        'Gemini tidak merespons dalam 45 detik. Periksa koneksi lalu coba lagi.',
        'timeout',
      );
    }
    throw new GeminiError(
      'Tidak bisa menghubungi Gemini. Periksa koneksi internetmu lalu coba lagi.',
      'network',
      { retryable: true },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw describeHttpError(response.status, text);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        error?: { message?: string };
        promptFeedback?: { blockReason?: string };
      }
    | null;

  if (!payload) {
    throw new GeminiError('Respons Gemini tidak bisa dibaca.', 'invalid-response');
  }

  if (payload.error?.message) {
    throw new GeminiError(`Gemini: ${payload.error.message}`, 'http');
  }

  if (payload.promptFeedback?.blockReason) {
    throw new GeminiError(
      'Permintaan diblokir filter keamanan Gemini. Coba foto dan pilihan gaya lain.',
      'invalid-response',
    );
  }

  const candidate = payload.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new GeminiError(
        `Gemini berhenti sebelum menyelesaikan jawaban (${candidate.finishReason}). Coba lagi.`,
        'invalid-response',
      );
    }
    throw new GeminiError('Gemini mengembalikan respons kosong.', 'invalid-response');
  }

  return { text, model };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Payload yang dikirim: hanya teks terukur, foto tetap di perangkat. */
function buildRequestBody(input: RecommendationRequest): string {
  const data = {
    bentukWajah: input.bentukWajah,
    rasio: {
      lengthToWidth: Number(input.ratios.lengthToWidth.toFixed(3)),
      foreheadToCheek: Number(input.ratios.foreheadToCheek.toFixed(3)),
      jawToCheek: Number(input.ratios.jawToCheek.toFixed(3)),
    },
    keyakinanPengukuran: input.confidence,
    alternatifBentuk: (input.alternatifBentuk ?? []).map((item) => ({
      bentuk: item.bentuk,
      skor: Number(item.score.toFixed(3)),
    })),
    tipeRambut: input.tipeRambut,
    preferensiGaya: input.preferensiGaya,
  };

  return JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Data pelanggan:\n${JSON.stringify(data, null, 2)}\n\nBuat 3 rekomendasi terbaik dan balas sebagai objek JSON sesuai format.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
      maxOutputTokens: 2400,
    },
  });
}

/**
 * Memanggil Gemini untuk rekomendasi gaya rambut.
 *
 * Strategi ketahanan: tiap model dicoba beberapa kali dengan jeda pendek (karena
 * free tier sering membalas 503 "high demand"), lalu turun ke model berikutnya di
 * rantai fallback. Total waktu dibatasi `REQUEST_TIMEOUT_MS`.
 */
export async function getHairstyleRecommendations(
  input: RecommendationRequest,
): Promise<AiRecommendation> {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();
  const models = getModelChain();
  const body = buildRequestBody(input);
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  let lastError: GeminiError | null = null;

  for (const [modelIndex, model] of models.entries()) {
    for (const delay of ATTEMPT_DELAYS_MS) {
      const remaining = deadline - Date.now();

      if (remaining <= 1_000) {
        throw (
          lastError ??
          new GeminiError(
            'Gemini tidak merespons dalam 45 detik. Periksa koneksi lalu coba lagi.',
            'timeout',
          )
        );
      }

      if (delay > 0) {
        await sleep(Math.min(delay, Math.max(0, deadline - Date.now() - 1_000)));
      }

      try {
        const answer = await callModel(model, body, apiKey, baseUrl, remaining);
        return parseRecommendation(answer.text, input.bentukWajah);
      } catch (error) {
        const geminiError =
          error instanceof GeminiError
            ? error
            : new GeminiError('Rekomendasi Gemini gagal dibuat. Coba lagi.', 'network');

        if (!geminiError.retryable) {
          throw geminiError;
        }

        lastError = geminiError;

        // Model terakhir + percobaan terakhir: tidak ada lagi yang bisa dicoba.
        if (modelIndex === models.length - 1 && delay === ATTEMPT_DELAYS_MS.at(-1)) {
          throw geminiError;
        }
      }
    }
  }

  throw (
    lastError ??
    new GeminiError('Rekomendasi Gemini gagal dibuat. Coba lagi.', 'unavailable')
  );
}
