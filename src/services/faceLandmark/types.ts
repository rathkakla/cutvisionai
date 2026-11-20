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

/** Orientasi kepala dalam derajat, dihitung dari matriks transformasi MediaPipe. */
export interface HeadPose {
  /** Menoleh kiri/kanan. */
  yaw: number;
  /** Mendongak/menunduk. */
  pitch: number;
  /** Kepala miring. */
  roll: number;
}

export interface DetectedLandmarks {
  points: LandmarkPoint[];
  /** Dimensi gambar asli dalam piksel, dipakai agar rasio tidak terdistorsi aspect ratio. */
  imageWidth: number;
  imageHeight: number;
  /** Terisi kalau model mengembalikan matriks transformasi. */
  pose?: HeadPose;
  /** Jumlah wajah yang terdeteksi; > 1 berarti foto tidak bisa dipakai. */
  faceCount?: number;
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
  /** Jarak antar sudut luar mata, dipakai sebagai pembanding skala wajah. */
  interocularWidth: number;
  ratios: FaceRatios;
}

/** Skor kemiripan terhadap satu bentuk wajah (0..1). */
export interface ShapeScore {
  bentuk: FaceShapeLabel;
  score: number;
}

/** `mediapipe` = landmark sungguhan; `ratio-fallback` = estimasi rasio saat WebGL/model tidak tersedia. */
export type DetectionSource = 'mediapipe' | 'ratio-fallback';

export type AnalysisConfidence = 'high' | 'medium' | 'low';

export interface FaceAnalysis {
  faceShape: FaceShapeLabel;
  /** Kandidat bentuk terdekat, urut dari skor tertinggi. Dipakai untuk memberi konteks ke AI. */
  alternatives: ShapeScore[];
  measurements: FaceMeasurements;
  /** 478 titik ternormalisasi, hanya ada saat sumbernya MediaPipe. Dipakai untuk overlay. */
  landmarks?: LandmarkPoint[];
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

export type FaceCaptureCode = 'no-face' | 'multi-face' | 'pose' | 'too-small';

/**
 * Kesalahan yang disebabkan oleh fotonya, bukan oleh teknis perangkat.
 * Kesalahan ini TIDAK boleh jatuh ke estimasi rasio — pengguna harus foto ulang,
 * karena estimasi rasio menghasilkan angka karangan.
 */
export class FaceCaptureError extends Error {
  readonly code: FaceCaptureCode;
  /** Saran singkat untuk pengguna. */
  readonly hint: string;

  constructor(message: string, code: FaceCaptureCode, hint: string) {
    super(message);
    this.name = 'FaceCaptureError';
    this.code = code;
    this.hint = hint;
  }
}
