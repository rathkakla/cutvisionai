import {
  buildFallbackMeasurements,
  classifyRatios,
  estimateConfidence,
  measureLandmarks,
  pickAlternatives,
} from './faceLandmark/classify';
import { detectFaceLandmarks } from './faceLandmark/mediapipe';
import { FaceCaptureError, type FaceAnalysis, type FacePhotoInput } from './faceLandmark/types';

/**
 * `EXPO_PUBLIC_FORCE_FACE_FALLBACK=1` membuat aplikasi selalu memakai estimasi rasio.
 * Berguna untuk menguji jalur fallback tanpa mematikan WebGL.
 */
const FORCE_FALLBACK = process.env.EXPO_PUBLIC_FORCE_FACE_FALLBACK === '1';

const FALLBACK_NOTE =
  'Face-landmark tidak tersedia di perangkat ini, jadi bentuk wajah diestimasi dari metadata foto — bukan diukur dari wajahmu. Hasil terbaik didapat di versi web.';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Penyebab tidak diketahui.';
}

/**
 * Estimasi tanpa landmark. Angkanya karangan (hash dari URI foto), jadi UI wajib
 * menyembunyikan rasio dan menandainya "estimasi".
 */
function buildFallbackAnalysis(photo: FacePhotoInput, note: string): FaceAnalysis {
  const measurements = buildFallbackMeasurements(photo);
  const faceShape = classifyRatios(measurements.ratios);

  return {
    faceShape,
    // Skor tidak dihitung: tanpa landmark, kandidat kedua hanya akan menyesatkan.
    alternatives: [],
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
 * 1. Coba MediaPipe Face Landmarker (web, WebGL/WASM) + cek orientasi kepala.
 * 2. Hitung rasio panjang wajah, dahi, dan rahang dari 478 titik.
 * 3. Klasifikasikan ke 6 bentuk wajah, plus skor kandidat terdekat.
 * 4. Jika perangkat tidak mendukung, pakai estimasi rasio agar alur tetap jalan.
 *
 * Kesalahan karena foto (tanpa wajah, dua wajah, kepala miring) TIDAK memakai
 * fallback — kesalahan itu dilempar ulang agar pengguna foto ulang.
 */
export async function analyzeFace(photo: FacePhotoInput): Promise<FaceAnalysis> {
  if (FORCE_FALLBACK) {
    return buildFallbackAnalysis(
      photo,
      'Mode uji: deteksi landmark dilewati (FORCE_FACE_FALLBACK=1).',
    );
  }

  try {
    const landmarks = await detectFaceLandmarks(photo);
    const measurements = measureLandmarks(landmarks);
    const faceShape = classifyRatios(measurements.ratios);
    const confidence = estimateConfidence(measurements.ratios);
    const alternatives = pickAlternatives(measurements.ratios, faceShape);

    const runnerUp = alternatives[0];
    const notes: string[] = ['Diukur dari 478 titik wajah MediaPipe pada foto ini.'];

    if (confidence === 'low') {
      notes.push(
        'Rasio wajahmu berada dekat batas dua bentuk, jadi hasil ini bisa bergeser sedikit tergantung sudut foto.',
      );
    }

    if (runnerUp && runnerUp.score >= 0.75) {
      notes.push(`Kandidat terdekat kedua: ${runnerUp.bentuk}.`);
    }

    return {
      faceShape,
      alternatives,
      measurements,
      landmarks: landmarks.points,
      source: 'mediapipe',
      confidence,
      note: notes.join(' '),
      analyzedAt: Date.now(),
    };
  } catch (error) {
    if (error instanceof FaceCaptureError) {
      throw error;
    }

    console.warn('Face-landmark gagal, memakai estimasi rasio.', error);
    return buildFallbackAnalysis(photo, `${FALLBACK_NOTE} (${describeError(error)})`);
  }
}
