import * as ImageManipulator from 'expo-image-manipulator';

const MAX_WIDTH = 800;
const COMPRESS_QUALITY = 0.7;
const TRY_ON_MAX_WIDTH = 1024;
const TRY_ON_QUALITY = 0.8;

export interface CompressedPhoto {
  uri: string;
  width: number;
  height: number;
}

/**
 * Mengompres foto ke lebar maksimal 800px sebelum "dikirim" ke proses analisis.
 * Kalau manipulasi gagal (mis. browser tanpa canvas), foto asli tetap dipakai
 * supaya pengguna tidak terjebak di layar scan.
 */
export async function compressFacePhoto(uri: string): Promise<CompressedPhoto> {
  try {
    const context = ImageManipulator.ImageManipulator.manipulate(uri, {
      maxWidth: MAX_WIDTH,
    });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return { uri: result.uri, width: result.width, height: result.height };
  } catch (error) {
    console.warn('Gagal mengompres foto, memakai foto asli.', error);
    return { uri, width: 0, height: 0 };
  }
}

/**
 * Membaca foto sebagai base64 JPEG yang lebih besar dari versi analisis, supaya
 * detail wajah tetap tajam saat dipakai model image-to-image Fal.ai.
 */
export async function readPhotoAsBase64(uri: string): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri, {
    maxWidth: TRY_ON_MAX_WIDTH,
  });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: TRY_ON_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('Foto tidak bisa dibaca sebagai base64.');
  }

  return result.base64;
}
