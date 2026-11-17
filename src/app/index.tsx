import { useRouter } from 'expo-router';
import { ArrowRight, Camera, Check, Lock, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, Wordmark } from '@/components/brand';
import { PrimaryButton } from '@/components/primary-button';

const PRIVACY_POINTS = [
  'Foto wajah diproses sementara di perangkat untuk membaca bentuk wajah dan tekstur rambut.',
  'Saat simulasi dibuat, foto dikirim ke Fal.ai hanya untuk merender gaya rambut. DeepSeek hanya menerima bentuk wajah, tipe rambut, dan preferensimu.',
  'Tekan "Hapus Foto & Ulangi" di akhir sesi untuk menghapus foto asli dan semua hasil simulasi dari memori aplikasi.',
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}>
          <View className="w-full max-w-lg self-center flex-1 justify-between px-6 pb-6 pt-4">
            <View>
              <View className="items-center pt-1">
                <BrandMark size={76} />
                <View className="mt-5">
                  <Wordmark size="lg" />
                </View>
                <Text className="mt-2.5 text-center text-[17px] font-semibold text-white/85">
                  Pilih Gaya Cukur Tanpa Ragu
                </Text>
                <Text className="mt-2 max-w-[300px] text-center text-[13px] leading-6 text-white/45">
                  Pindai wajahmu, kenali karakter rambut, dan bawa panduan cukur yang jelas
                  ke barbershop.
                </Text>

                <View className="mt-5 flex-row items-center gap-2 rounded-full border border-gold-line bg-gold-soft px-3 py-1.5">
                  <Sparkles size={13} color="#D9822B" />
                  <Text className="text-[11px] font-semibold text-gold">
                    3 rekomendasi gaya · ±30 detik
                  </Text>
                </View>
              </View>

              <View className="mt-7 rounded-3xl border border-ink-border bg-ink-card p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-gold-soft">
                    <ShieldCheck size={20} color="#D9822B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-white">Kebijakan Privasi</Text>
                    <Text className="text-[11px] text-white/40">
                      Singkat, jelas, tanpa jebakan.
                    </Text>
                  </View>
                </View>

                <View className="mt-3.5 gap-2.5">
                  {PRIVACY_POINTS.map((point) => (
                    <View key={point} className="flex-row gap-2.5">
                      <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
                      <Text className="flex-1 text-[12px] leading-5 text-white/65">
                        {point}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className="mt-3.5 flex-row items-center gap-2 border-t border-white/5 pt-3">
                  <Lock size={12} color="#6F6F6F" />
                  <Text className="text-[11px] text-white/35">
                    Kamu tetap memegang kendali penuh atas fotomu.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-5">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consented }}
                accessibilityLabel="Setuju foto wajah diproses sementara untuk rekomendasi dan simulasi gaya rambut"
                onPress={() => setConsented((current) => !current)}
                className={`flex-row items-start gap-3 rounded-2xl border p-3.5 ${
                  consented ? 'border-gold/50 bg-gold-soft' : 'border-ink-border bg-ink-card'
                }`}>
                <View
                  className={`mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-md border ${
                    consented ? 'border-gold bg-gold' : 'border-white/25 bg-transparent'
                  }`}>
                  {consented ? <Check size={14} color="#121212" strokeWidth={3.5} /> : null}
                </View>
                <Text className="flex-1 text-[12.5px] leading-5 text-white/80">
                  Saya setuju foto wajah saya diproses sementara untuk rekomendasi dan simulasi
                  gaya rambut.
                </Text>
              </Pressable>

              <PrimaryButton
                label="Mulai Scan Wajah"
                icon={<Camera size={18} color={consented ? '#121212' : '#8A8A8A'} />}
                disabled={!consented}
                onPress={() => router.push('/scan')}
                style={{ marginTop: 14 }}
                caption={
                  consented
                    ? 'Kamera depan akan aktif di langkah berikutnya.'
                    : 'Centang persetujuan dulu untuk melanjutkan.'
                }
              />

              <View className="mt-5 flex-row items-center justify-center gap-1.5">
                <Text className="text-[10px] text-white/25">
                  Dibuat untuk kamu yang capek salah potong
                </Text>
                <ArrowRight size={10} color="#3A3A3A" />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
