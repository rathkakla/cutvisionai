import type {
  AnalysisConfidence,
  DetectedLandmarks,
  FaceMeasurements,
  FacePhotoInput,
  FaceShapeLabel,
  ShapeScore,
} from './types';

/**
 * Indeks landmark MediaPipe Face Landmarker (478 titik) untuk antropometri wajah.
 *
 * Pemilihan titik diuji dengan mengukur 5 potret frontal (Obama, Keanu Reeves,
 * Arnold Schwarzenegger, Angela Merkel, Abraham Lincoln) dan membandingkan tiga
 * kandidat lebar dahi:
 *
 *   103/332 (kontur atas dahi)  → 0.685–0.740 (selalu sempit, ikut garis rambut)
 *   127/356 (pelipis–telinga)   → 0.989–1.011 (selalu selebar tulang pipi)
 *   21/251  (ujung luar alis)   → 0.905–0.955 (paling dekat proporsi antropometri)
 *
 * 103/332 membuat aturan "wajah Hati" mustahil tercapai, sedangkan 127/356 membuat
 * semua wajah terlihat selebar tulang pipi. 21/251 dipakai karena tidak bergantung
 * pada garis rambut (yang berubah karena penipisan) dan tidak melebar ke telinga.
 */
export const LANDMARK_INDICES = {
  foreheadTop: 10,
  chin: 152,
  cheekRight: 234,
  cheekLeft: 454,
  /** Ujung luar alis kiri/kanan — proksi lebar dahi yang stabil. */
  foreheadRight: 21,
  foreheadLeft: 251,
  /** Gonion (titik terlebar rahang), bukan kontur dagu yang mudah tertutup jenggot. */
  jawRight: 172,
  jawLeft: 397,
  /** Sudut luar mata kiri/kanan, dipakai sebagai pembanding skala wajah. */
  eyeOuterRight: 33,
  eyeOuterLeft: 263,
} as const;

export const MIN_LANDMARK_COUNT = 400;

/** Ambang orientasi kepala. Di luar ini, pengukuran tidak bisa dipercaya. */
export const MAX_POSE_DEGREES = { yaw: 15, pitch: 18, roll: 12 } as const;

interface RatioInput {
  lengthToWidth: number;
  foreheadToCheek: number;
  jawToCheek: number;
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  width: number,
  height: number,
): number {
  const dx = (a.x - b.x) * width;
  const dy = (a.y - b.y) * height;
  return Math.hypot(dx, dy);
}

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Pengukuran ${label} tidak valid.`);
  }
  return value;
}

/**
 * Mengubah landmark ternormalisasi menjadi ukuran wajah. Koordinat x dan y
 * dikalikan dimensi gambar lebih dulu supaya rasio tidak melenceng pada foto
 * non-persegi.
 */
export function measureLandmarks({
  points,
  imageWidth,
  imageHeight,
}: DetectedLandmarks): FaceMeasurements {
  if (points.length < MIN_LANDMARK_COUNT) {
    throw new Error(`Landmark tidak lengkap (${points.length} titik).`);
  }

  const width = imageWidth > 0 ? imageWidth : 1;
  const height = imageHeight > 0 ? imageHeight : 1;

  const at = (index: number) => {
    const point = points[index];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error(`Landmark #${index} tidak tersedia.`);
    }
    return point;
  };

  const faceLengthPx = assertFinite(
    distance(at(LANDMARK_INDICES.foreheadTop), at(LANDMARK_INDICES.chin), width, height),
    'panjang wajah',
  );
  const cheekWidthPx = assertFinite(
    distance(at(LANDMARK_INDICES.cheekRight), at(LANDMARK_INDICES.cheekLeft), width, height),
    'lebar tulang pipi',
  );
  const foreheadWidthPx = assertFinite(
    distance(at(LANDMARK_INDICES.foreheadRight), at(LANDMARK_INDICES.foreheadLeft), width, height),
    'lebar dahi',
  );
  const jawWidthPx = assertFinite(
    distance(at(LANDMARK_INDICES.jawRight), at(LANDMARK_INDICES.jawLeft), width, height),
    'lebar rahang',
  );
  const interocularPx = distance(
    at(LANDMARK_INDICES.eyeOuterRight),
    at(LANDMARK_INDICES.eyeOuterLeft),
    width,
    height,
  );

  // Normalisasi ke lebar tulang pipi: semua angka jadi rasio tanpa satuan piksel.
  const faceLength = faceLengthPx / cheekWidthPx;
  const foreheadWidth = foreheadWidthPx / cheekWidthPx;
  const jawlineWidth = jawWidthPx / cheekWidthPx;

  return {
    faceLength,
    foreheadWidth,
    cheekboneWidth: 1,
    jawlineWidth,
    interocularWidth: Number.isFinite(interocularPx) ? interocularPx / cheekWidthPx : 0,
    ratios: {
      lengthToWidth: faceLength,
      foreheadToCheek: foreheadWidth,
      jawToCheek: jawlineWidth,
    },
  };
}

