import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mode Barber adalah preferensi perangkat, bukan data sesi: kalau aktif, layar scan
 * berhenti meminta preferensi gaya dan hasil menampilkan panduan cukur lebih besar.
 *
 * Disimpan supaya barber tidak perlu menyalakannya ulang setiap kali aplikasi dibuka.
 * Semua kegagalan storage diabaikan: mode tetap berjalan di memori untuk sesi ini.
 */

const BARBER_MODE_KEY = 'cutvision.barberMode';

export async function loadBarberMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BARBER_MODE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveBarberMode(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BARBER_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Storage tidak tersedia (mis. mode privat ketat). Preferensi tetap hidup di state.
  }
}