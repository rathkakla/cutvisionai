import {
  buildFallbackMeasurements,
  classifyRatios,
  estimateConfidence,
  measureLandmarks,
} from './faceLandmark/classify';
import { detectFaceLandmarks } from './faceLandmark/mediapipe';
import type { FaceAnalysis, FacePhotoInput } from './faceLandmark/types';

/**
 * `EXPO_PUBLIC_FORCE_FACE_FALLBACK=1` membuat aplikasi selalu memakai estimasi rasio.
 * Berguna untuk menguji jalur fallback tanpa mematikan WebGL.
 */
const FORCE_FALLBACK = process.env.EXPO_PUBLIC_FORCE_FACE_FALLBACK === '1';

const FALLBACK_NOTE =
  'Face-landmark tidak tersedia di perangkat ini, jadi bentuk wajah diestimasi dari rasio foto. Hasil terbaik didapat di versi web.';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Penyebab tidak diketahui.';
}

function buildFallbackAnalysis(photo: FacePhotoInput, note: string): FaceAnalysis {
  const measurements = buildFallbackMeasurements(photo);
  const faceShape = classifyRatios(measurements.ratios);

  return {
    faceShape,
    measurements,
    source: 'ratio-fallback',
    // Estimasi rasio tidak punya landmark sungguhan, jadi keyakinan selalu rendah.
    confidence: 'low',
    note,
    analyzedAt: Date.now(),
  };
}

/**
 * Pipeline deteksi bentuk wajah:
 * 1. Coba MediaPipe Face Landmarker (web, WebGL/WASM).
 * 2. Hitung rasio panjang wajah, dahi, pipi, rahang.
 * 3. Klasifikasikan ke 6 bentuk wajah.
 * 4. Jika langkah mana pun gagal, pakai estimasi rasio agar alur tetap jalan.
 */
export async function analyzeFace(photo: FacePhotoInput): Promise<FaceAnalysis> {
  if (FORCE_FALLBACK) {
    return buildFallbackAnalysis(photo, 'Mode uji: deteksi landmark dilewati (FORCE_FACE_FALLBACK=1).');
  }

  try {
    const landmarks = await detectFaceLandmarks(photo);
    const measurements = measureLandmarks(landmarks);
    const faceShape = classifyRatios(measurements.ratios);
    const confidence = estimateConfidence(measurements.ratios);

    return {
      faceShape,
      measurements,
      source: 'mediapipe',
      confidence,
      note:
        confidence === 'low'
          ? 'Rasio wajahmu berada dekat batas dua bentuk, jadi hasil ini bisa bergeser sedikit tergantung sudut foto.'
          : 'Diukur dari 468 titik wajah MediaPipe pada foto ini.',
      analyzedAt: Date.now(),
    };
  } catch (error) {
    console.warn('Face-landmark gagal, memakai estimasi rasio.', error);
    return buildFallbackAnalysis(photo, `${FALLBACK_NOTE} (${describeError(error)})`);
  }
}