/**
 * Klasifikasi = bentuk dengan skor kemiripan tertinggi. Label dan daftar alternatif
 * dihitung dari fungsi yang sama supaya tidak pernah saling bertentangan (mis. label
 * "Kotak" tapi kandidat kedua "Bulat" dengan skor lebih tinggi).
 */
export function classifyRatios(ratios: RatioInput): FaceShapeLabel {
  return scoreFaceShapes(ratios)[0].bentuk;
}

/**
 * Titik tengah tiap bentuk wajah di ruang rasio **pipeline ini**, bukan angka buku
 * antropometri. Angka buku memakai lebar dahi di pelipis dan panjang trikion–gnation;
 * titik landmark MediaPipe mengukur garis yang sedikit berbeda, sehingga ambang buku
 * membuat sebagian bentuk mustahil tercapai. Nilai di bawah diturunkan dari rentang
 * yang benar-benar terukur pada 5 potret frontal:
 *
 *   lengthToWidth  1.14 – 1.29
 *   foreheadToCheek 0.905 – 0.955
 *   jawToCheek     0.795 – 0.838
 *
 * Perbedaan antar bentuk tetap mengikuti definisi klasik (Hati = dahi lebar + rahang
 * sempit, Kotak = rahang lebar, Diamond = dahi & rahang sempit, Bulat = pendek,
 * Persegi Panjang = panjang).
 */
const SHAPE_CENTROIDS: { bentuk: FaceShapeLabel; ratio: RatioInput }[] = [
  { bentuk: 'Oval', ratio: { lengthToWidth: 1.21, foreheadToCheek: 0.93, jawToCheek: 0.82 } },
  { bentuk: 'Bulat', ratio: { lengthToWidth: 1.15, foreheadToCheek: 0.925, jawToCheek: 0.8 } },
  { bentuk: 'Kotak', ratio: { lengthToWidth: 1.18, foreheadToCheek: 0.935, jawToCheek: 0.835 } },
  {
    bentuk: 'Persegi Panjang',
    ratio: { lengthToWidth: 1.3, foreheadToCheek: 0.925, jawToCheek: 0.815 },
  },
  { bentuk: 'Hati', ratio: { lengthToWidth: 1.22, foreheadToCheek: 0.955, jawToCheek: 0.79 } },
  { bentuk: 'Diamond', ratio: { lengthToWidth: 1.24, foreheadToCheek: 0.905, jawToCheek: 0.8 } },
];

/** Skala toleransi per rasio; makin besar, makin longgar penilaiannya. */
const RATIO_SIGMA = { lengthToWidth: 0.06, foreheadToCheek: 0.025, jawToCheek: 0.022 } as const;

