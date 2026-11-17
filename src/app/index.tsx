import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Layers,
  Lock,
  ScanFace,
  Scissors,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, Wordmark } from '@/components/brand';
import { PrimaryButton } from '@/components/primary-button';

const FEATURES = [
  {
    icon: ScanFace,
    title: 'Scan Wajah 3D',
    desc: 'Analisis geometri rahang, dahi, & bentuk kepala secara saintifik.',
    color: '#F59E0B',
  },
  {
    icon: Scissors,
    title: 'Barber Blueprint',
    desc: 'Instruksi teknis ukuran clipper (#1-#4) & garis elevasi fade.',
    color: '#38BDF8',
  },
  {
    icon: Wand2,
    title: 'Virtual Try-On',
    desc: 'Simulasi visual fotorealistis sebelum gunting pertama menyentuh rambut.',
    color: '#A78BFA',
  },
];

const PRIVACY_POINTS = [
  'Foto wajah diproses sementara di perangkat untuk membaca bentuk wajah dan tekstur rambut.',
  'Saat simulasi dibuat, foto dikirim ke Fal.ai hanya untuk merender gaya rambut. DeepSeek hanya menerima bentuk wajah, tipe rambut, dan preferensimu.',
  'Tekan "Hapus Foto & Ulangi" di akhir sesi untuk menghapus foto asli dan semua hasil simulasi dari memori aplikasi.',
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}>
          <View className="w-full max-w-md self-center flex-1 justify-between px-5 pb-6 pt-3">
            {/* Top Hero Section */}
            <View>
              {/* Pill Badge */}
              <View className="items-center">
                <View className="flex-row items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-3.5 py-1">
                  <Sparkles size={12} color="#F59E0B" />
                  <Text className="text-[11px] font-bold tracking-wider text-gold uppercase">
                    AI Barber Blueprint
                  </Text>
                </View>

                {/* Brand Logo & Title */}
                <View className="mt-4">
                  <BrandMark size={70} />
                </View>
                <View className="mt-3.5">
                  <Wordmark size="lg" />
                </View>

                <Text className="mt-2 text-center text-lg font-black tracking-tight text-white">
                  Pilih Gaya Cukur Tanpa Ragu
                </Text>
                <Text className="mt-1 text-center text-[13px] leading-5 text-white/50 px-2">
                  Temukan gaya rambut paling proporsional untuk bentuk kepalamu, lengkap dengan
                  panduan teknis untuk barber.
                </Text>
              </View>

              {/* 3 Value Proposition Cards */}
              <View className="mt-5 gap-2.5">
                {FEATURES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <View
                      key={item.title}
                      className="flex-row items-center gap-3 rounded-2xl border border-ink-border bg-ink-card p-3">
                      <View
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${item.color}15` }}>
                        <Icon size={18} color={item.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-bold text-white">{item.title}</Text>
                        <Text className="text-[11px] leading-4 text-white/45">{item.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Compact Privacy & Security Card with Expandable Details */}
              <View className="mt-3.5 rounded-2xl border border-ink-border bg-ink-card/70 p-3.5">
                <Pressable
                  onPress={() => setShowPrivacyDetails((prev) => !prev)}
                  className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5 flex-1">
                    <ShieldCheck size={18} color="#F59E0B" />
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-white">Privasi Aman & Terenkripsi</Text>
                      <Text className="text-[10.5px] text-white/40">
                        Foto tidak disimpan permanen di server
                      </Text>
                    </View>
                  </View>
                  <View className="p-1">
                    {showPrivacyDetails ? (
                      <ChevronUp size={16} color="#F59E0B" />
                    ) : (
                      <ChevronDown size={16} color="#A0A5B5" />
                    )}
                  </View>
                </Pressable>

                {showPrivacyDetails && (
                  <View className="mt-3 border-t border-ink-border pt-3 gap-2">
                    {PRIVACY_POINTS.map((point) => (
                      <View key={point} className="flex-row gap-2">
                        <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
                        <Text className="flex-1 text-[11px] leading-4 text-white/60">
                          {point}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Bottom Action Section */}
            <View className="mt-5 pt-2">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consented }}
                accessibilityLabel="Setuju foto wajah diproses sementara untuk rekomendasi dan simulasi gaya rambut"
                onPress={() => setConsented((current) => !current)}
                className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${
                  consented ? 'border-gold/40 bg-gold-soft' : 'border-ink-border bg-ink-card'
                }`}>
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md border ${
                    consented ? 'border-gold bg-gold' : 'border-white/30 bg-transparent'
                  }`}>
                  {consented ? <Check size={13} color="#0B0D13" strokeWidth={3.5} /> : null}
                </View>
                <Text className="flex-1 text-xs leading-4 font-medium text-white/80">
                  Saya setuju foto wajah diproses sementara untuk analisa dan simulasi gaya rambut.
                </Text>
              </Pressable>

              <PrimaryButton
                label="Mulai Scan Wajah 3D"
                icon={<Camera size={18} color={consented ? '#0B0D13' : '#64748B'} />}
                disabled={!consented}
                onPress={() => router.push('/scan')}
                style={{ marginTop: 12 }}
                caption={
                  consented
                    ? 'Kamera depan akan aktif di langkah berikutnya'
                    : 'Centang persetujuan untuk melanjutkan scan langsung'
                }
              />

              {/* Secondary Option: Enter Main Dashboard */}
              <Pressable
                onPress={() => router.push('/home')}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-ink-border bg-ink-card py-3.5 px-4 active:bg-ink-soft">
                <Text className="text-xs font-bold text-white/90">
                  Masuk ke Dashboard & Eksplorasi
                </Text>
                <ArrowRight size={14} color="#F59E0B" />
              </Pressable>

              <View className="mt-3 flex-row items-center justify-center gap-1.5">
                <Lock size={11} color="#64748B" />
                <Text className="text-[10px] font-medium text-white/30">
                  CutVision AI · Precision Barber Consultation
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
