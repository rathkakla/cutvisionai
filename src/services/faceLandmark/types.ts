/** Enam bentuk wajah yang dipakai konsisten di seluruh aplikasi. */
export type FaceShapeLabel =
  | 'Oval'
  | 'Bulat'
  | 'Kotak'
  | 'Persegi Panjang'
  | 'Hati'
  | 'Diamond';

/** Titik hasil deteksi face-landmark (koordinat ternormalisasi 0..1). */
export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface DetectedLandmarks {
  points: LandmarkPoint[];
  /** Dimensi gambar asli dalam piksel, dipakai agar rasio tidak terdistorsi aspect ratio. */
  imageWidth: number;
  imageHeight: number;
}

export interface FaceRatios {
  /** Panjang wajah (atas dahi → dagu) dibagi lebar tulang pipi. */
  lengthToWidth: number;
  /** Lebar dahi dibagi lebar tulang pipi. */
  foreheadToCheek: number;
  /** Lebar rahang dibagi lebar tulang pipi. */
  jawToCheek: number;
}

export interface FaceMeasurements {
  /** Semua ukuran dalam satuan relatif terhadap lebar tulang pipi (= 1). */
  faceLength: number;
  foreheadWidth: number;
  cheekboneWidth: number;
  jawlineWidth: number;
  ratios: FaceRatios;
}

/** `mediapipe` = landmark sungguhan; `ratio-fallback` = estimasi rasio saat WebGL/model tidak tersedia. */
export type DetectionSource = 'mediapipe' | 'ratio-fallback';

export type AnalysisConfidence = 'high' | 'medium' | 'low';

export interface FaceAnalysis {
  faceShape: FaceShapeLabel;
  measurements: FaceMeasurements;
  source: DetectionSource;
  confidence: AnalysisConfidence;
  /** Penjelasan singkat untuk ditampilkan di UI (mis. alasan fallback dipakai). */
  note: string;
  analyzedAt: number;
}

/** Foto minimal yang dibutuhkan pipeline analisis. */
export interface FacePhotoInput {
  uri: string;
  width: number;
  height: number;
}
