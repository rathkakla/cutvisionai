import { useRouter } from 'expo-router';
import {
  BookmarkCheck,
  Calendar,
  Camera,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Scissors,
  Share2,
  Sparkles,
  User,
} from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BlueprintsScreen() {
  const router = useRouter();
  const [showBarberModal, setShowBarberModal] = useState(false);

  // Data mock blueprint aktif
  const activeBlueprint = {
    title: 'Modern Mid Taper Fade',
    faceShape: 'Kotak (Square)',
    date: '12 November 2026',
    clipperSpecs: [
      { part: 'Bawah / Tengkuk', guard: 'Guard #0.5 – #1', desc: 'Skin taper bersih di tepi leher' },
      { part: 'Samping / Pelipis', guard: 'Guard #2 (6mm)', desc: 'Transisi gradual ke mahkota' },
      { part: 'Bagian Atas', guard: 'Panjang 4–5 cm', desc: 'Point cutting tekstur acak' },
    ],
    barberNotes:
      'Garis pelipis dibuat soft taper. Mahkota jangan dipotong terlalu pendek agar tetap bertekstur saat jatuh ke dahi. Finishing leher natural tapering tanpa kotak kaku.',
  };

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="border-b border-ink-border px-5 py-3 flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-extrabold text-white">Blueprint Saya</Text>
            <Text className="text-xs text-white/50 mt-0.5">Panduan teknis potongan tersimpan</Text>
          </View>
          <View className="rounded-full bg-gold/15 px-3 py-1 border border-gold/30">
            <Text className="text-[11px] font-bold text-gold">1 Blueprint Aktif</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}>
          {/* Active Blueprint Card */}
          <View className="rounded-3xl border border-gold/40 bg-ink-card p-5 shadow-lg shadow-gold/10">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 rounded-full bg-gold/15 px-2.5 py-0.5 border border-gold/30">
                <Scissors size={11} color="#F59E0B" />
                <Text className="text-[10px] font-bold text-gold">Spesifikasi Barber</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Calendar size={11} color="#94A3B8" />
                <Text className="text-[10px] text-white/40">{activeBlueprint.date}</Text>
              </View>
            </View>

            <Text className="text-lg font-black text-white mt-3">{activeBlueprint.title}</Text>
            <Text className="text-xs text-white/50 mt-0.5">
              Bentuk Wajah:{' '}
              <Text className="text-gold font-semibold">{activeBlueprint.faceShape}</Text>
            </Text>

            {/* Clipper Guard Breakdown Table */}
            <View className="mt-4 rounded-2xl border border-ink-border bg-ink-soft/80 p-3.5 gap-2.5">
              {activeBlueprint.clipperSpecs.map((item, idx) => (
                <View
                  key={item.part}
                  className={`flex-row items-center justify-between ${
                    idx !== 0 ? 'border-t border-ink-border/50 pt-2' : ''
                  }`}>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-white">{item.part}</Text>
                    <Text className="text-[10.5px] text-white/45">{item.desc}</Text>
                  </View>
                  <View className="rounded-lg bg-gold/15 px-2.5 py-1 border border-gold/30">
                    <Text className="text-xs font-black text-gold">{item.guard}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Barber Notes */}
            <View className="mt-3.5 rounded-xl bg-ink-border/40 p-3">
              <Text className="text-[11px] font-bold text-white/80">Instruksi Khusus Barber:</Text>
              <Text className="text-[11px] leading-4 text-white/60 mt-1">
                {activeBlueprint.barberNotes}
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="mt-4 gap-2">
              <Pressable
                onPress={() => setShowBarberModal(true)}
                className="w-full flex-row items-center justify-center gap-2 rounded-2xl bg-gold py-3.5 active:opacity-90 shadow-md shadow-gold/20">
                <Scissors size={16} color="#0B0D13" strokeWidth={2.5} />
                <Text className="text-sm font-black text-[#0B0D13]">
                  Tunjukkan ke Barber (Layar Penuh)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* New Scan CTA */}
          <View className="mt-5 rounded-2xl border border-ink-border bg-ink-card p-4 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-bold text-white">Mau ganti model rambut?</Text>
              <Text className="text-xs text-white/45 mt-0.5">
                Scan wajah ulang untuk rekomendasi gaya baru.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/scan')}
              className="rounded-xl border border-gold/40 bg-gold/15 px-3.5 py-2">
              <Text className="text-xs font-bold text-gold">Scan Ulang</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Full-Screen Barber Mode Modal */}
        <Modal
          visible={showBarberModal}
          animationType="slide"
          onRequestClose={() => setShowBarberModal(false)}>
          <View className="flex-1 bg-[#0B0D13] p-6 justify-between">
            <SafeAreaView className="flex-1 justify-between">
              <View>
                {/* Header */}
                <View className="flex-row items-center justify-between border-b border-white/10 pb-4">
                  <View className="flex-row items-center gap-2">
                    <Scissors size={24} color="#F59E0B" />
                    <Text className="text-lg font-black tracking-wider text-gold uppercase">
                      BARBER BLUEPRINT
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setShowBarberModal(false)}
                    className="rounded-full bg-white/10 px-3 py-1">
                    <Text className="text-xs font-bold text-white">Tutup</Text>
                  </Pressable>
                </View>

                {/* Big Target Haircut Name */}
                <View className="mt-6">
                  <Text className="text-xs font-bold tracking-widest uppercase text-white/50">
                    TARGET POTONGAN:
                  </Text>
                  <Text className="text-2xl font-black text-white mt-1">
                    {activeBlueprint.title}
                  </Text>
                  <Text className="text-xs text-gold font-semibold mt-1">
                    Kraniofasial: {activeBlueprint.faceShape}
                  </Text>
                </View>

                {/* High Contrast Specifications for Barber */}
                <View className="mt-6 rounded-2xl border-2 border-gold/50 bg-[#161B29] p-5 gap-4">
                  {activeBlueprint.clipperSpecs.map((item) => (
                    <View key={item.part} className="border-b border-white/10 pb-3">
                      <Text className="text-xs font-bold uppercase text-white/50">{item.part}</Text>
                      <Text className="text-xl font-black text-gold mt-0.5">{item.guard}</Text>
                      <Text className="text-xs text-white/70 mt-1">{item.desc}</Text>
                    </View>
                  ))}
                  <View>
                    <Text className="text-xs font-bold uppercase text-white/50">Finishing</Text>
                    <Text className="text-xs text-white/80 mt-1 leading-5">
                      {activeBlueprint.barberNotes}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="items-center pb-4">
                <Text className="text-xs text-white/40 text-center">
                  📱 Berikan layar ini langsung ke barber sebelum gunting pertama menyentuh rambut.
                </Text>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
