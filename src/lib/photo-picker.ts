import * as ImagePicker from 'expo-image-picker';

import type { PhotoPickOutcome } from './photo-picker.types';

/**
 * Memilih foto dari galeri pada perangkat native (Android/iOS).
 *
 * Izin galeri diminta lebih dulu supaya layar scan bisa membedakan
 * "pengguna membatalkan" dari "izin ditolak" dan menampilkan pesan yang tepat.
 */
export async function pickPhotoFromLibrary(): Promise<PhotoPickOutcome> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { status: 'denied' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 5],
    quality: 0.9,
  });

  const asset = result.canceled ? null : result.assets?.[0];

  if (!asset) {
    return { status: 'cancelled' };
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
