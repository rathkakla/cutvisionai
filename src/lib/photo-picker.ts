import * as ImagePicker from 'expo-image-picker';

import type { PhotoPickOutcome } from './photo-picker.types';

type PickResult = ImagePicker.ImagePickerResult;

/**
 * Membuka galeri. `allowsEditing` memakai editor bawaan sistem (crop 4:5), tapi di
 * sebagian perangkat kombinasi editor + foto besar/HEIC gagal total. Kalau itu terjadi,
 * buka ulang tanpa editor supaya pengguna tetap bisa memilih foto.
 */
async function launchLibrary(): Promise<PickResult> {
  try {
    return await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.9,
      selectionLimit: 1,
    });
  } catch (error) {
    console.warn('Editor foto gagal dibuka, memilih tanpa crop.', error);
    return ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      selectionLimit: 1,
    });
  }
}

/**
 * Memilih foto dari galeri pada perangkat native (Android/iOS).
 *
 * Izin galeri diminta lebih dulu supaya layar scan bisa membedakan
 * "pengguna membatalkan" dari "izin ditolak" dan menampilkan pesan yang tepat.
 */
export async function pickPhotoFromLibrary(): Promise<PhotoPickOutcome> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return { status: 'denied' };
    }
  } catch (error) {
    // Sebagian perangkat/versi Android tidak punya izin galeri terpisah (photo picker
    // sistem tidak butuh izin). Jangan blokir pengguna hanya karena API izin gagal.
    console.warn('Permintaan izin galeri gagal, lanjut membuka picker.', error);
  }

  const result = await launchLibrary();
  const asset = result.canceled ? null : result.assets?.[0];

  if (!asset) {
    return { status: 'cancelled' };
  }

  if (!asset.uri) {
    return { status: 'unsupported' };
  }

  return {
    status: 'picked',
    photo: { uri: asset.uri, width: asset.width, height: asset.height },
  };
}

/**
 * Di native file dikelola image picker sebagai file sementara, jadi tidak ada
 * object URL aplikasi yang perlu dilepas. Fungsi ini ada supaya pemanggil bisa
 * memakai API yang sama di web dan native.
 */
export function releasePickedPhotos(): void {}