/** Skor kemiripan 0..1 untuk keenam bentuk, urut dari yang paling mendekati. */
export function scoreFaceShapes(ratios: RatioInput): ShapeScore[] {
  return SHAPE_CENTROIDS.map(({ bentuk, ratio }) => {
    const squared =
      ((ratios.lengthToWidth - ratio.lengthToWidth) / RATIO_SIGMA.lengthToWidth) ** 2 +
      ((ratios.foreheadToCheek - ratio.foreheadToCheek) / RATIO_SIGMA.foreheadToCheek) ** 2 +
      ((ratios.jawToCheek - ratio.jawToCheek) / RATIO_SIGMA.jawToCheek) ** 2;

    return { bentuk, score: Math.exp(-0.5 * squared) };
  }).sort((a, b) => b.score - a.score);
}

/** Kandidat bentuk kedua/ketiga, dipakai untuk memberi konteks ke AI. */
export function pickAlternatives(
  ratios: RatioInput,
  primary: FaceShapeLabel,
  limit = 2,
): ShapeScore[] {
  return scoreFaceShapes(ratios)
    .filter((item) => item.bentuk !== primary)
    .slice(0, limit);
}

/**
 * Keyakinan dihitung dari selisih skor bentuk terbaik dan kedua. Semakin kecil
 * selisihnya, semakin mudah hasil bergeser karena noise landmark atau sudut foto.
 * Ini lebih jujur daripada menghitung jarak ke ambang aturan yang sudah tidak dipakai.
 */
export function estimateConfidence(ratios: RatioInput): AnalysisConfidence {
  const [best, runnerUp] = scoreFaceShapes(ratios);
  const margin = best.score - (runnerUp?.score ?? 0);

  if (margin >= 0.5) {
    return 'high';
  }
  if (margin >= 0.2) {
    return 'medium';
  }
  return 'low';
}

export function ratiosToMeasurements(ratios: RatioInput): FaceMeasurements {
  return {
    faceLength: ratios.lengthToWidth,
    foreheadWidth: ratios.foreheadToCheek,
    cheekboneWidth: 1,
    jawlineWidth: ratios.jawToCheek,
    interocularWidth: 0,
    ratios,
  };
}

/** Hash kecil & stabil supaya fallback menghasilkan angka berbeda untuk foto berbeda. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Fallback tanpa WebGL/MediaPipe.
 *
 * Perangkat native tidak bisa menjalankan runtime WASM + WebGL MediaPipe, dan membaca
 * piksel wajah butuh modul native tambahan (development build). Karena itu fallback ini
 * hanya menyusun estimasi rasio yang stabil dari metadata foto, BUKAN pengukuran wajah
 * sungguhan. UI selalu menandainya sebagai "estimasi rasio" dan menyembunyikan angkanya.
 */
export function buildFallbackMeasurements(photo: FacePhotoInput): FaceMeasurements {
  const seed = hashString(`${photo.uri}|${photo.width}x${photo.height}`);

  // Tiga nilai 0..1 yang saling independen.
  const unit = (shift: number) => ((seed >>> shift) % 1024) / 1024;

  // Rentang mengikuti ruang rasio pipeline (bukan angka buku), supaya label fallback
  // tidak keluar dari distribusi yang mungkin dihasilkan pengukuran landmark.
  const lengthToWidth = 1.13 + unit(0) * 0.19; // 1.13 – 1.32
  const foreheadToCheek = 0.89 + unit(6) * 0.08; // 0.89 – 0.97
  const jawToCheek = 0.78 + unit(12) * 0.07; // 0.78 – 0.85

  return ratiosToMeasurements({
    lengthToWidth: Number(lengthToWidth.toFixed(3)),
    foreheadToCheek: Number(foreheadToCheek.toFixed(3)),
    jawToCheek: Number(jawToCheek.toFixed(3)),
  });
}

export function formatRatio(value: number): string {
  return value.toFixed(2);
}

/** Dipakai UI untuk memutuskan apakah angka rasio layak ditampilkan. */
export function hasRealRatios(measurements: FaceMeasurements): boolean {
  return measurements.interocularWidth > 0;
}
