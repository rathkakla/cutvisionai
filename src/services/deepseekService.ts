import type { FaceShapeLabel } from './faceLandmark/types';

export type DeepSeekErrorCode =
  | 'missing-key'
  | 'timeout'
  | 'network'
  | 'http'
  | 'invalid-response';

export class DeepSeekError extends Error {
  readonly code: DeepSeekErrorCode;
  readonly status?: number;

  constructor(message: string, code: DeepSeekErrorCode, status?: number) {
    super(message);
    this.name = 'DeepSeekError';
    this.code = code;
    this.status = status;
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

export interface RecommendationRequest {
  bentukWajah: FaceShapeLabel;
  /** Label Indonesia: Lurus, Ikal, Mengembang, Kaku / Jigrak, Kribo. */
  tipeRambut: string;
  /** Label Indonesia: Rapi & Formal, Kasual & Natural, dst. */
  preferensiGaya: string;
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';
const TIMEOUT_MS = 45_000;
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

Tugasmu: beri 3 rekomendasi gaya rambut yang realistis untuk satu pelanggan, berdasarkan bentuk wajah, tipe rambut asli, dan preferensi gayanya.

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

ATURAN PREFERENSI:
- Rapi & Formal: tetap bisa disisir rapi, tidak ekstrem.
- Kasual & Natural: tekstur longgar, tidak terlihat terlalu dirapikan.
- Pendek Praktis: perawatan harian maksimal 2 menit.
- Trendy/Kekinian: bentuk modern barbershop, tetap realistis untuk teksturnya.

GAYA BAHASA:
- "alasanCocok": bahasa Indonesia santai, 2-3 kalimat, jelaskan kaitan bentuk wajah DAN tekstur rambut asli. Jangan mengulang angka rasio.
- "panduanBarber": bahasa Indonesia teknis untuk barber, 2-4 kalimat. Sebut angka clipper guard di samping, panjang bagian atas dalam cm, teknik texturizing/layering, dan finishing garis leher.
- "promptVisual": bahasa Inggris, 1-3 kalimat, deskriptif untuk image generator. Jelaskan perubahan gaya rambut pada foto orang yang sama, pertahankan identitas wajah, tampak fotorealistis, pencahayaan studio lembut, sudut tiga per empat.

FORMAT OUTPUT (WAJIB):
Balas HANYA dengan satu objek JSON valid, tanpa markdown, tanpa komentar, tanpa teks pembuka atau penutup. Struktur persis seperti ini:
{
  "bentukWajah": "string",
  "rekomendasi": [
    {
      "namaGaya": "string",
      "alasanCocok": "string",
      "panduanBarber": "string",
      "promptVisual": "string"
    }
  ]
}
Isi "rekomendasi" tepat 3 item. Semua field wajib string tidak kosong.`;

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new DeepSeekError(
      'API key DeepSeek belum diatur. Isi EXPO_PUBLIC_DEEPSEEK_API_KEY di file .env lalu restart Expo.',
      'missing-key',
    );
  }
  return key;
}

function getEndpoint(): string {
  const base = (process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  );
  return `${base}/chat/completions`;
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
    throw new DeepSeekError(
      'DeepSeek mengembalikan format rekomendasi yang tidak lengkap. Coba lagi.',
      'invalid-response',
    );
  }
  return value.trim();
}

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new DeepSeekError(
      'DeepSeek tidak mengembalikan JSON yang bisa dibaca. Coba lagi.',
      'invalid-response',
    );
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new DeepSeekError(
      'JSON dari DeepSeek rusak atau terpotong. Coba lagi.',
      'invalid-response',
    );
  }
}

/** Membersihkan dan memvalidasi output model sebelum masuk ke UI. */
export function parseRecommendation(raw: string, fallbackShape: string): AiRecommendation {
  const parsed = extractJsonObject(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DeepSeekError('Struktur respons DeepSeek tidak dikenali.', 'invalid-response');
  }

  const record = parsed as Record<string, unknown>;
  const list = record.rekomendasi;

  if (!Array.isArray(list) || list.length === 0) {
    throw new DeepSeekError(
      'DeepSeek tidak memberi daftar rekomendasi. Coba lagi.',
      'invalid-response',
    );
  }

  const rekomendasi = list.slice(0, MAX_RECOMMENDATIONS).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new DeepSeekError(
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

function describeHttpError(status: number, body: string): string {
  if (status === 401) {
    return 'API key DeepSeek ditolak (401). Periksa kembali EXPO_PUBLIC_DEEPSEEK_API_KEY.';
  }
  if (status === 402) {
    return 'Saldo akun DeepSeek habis (402). Isi ulang lalu coba lagi.';
  }
  if (status === 429) {
    return 'Permintaan terlalu sering ke DeepSeek (429). Tunggu sebentar lalu coba lagi.';
  }
  if (status >= 500) {
    return `Server DeepSeek sedang bermasalah (${status}). Coba lagi beberapa saat.`;
  }

  const detail = body.slice(0, 160).trim();
  return detail
    ? `DeepSeek menolak permintaan (${status}): ${detail}`
    : `DeepSeek menolak permintaan (${status}).`;
}

/**
 * Memanggil DeepSeek Chat Completions dalam mode JSON. Hanya teks (bentuk wajah, tipe
 * rambut, preferensi) yang dikirim — foto tetap di perangkat.
 */
export async function getHairstyleRecommendations(
  input: RecommendationRequest,
): Promise<AiRecommendation> {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(getEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Data pelanggan:\n${JSON.stringify(
              {
                bentukWajah: input.bentukWajah,
                tipeRambut: input.tipeRambut,
                preferensiGaya: input.preferensiGaya,
              },
              null,
              2,
            )}\n\nBuat 3 rekomendasi terbaik dan balas sebagai objek JSON sesuai format.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2200,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DeepSeekError(
        'DeepSeek tidak merespons dalam 45 detik. Periksa koneksi lalu coba lagi.',
        'timeout',
      );
    }
    throw new DeepSeekError(
      'Tidak bisa menghubungi DeepSeek. Periksa koneksi internetmu lalu coba lagi.',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new DeepSeekError(describeHttpError(response.status, body), 'http', response.status);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      }
    | null;

  if (!payload) {
    throw new DeepSeekError('Respons DeepSeek tidak bisa dibaca.', 'invalid-response');
  }

  if (payload.error?.message) {
    throw new DeepSeekError(`DeepSeek: ${payload.error.message}`, 'http');
  }

  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new DeepSeekError('DeepSeek mengembalikan respons kosong.', 'invalid-response');
  }

  return parseRecommendation(content, input.bentukWajah);
}
