import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Award,
  ChevronRight,
  Info,
  Lock,
  Moon,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCutVision } from '@/context/cutvision-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { clearSession } = useCutVision();
  const [isBarberMode, setIsBarberMode] = useState(false);

  const handleReset = () => {
    clearSession();
    Alert.alert('Selesai', 'Semua foto sementara dan hasil sesi telah dihapus dari memori.');
  };

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="border-b border-ink-border px-5 py-3">
          <Text className="text-xl font-extrabold text-white">Profil & Pengaturan</Text>
          <Text className="text-xs text-white/50 mt-0.5">Ekosistem CutVision AI</Text>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}>
          {/* User Card */}
          <View className="flex-row items-center gap-3.5 rounded-3xl border border-ink-border bg-ink-card p-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold-soft">
              <User size={28} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold text-white">Rian Pratama</Text>
              <Text className="text-xs text-white/45">rian.pratama@student.telkomuniversity.ac.id</Text>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-gold" />
                <Text className="text-[10.5px] font-bold text-gold">Early Adopter (Customer)</Text>
              </View>
            </View>
          </View>

          {/* Two-Sided Role Selector Toggle (Customer vs Barber) */}
          <View className="mt-5 rounded-2xl border border-gold/30 bg-ink-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5 flex-1 mr-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
                  <Scissors size={20} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">Mode Barber (Tukang Cukur)</Text>
                  <Text className="text-[11px] text-white/45 leading-4">
                    Tampilan ringkas untuk konsultasi langsung di kursi cukur barbershop.
                  </Text>
                </View>
              </View>
              <Switch
                value={isBarberMode}
                onValueChange={setIsBarberMode}
                trackColor={{ false: '#23293D', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {isBarberMode && (
              <View className="mt-3.5 border-t border-ink-border/80 pt-3">
                <Text className="text-[11px] font-semibold text-gold">
                  ✓ Mode Barber Aktif: Scanner akan langsung mengekstrak nomor guard clipper tanpa kuis preferensi awal.
                </Text>
              </View>
            )}
          </View>

          {/* AI Architecture & Privacy Section */}
          <View className="mt-5 gap-2.5">
            <Text className="text-xs font-extrabold uppercase tracking-widest text-white/50 px-1">
              Privasi & Keamanan Data
            </Text>

            <View className="rounded-2xl border border-ink-border bg-ink-card p-4 gap-3">
              <View className="flex-row items-center gap-3">
                <ShieldCheck size={20} color="#2DD4BF" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-white">Zero Server Photo Storage</Text>
                  <Text className="text-[10.5px] text-white/45">
                    Foto wajahmu tidak pernah disimpan secara permanen di database.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleReset}
                className="mt-1 flex-row items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger-soft py-2.5 active:opacity-80">
                <RotateCcw size={14} color="#F43F5E" />
                <Text className="text-xs font-bold text-danger">Hapus Cache Foto & Sesi</Text>
              </Pressable>
            </View>
          </View>

          {/* Academic Assessment Footer Info */}
          <View className="mt-6 rounded-2xl border border-ink-border bg-ink-card/50 p-4">
            <View className="flex-row items-center gap-2">
              <Award size={16} color="#F59E0B" />
              <Text className="text-xs font-bold text-white">Inovasi Teknologi (Assessment 1)</Text>
            </View>
            <Text className="text-[11px] text-white/45 mt-1.5 leading-4">
              CutVision: AI Craniofacial Scanning & Barber Blueprint Platform. Dikembangkan untuk ekosistem startup Telkom University.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
