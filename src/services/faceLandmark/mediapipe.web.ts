import type { FaceLandmarker } from '@mediapipe/tasks-vision';

import type { DetectedLandmarks, FacePhotoInput } from './types';

/**
 * Runtime MediaPipe hanya tersedia di web. WASM + WebGL tidak bisa dijalankan di
 * React Native/Expo Go, jadi platform native memakai `mediapipe.ts` (fallback).
 *
 * Catatan: `vision_bundle.mjs` TIDAK di-import lewat bundler. Bundle resmi berisi
 * `import(t.toString())` yang ditolak Metro. Modulnya dimuat sebagai ES module dari
 * CDN lewat <script type="module">, lalu tipenya tetap dipakai sebagai `import type`.
 */
const VISION_VERSION = '1.2.3';
const VISION_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL = '/models/face_landmarker.task';
const INIT_TIMEOUT_MS = 25_000;
const DETECT_TIMEOUT_MS = 20_000;

type VisionModule = typeof import('@mediapipe/tasks-vision');

declare global {
  interface Window {
    __cutVisionVision?: VisionModule;
  }
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
let visionPromise: Promise<VisionModule> | null = null;

/**
 * MediaPipe/LiteRT mencetak log native (XNNPACK, gl_context, dsb.) lewat console.error.
 * Di dev, LogBox menampilkannya sebagai toast merah yang menutupi UI. Filter hanya
 * baris log milik MediaPipe, pesan lain tetap lewat.
 */
const MEDIAPIPE_LOG_PATTERNS = [
  /TensorFlow Lite/i,
  /XNNPACK/i,
  /face_landmarker_graph/i,
  /gl_context\.cc/i,
  /Graph successfully started/i,
  /^[IWE]\d{4} \d{2}:/,
];

let logsFiltered = false;

function isMediaPipeLog(value: unknown): boolean {
  return (
    typeof value === 'string' && MEDIAPIPE_LOG_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function silenceMediaPipeLogs(): void {
  if (logsFiltered || process.env.NODE_ENV === 'production') {
    return;
  }
  logsFiltered = true;

  (['log', 'warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (isMediaPipeLog(args[0])) {
        return;
      }
      original(...args);
    };
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function loadVisionModule(): Promise<VisionModule> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Face-landmark hanya bisa berjalan di browser.'));
  }

  if (window.__cutVisionVision) {
    return Promise.resolve(window.__cutVisionVision);
  }

  if (visionPromise) {
    return visionPromise;
  }

  visionPromise = new Promise<VisionModule>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('cutvision:vision-ready', handleReady);
    };

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (error) {
        document
          .querySelectorAll('script[data-cutvision-mediapipe]')
          .forEach((element) => element.remove());
        visionPromise = null;
        reject(error);
        return;
      }

      const module = window.__cutVisionVision;
      if (!module) {
        visionPromise = null;
        reject(new Error('Runtime MediaPipe tidak tersedia di halaman ini.'));
        return;
      }
      resolve(module);
    };

    const handleReady = () => finish();
    const timer = setTimeout(
      () => finish(new Error('Runtime MediaPipe tidak selesai dimuat.')),
      INIT_TIMEOUT_MS,
    );
    const poll = setInterval(() => {
      if (window.__cutVisionVision) {
        finish();
      }
    }, 150);

    window.addEventListener('cutvision:vision-ready', handleReady);

    if (!document.querySelector('script[data-cutvision-mediapipe]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.dataset.cutvisionMediapipe = 'true';
      script.textContent = [
        `import * as vision from ${JSON.stringify(VISION_SCRIPT_URL)};`,
        'window.__cutVisionVision = vision;',
        "window.dispatchEvent(new Event('cutvision:vision-ready'));",
      ].join('\n');
      document.head.appendChild(script);
    }
  });

  return visionPromise;
}

function assertWebGlSupport(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Face-landmark hanya bisa berjalan di browser.');
  }

  const canvas = document.createElement('canvas');
  const context =
    canvas.getContext('webgl2') ??
    canvas.getContext('webgl') ??
    canvas.getContext('experimental-webgl');

  if (!context) {
    throw new Error('WebGL tidak aktif di browser ini.');
  }
}

async function createLandmarker(): Promise<FaceLandmarker> {
  assertWebGlSupport();
  silenceMediaPipeLogs();

  const vision = await withTimeout(
    loadVisionModule(),
    INIT_TIMEOUT_MS,
    'Waktu habis saat memuat runtime MediaPipe.',
  );
  const fileset = await withTimeout(
    vision.FilesetResolver.forVisionTasks(WASM_ROOT),
    INIT_TIMEOUT_MS,
    'Waktu habis saat memuat runtime MediaPipe.',
  );

  let lastError: unknown = null;

  // GPU lebih cepat, tapi sebagian browser/GPU driver memblokir shader MediaPipe.
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      return await withTimeout(
        vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate,
          },
          runningMode: 'IMAGE',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        }),
        INIT_TIMEOUT_MS,
        'Waktu habis saat menyiapkan model face-landmark.',
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Model face-landmark gagal dimuat: ${lastError.message}`
      : 'Model face-landmark gagal dimuat.',
  );
}

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((error) => {
      // Jangan simpan promise yang gagal, supaya percobaan berikutnya bisa mengulang.
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Foto tidak bisa dibaca untuk deteksi wajah.'));
    image.src = uri;
  });
}

/**
 * Mendeteksi 468 landmark wajah dari URI foto (blob/data URL di web).
 * Melempar error yang jelas bila WebGL, model, atau wajah tidak tersedia — pemanggil
 * akan menangkapnya dan memakai fallback rasio.
 */
export async function detectFaceLandmarks(photo: FacePhotoInput): Promise<DetectedLandmarks> {
  const landmarker = await getLandmarker();
  const image = await withTimeout(
    loadImage(photo.uri),
    DETECT_TIMEOUT_MS,
    'Waktu habis saat membaca foto.',
  );

  const result = await withTimeout(
    Promise.resolve(landmarker.detect(image)),
    DETECT_TIMEOUT_MS,
    'Waktu habis saat mendeteksi wajah.',
  );

  const landmarks = result.faceLandmarks?.[0];

  if (!landmarks || landmarks.length === 0) {
    throw new Error('Tidak ada wajah yang terdeteksi di foto.');
  }

  return {
    points: landmarks.map((point) => ({ x: point.x, y: point.y })),
    imageWidth: image.naturalWidth || image.width || photo.width,
    imageHeight: image.naturalHeight || image.height || photo.height,
  };
}
