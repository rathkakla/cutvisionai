import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BookmarkCheck,
  Calendar,
  Camera,
  ChevronRight,
  Clock,
  Compass,
  Info,
  ScanFace,
  Scissors,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, Wordmark } from '@/components/brand';

const TRENDING_HAIRSTYLES = [
  {
    id: 'french-crop',
    name: 'Textured French Crop',
    faceMatch: 'Kotak & Oval',
    clipper: 'Guard #1 – #2',
    tag: 'Paling Populer',
    desc: 'Fade samping rapat dengan tekstur crop di atas, minim styling harian.',
  },
  {
    id: 'mid-taper',
    name: 'Modern Mid Taper Fade',
    faceMatch: 'Semua Bentuk Wajah',
    clipper: 'Guard #0.5 – #2',
    tag: 'Klasik Bersih',
    desc: 'Transisi bersih di pelipis dan tengkuk tanpa memotong jambang terlalu tinggi.',
  },
  {
    id: 'two-block',
    name: 'Two-Block Drop Fade',
    faceMatch: 'Lonjong & Diamond',
    clipper: 'Guard #3 Undercut',
    tag: 'Trendy',
    desc: 'Volume samping terkontrol dengan bagian mahkota jatuh alami berlayer.',
  },
  {
    id: 'low-fade-quiff',
    name: 'Textured Quiff Fade',
    faceMatch: 'Bulat & Kotak',
    clipper: 'Guard #1 – #3',
    tag: 'Elongasi Wajah',
    desc: 'Memberikan ilusi tinggi di atas dahi untuk menyeimbangkan wajah bulat.',
  },
];

