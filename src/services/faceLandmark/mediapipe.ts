import type { DetectedLandmarks, FacePhotoInput } from './types';

/**
 * Stub platform native.
 *
 * MediaPipe Tasks Vision butuh runtime WASM + WebGL yang tidak tersedia di React Native
 * (termasuk Expo Go). Modul ini sengaja melempar error supaya `faceAnalysisService`
 * otomatis beralih ke estimasi rasio, bukan membuat aplikasi crash.
 */
export async function detectFaceLandmarks(_photo: FacePhotoInput): Promise<DetectedLandmarks> {
  throw new Error(
    'Deteksi face-landmark hanya tersedia di versi web. Perangkat ini memakai estimasi rasio.',
  );
}
