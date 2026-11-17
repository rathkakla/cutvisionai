import type {
  AnalysisConfidence,
  DetectedLandmarks,
  FaceMeasurements,
  FacePhotoInput,
  FaceShapeLabel,
} from './types';

/**
 * Indeks landmark MediaPipe Face Mesh (468 titik) yang relevan untuk antropometri wajah.
 * Referensi: canonical face mesh — 10 puncak dahi, 152 dagu, 234/454 pipi terlebar,
 * 127/356 pelipis, 172/397 sudut rahang.
 */
export const LANDMARK_INDICES = {
  foreheadTop: 10,
  chin: 152,
  cheekRight: 234,
  cheekLeft: 454,
  templeRight: 127,
  templeLeft: 356,
  jawRight: 172,
  jawLeft: 397,
} as const;

export const MIN_LANDMARK_COUNT = 400;

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
 * Mengubah landmark ternormalisasi menjadi 4 ukuran wajah. Koordinat x dan y dikalikan
 * dimensi gambar lebih dulu supaya rasio tidak melenceng pada foto non-persegi.
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
  const foreheadWidthPx = distance(
    at(LANDMARK_INDICES.templeRight),
    at(LANDMARK_INDICES.templeLeft),
    width,
    height,
  );
  const jawWidthPx = distance(
    at(LANDMARK_INDICES.jawRight),
    at(LANDMARK_INDICES.jawLeft),
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
    ratios: {
      lengthToWidth: faceLength,
      foreheadToCheek: foreheadWidth,
      jawToCheek: jawlineWidth,
    },
  };
}

/**
 * Klasifikasi rule-based dari rasio wajah. Urutan aturan penting: bentuk yang paling
 * spesifik (Persegi Panjang, lalu Bulat/Kotak pendek, Diamond, Hati) diperiksa lebih dulu
 * sebelum jatuh ke Oval sebagai bentuk paling netral.
 */
export function classifyRatios(ratios: RatioInput): FaceShapeLabel {
  const { lengthToWidth, foreheadToCheek, jawToCheek } = ratios;

  if (lengthToWidth >= 1.55) {
    return 'Persegi Panjang';
  }

  if (lengthToWidth <= 1.25) {
    return jawToCheek >= 0.84 ? 'Kotak' : 'Bulat';
  }

  if (foreheadToCheek <= 0.82 && jawToCheek <= 0.8) {
    return 'Diamond';
  }

  if (foreheadToCheek >= 0.9 && jawToCheek <= 0.76) {
    return 'Hati';
  }

  if (jawToCheek >= 0.88) {
    return 'Kotak';
  }

  return 'Oval';
}

const DECISION_BOUNDARIES: [keyof RatioInput, number][] = [
  ['lengthToWidth', 1.55],
  ['lengthToWidth', 1.25],
  ['jawToCheek', 0.84],
  ['foreheadToCheek', 0.82],
  ['jawToCheek', 0.8],
  ['foreheadToCheek', 0.9],
  ['jawToCheek', 0.76],
  ['jawToCheek', 0.88],
];

/**
 * Keyakinan dihitung dari jarak rasio ke ambang keputusan terdekat. Semakin dekat ke
 * ambang, semakin mudah hasil bergeser hanya karena sudut foto — jadi keyakinannya rendah.
 */
export function estimateConfidence(ratios: RatioInput): AnalysisConfidence {
  const slack = Math.min(
    ...DECISION_BOUNDARIES.map(([key, boundary]) => Math.abs(ratios[key] - boundary)),
  );

  if (slack >= 0.07) {
    return 'high';
  }
  if (slack >= 0.03) {
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
 * sungguhan. UI selalu menandainya sebagai "estimasi rasio" agar tidak menyesatkan.
 */
export function buildFallbackMeasurements(photo: FacePhotoInput): FaceMeasurements {
  const seed = hashString(`${photo.uri}|${photo.width}x${photo.height}`);

  // Tiga nilai 0..1 yang saling independen.
  const unit = (shift: number) => ((seed >>> shift) % 1024) / 1024;

  const lengthToWidth = 1.2 + unit(0) * 0.48; // 1.20 – 1.68
  const foreheadToCheek = 0.76 + unit(6) * 0.24; // 0.76 – 1.00
  const jawToCheek = 0.7 + unit(12) * 0.24; // 0.70 – 0.94

  return ratiosToMeasurements({
    lengthToWidth: Number(lengthToWidth.toFixed(3)),
    foreheadToCheek: Number(foreheadToCheek.toFixed(3)),
    jawToCheek: Number(jawToCheek.toFixed(3)),
  });
}

export function formatRatio(value: number): string {
  return value.toFixed(2);
}