const FACE_SHAPES = [
  { name: 'Oval', ratio: '1.5 : 1', tip: 'Proporsional, bebas hampir semua style.' },
  { name: 'Kotak', ratio: '1 : 1', tip: 'Rahang tegas, cocok fade samping rapat.' },
  { name: 'Bulat', ratio: '1 : 1', tip: 'Perlu volume atas untuk elongasi wajah.' },
  { name: 'Diamond', ratio: '1.4 : 1', tip: 'Pipi lebar, hindari sisi terlalu tipis.' },
  { name: 'Lonjong', ratio: '1.7 : 1', tip: 'Hindari volume tinggi di mahkota.' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [selectedShape, setSelectedShape] = useState<string | null>(null);

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Top App Bar */}
        <View className="flex-row items-center justify-between border-b border-ink-border/80 px-5 py-3.5 bg-ink">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-gold-soft">
              <Scissors size={18} color="#F59E0B" />
            </View>
            <View>
              <Text className="text-sm font-black tracking-tight text-white">CutVision AI</Text>
              <Text className="text-[10px] font-medium text-white/45">Smart Barber Blueprint</Text>
            </View>
          </View>

          {/* User Mode Pill */}
          <View className="flex-row items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-3 py-1">
            <View className="h-1.5 w-1.5 rounded-full bg-gold" />
            <Text className="text-[11px] font-bold text-gold">Mode Pelanggan</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="px-5 pt-4 gap-5">
            {/* Greeting & Header */}
            <View>
              <Text className="text-xl font-extrabold tracking-tight text-white">
                Halo, Bro! 👋
              </Text>
              <Text className="text-xs text-white/50 mt-0.5">
                Temukan potongan rambut presisi sesuai geometri kepala & wajahmu.
              </Text>
            </View>

            {/* Main Hero Card: 3D Craniofacial Scan */}
            <View className="overflow-hidden rounded-3xl border border-gold/40 bg-ink-card p-5 shadow-xl shadow-gold/15">
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3 py-1">
                  <Sparkles size={12} color="#F59E0B" />
                  <Text className="text-[11px] font-bold text-gold">AI Facial Landmark</Text>
                </View>
                <View className="flex-row items-center gap-1 text-white/40">
                  <Clock size={12} color="#94A3B8" />
                  <Text className="text-[11px] text-white/40">±30 detik</Text>
                </View>
              </View>

              <Text className="mt-3.5 text-lg font-black text-white">
                Scan Wajah & Analisis Geometri
              </Text>
              <Text className="mt-1 text-xs leading-5 text-white/55">
                Kamera membaca 468 titik biometrik wajahmu dan merekomendasikan gaya serta ukuran
                clipper yang 100% pas.
              </Text>

              {/* Action Button inside Card */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/scan')}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-gold py-3.5 px-4 active:opacity-90 shadow-md shadow-gold/25">
                <Camera size={18} color="#0B0D13" strokeWidth={2.5} />
                <Text className="text-sm font-black text-[#0B0D13]">Mulai Scan Wajah 3D</Text>
              </Pressable>

              <View className="mt-3 flex-row items-center justify-between border-t border-ink-border pt-2.5">
                <View className="flex-row items-center gap-1.5">
                  <ShieldCheck size={12} color="#2DD4BF" />
                  <Text className="text-[10px] font-medium text-white/40">On-Device Landmark</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Scissors size={12} color="#F59E0B" />
                  <Text className="text-[10px] font-medium text-white/40">Siap Blueprint Barber</Text>
                </View>
              </View>
            </View>

            {/* Quick Reminder / Active Blueprint Status */}
            <View className="flex-row items-center justify-between rounded-2xl border border-ink-border bg-ink-card/70 p-3.5">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-glow">
                  <Calendar size={18} color="#38BDF8" />
                </View>
                <View>
                  <Text className="text-xs font-bold text-white">Siklus Cukur Rutin</Text>
                  <Text className="text-[11px] text-white/45">Rekomendasi trim: tiap 3–4 minggu</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/blueprints')}
                className="flex-row items-center gap-1 rounded-lg bg-ink-soft px-2.5 py-1.5 active:bg-ink-border">
                <Text className="text-[11px] font-bold text-gold">Riwayat</Text>
                <ChevronRight size={13} color="#F59E0B" />
              </Pressable>
            </View>

            {/* Craniofacial Face Shapes Guide */}
            <View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <ScanFace size={16} color="#F59E0B" />
                  <Text className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Bentuk Wajah & Karakteristik
                  </Text>
                </View>
                <Text className="text-[10px] text-white/40">Ketuk untuk tips</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5 -mx-5 px-5">
                <View className="flex-row gap-2.5">
                  {FACE_SHAPES.map((shape) => {
                    const isSelected = selectedShape === shape.name;
                    return (
                      <Pressable
                        key={shape.name}
                        onPress={() => setSelectedShape(isSelected ? null : shape.name)}
                        className={`rounded-2xl border p-3 min-w-[130px] ${
                          isSelected ? 'border-gold bg-gold/15' : 'border-ink-border bg-ink-card'
                        }`}>
                        <Text className="text-xs font-black text-white">{shape.name}</Text>
                        <Text className="text-[10px] text-gold mt-0.5">Rasio: {shape.ratio}</Text>
                        <Text className="text-[10.5px] leading-4 text-white/50 mt-1.5">
                          {shape.tip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Trending Hairstyles 2026/2027 */}
            <View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <TrendingUp size={16} color="#F59E0B" />
                  <Text className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Tren Gaya Barber 2026/2027
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push('/catalog')}
                  className="flex-row items-center gap-0.5">
                  <Text className="text-xs font-bold text-gold">Lihat Semua</Text>
                  <ChevronRight size={12} color="#F59E0B" />
                </Pressable>
              </View>

              <View className="mt-3 gap-2.5">
                {TRENDING_HAIRSTYLES.map((style) => (
                  <View
                    key={style.id}
                    className="rounded-2xl border border-ink-border bg-ink-card p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-white">{style.name}</Text>
                          <View className="rounded-md bg-gold/15 px-1.5 py-0.5">
                            <Text className="text-[9.5px] font-bold text-gold">{style.tag}</Text>
                          </View>
                        </View>
                        <Text className="text-xs text-white/45 mt-1 leading-4">{style.desc}</Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between border-t border-ink-border/80 pt-2.5">
                      <Text className="text-[11px] text-white/60">
                        Bentuk: <Text className="font-semibold text-white">{style.faceMatch}</Text>
                      </Text>
                      <View className="flex-row items-center gap-1 rounded-md bg-ink-soft px-2 py-0.5">
                        <Scissors size={10} color="#F59E0B" />
                        <Text className="text-[10px] font-semibold text-gold">{style.clipper}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Barber Consultation Pro-Tip Card */}
            <View className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4">
              <View className="flex-row items-center gap-2">
                <Info size={16} color="#38BDF8" />
                <Text className="text-xs font-bold text-white">Tips Konsultasi Barber</Text>
              </View>
              <Text className="text-xs leading-5 text-white/60 mt-1.5">
                Jangan katakan &quot;mas rapihin aja&quot;. Gunakan lembar Blueprint dari CutVision untuk
                menyebut nomor clipper guard dan batas garis fade yang jelas.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
