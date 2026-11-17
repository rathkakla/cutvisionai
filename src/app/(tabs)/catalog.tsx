import { useRouter } from 'expo-router';
import { Camera, Check, Filter, Scissors, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';

const CATEGORIES = ['Semua', 'Fade & Taper', 'Crop & Short', 'Medium & Layer', 'Buzz & Neat'];

const CATALOG_ITEMS = [
  {
    id: '1',
    name: 'Low Taper Fade',
    category: 'Fade & Taper',
    faces: ['Oval', 'Kotak', 'Bulat'],
    guard: 'Guard #1 – #2',
    hairTexture: 'Lurus, Ikal, Gelombang',
    desc: 'Fade halus di bagian bawah jambang dan leher, mempertahankan ketebalan sisi tengah.',
  },
  {
    id: '2',
    name: 'Textured French Crop',
    category: 'Crop & Short',
    faces: ['Kotak', 'Oval'],
    guard: 'Guard #1.5',
    hairTexture: 'Lurus, Kaku/Jigrak',
    desc: 'Poni depan rata atau bertekstur micro fringe dengan sisi samping high skin fade.',
  },
  {
    id: '3',
    name: 'Two-Block Undercut',
    category: 'Medium & Layer',
    faces: ['Lonjong', 'Diamond', 'Oval'],
    guard: 'Guard #3 – #4',
    hairTexture: 'Lurus, Mengembang',
    desc: 'Bagian bawah dicukur pendek, bagian atas dibiarkan panjang jatuh berlayer natural.',
  },
  {
    id: '4',
    name: 'Mid Drop Fade Pompadour',
    category: 'Fade & Taper',
    faces: ['Bulat', 'Kotak'],
    guard: 'Guard #0.5 – #2',
    hairTexture: 'Lurus, Ikal Halus',
    desc: 'Garis fade melengkung di belakang telinga, memberi dimensi ekstra pada volume atas.',
  },
  {
    id: '5',
    name: 'Military Buzz Cut (Induction)',
    category: 'Buzz & Neat',
    faces: ['Oval', 'Kotak'],
    guard: 'Guard #2 (6mm)',
    hairTexture: 'Semua Tekstur',
    desc: 'Potongan seragam di seluruh kepala dengan garis hairline rapi tajam (*line-up*).',
  },
  {
    id: '6',
    name: 'Modern Mullet Fade',
    category: 'Medium & Layer',
    faces: ['Oval', 'Diamond', 'Hati'],
    guard: 'Guard #2 Taper',
    hairTexture: 'Ikal, Mengembang, Kribo',
    desc: 'Samping dicukur taper bersih, bagian belakang dibiarkan menjuntai bertekstur modern.',
  },
];

export default function CatalogScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('Semua');

  const filteredItems =
    activeCategory === 'Semua'
      ? CATALOG_ITEMS
      : CATALOG_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="border-b border-ink-border px-5 py-3">
          <Text className="text-xl font-extrabold text-white">Katalog Gaya Rambut</Text>
          <Text className="text-xs text-white/50 mt-0.5">
            25+ inspirasi potongan pria terstandarisasi untuk barber
          </Text>
        </View>

        {/* Category Pills */}
        <View className="py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
            <View className="flex-row gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    className={`rounded-full border px-3.5 py-1.5 ${
                      isSelected ? 'border-gold bg-gold' : 'border-ink-border bg-ink-card'
                    }`}>
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-[#0B0D13]' : 'text-white/70'
                      }`}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}>
          <View className="gap-3">
            {filteredItems.map((item) => (
              <View
                key={item.id}
                className="rounded-2xl border border-ink-border bg-ink-card p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-white">{item.name}</Text>
                    <Text className="text-[11px] text-gold font-semibold mt-0.5">
                      {item.category}
                    </Text>
                  </View>
                  <View className="rounded-lg bg-ink-soft px-2 py-1 flex-row items-center gap-1 border border-ink-border">
                    <Scissors size={11} color="#F59E0B" />
                    <Text className="text-[10px] font-bold text-gold">{item.guard}</Text>
                  </View>
                </View>

                <Text className="text-xs text-white/55 mt-2 leading-4">{item.desc}</Text>

                <View className="mt-3 flex-row flex-wrap items-center gap-1.5 border-t border-ink-border/80 pt-2.5">
                  <Text className="text-[10.5px] font-medium text-white/40">Cocok wajah:</Text>
                  {item.faces.map((f) => (
                    <View key={f} className="rounded-md bg-white/5 px-2 py-0.5">
                      <Text className="text-[10px] text-white/75">{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* CTA to scan face */}
            <View className="mt-2 rounded-2xl border border-gold/30 bg-gold-soft p-4 items-center text-center">
              <Sparkles size={20} color="#F59E0B" />
              <Text className="text-sm font-bold text-white mt-1 text-center">
                Bingung yang mana paling cocok?
              </Text>
              <Text className="text-xs text-white/60 text-center mt-1">
                Biarkan AI menganalisis geometri wajahmu dan memberikan rekomendasi otomatis.
              </Text>
              <Pressable
                onPress={() => router.push('/scan')}
                className="mt-3 rounded-xl bg-gold px-4 py-2.5 flex-row items-center gap-1.5">
                <Camera size={14} color="#0B0D13" />
                <Text className="text-xs font-bold text-[#0B0D13]">Scan Wajah Sekarang</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
