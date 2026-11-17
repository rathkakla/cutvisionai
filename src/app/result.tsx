import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  ScanFace,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand';
import { PrimaryButton } from '@/components/primary-button';
import { SectionHeading } from '@/components/section-heading';
import { TryOnPreview } from '@/components/try-on-preview';
import { useCutVision } from '@/context/cutvision-context';
import { getHairTypeLabel } from '@/data/hairstyles';
import { readPhotoAsBase64 } from '@/lib/image';
import { releasePickedPhotos } from '@/lib/photo-picker';
import { TryOnError, generateVirtualTryOn, pickTryOnAspectRatio } from '@/services/tryOnService';

export default function ResultScreen() {
  const router = useRouter();
  const { photo, hairType, preference, analysis, recommendation, clearSession } = useCutVision();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [promptOpen, setPromptOpen] = useState(false);

  // Cache sesi: index gaya → gambar hasil Fal.ai. Disimpan di state + ref supaya
  // pindah tab tidak memicu render ulang, dan reset bisa mengosongkannya seketika.
  const [tryOnImages, setTryOnImages] = useState<Record<number, string>>({});
  const [tryOnLoading, setTryOnLoading] = useState<Record<number, boolean>>({});
  const [tryOnErrors, setTryOnErrors] = useState<Record<number, string>>({});

  const base64CacheRef = useRef<{ uri: string; promise: Promise<string> } | null>(null);
  const tryOnCacheRef = useRef<Record<number, string>>({});
  const tryOnInFlightRef = useRef<Set<number>>(new Set());
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const sessionTokenRef = useRef(0);

  const requestTryOn = useCallback(
    async (index: number, force = false) => {
      if (!photo || !recommendation) {
        return;
      }

      const style = recommendation.rekomendasi[index];
      if (!style) {
        return;
      }
      if (!force && tryOnCacheRef.current[index]) {
        return;
      }
      if (tryOnInFlightRef.current.has(index)) {
        return;
      }

      const token = sessionTokenRef.current;
      const controller = new AbortController();

      tryOnInFlightRef.current.add(index);
      abortControllersRef.current.set(index, controller);
      setTryOnLoading((current) => ({ ...current, [index]: true }));
      setTryOnErrors((current) => {
        if (!(index in current)) {
          return current;
        }
        const next = { ...current };
        delete next[index];
        return next;
      });

      try {
        if (base64CacheRef.current?.uri !== photo.uri) {
          const promise = readPhotoAsBase64(photo.uri).catch((error: unknown) => {
            base64CacheRef.current = null;
            throw error;
          });
          base64CacheRef.current = { uri: photo.uri, promise };
        }

        const base64 = await base64CacheRef.current.promise;
        const image = await generateVirtualTryOn(base64, style.namaGaya, style.promptVisual, {
          signal: controller.signal,
          aspectRatio: pickTryOnAspectRatio(photo.width, photo.height),
        });

        if (token !== sessionTokenRef.current) {
          return;
        }

        tryOnCacheRef.current[index] = image;
        setTryOnImages((current) => ({ ...current, [index]: image }));
      } catch (error) {
        if (token !== sessionTokenRef.current) {
          return;
        }
        const message =
          error instanceof TryOnError
            ? error.message
            : 'Foto gagal disiapkan untuk simulasi. Coba lagi.';
        setTryOnErrors((current) => ({ ...current, [index]: message }));
      } finally {
        tryOnInFlightRef.current.delete(index);
        if (abortControllersRef.current.get(index) === controller) {
          abortControllersRef.current.delete(index);
        }
        if (token === sessionTokenRef.current) {
          setTryOnLoading((current) => {
            if (!(index in current)) {
              return current;
            }
            const next = { ...current };
            delete next[index];
            return next;
          });
        }
      }
    },
    [photo, recommendation],
  );

  // Gaya pertama langsung dirender saat layar dibuka; tab lain menyusul saat dipilih.
  useEffect(() => {
    if (!photo || !recommendation) {
      return;
    }
    if (selectedIndex >= recommendation.rekomendasi.length) {
      return;
    }
    void requestTryOn(selectedIndex);
  }, [photo, recommendation, selectedIndex, requestTryOn]);

  // Batalkan request yang masih jalan kalau pengguna meninggalkan layar.
  useEffect(
    () => () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!photo) {
      router.replace('/');
      return;
    }
    if (!hairType || !preference) {
      router.replace('/scan');
      return;
    }
    if (!recommendation) {
      router.replace('/analyzing');
    }
  }, [photo, hairType, preference, recommendation, router]);

  if (!photo || !hairType || !preference || !recommendation) {
    return <View className="flex-1 bg-ink" />;
  }

  const styles = recommendation.rekomendasi;
  const activeIndex = Math.min(selectedIndex, styles.length - 1);
  const selected = styles[activeIndex] ?? styles[0];
  const hairLabel = getHairTypeLabel(hairType);
  const faceShape = recommendation.bentukWajah || analysis?.faceShape || 'Oval';
  const sourceLabel =
    analysis?.source === 'mediapipe'
      ? 'Diukur dari 468 landmark MediaPipe'
      : 'Estimasi rasio perangkat (fallback)';

  const handleReset = () => {
    // Hentikan render yang masih jalan, lalu hapus foto asli dan seluruh cache
    // simulasi dari memori sebelum kembali ke layar awal.
    sessionTokenRef.current += 1;
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    tryOnInFlightRef.current.clear();
    tryOnCacheRef.current = {};
    base64CacheRef.current = null;
    setTryOnImages({});
    setTryOnErrors({});
    setTryOnLoading({});
    // Di web, foto galeri berupa object URL; lepaskan blob-nya supaya memori browser
    // benar-benar bersih setelah sesi dihapus.
    releasePickedPhotos();
    clearSession();
    router.replace('/');
  };

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}>
          <View className="w-full max-w-lg self-center px-6">
            <View className="flex-row items-center justify-between pt-2">
              <Wordmark size="sm" />
              <View className="rounded-full border border-gold-line bg-gold-soft px-3 py-1.5">
                <Text className="text-[10px] font-semibold tracking-wide text-gold">
                  HASIL ANALISIS
                </Text>
              </View>
            </View>

            <View className="mt-5 items-center">
              <View className="flex-row items-center gap-2 rounded-full border border-gold-line bg-gold-soft px-4 py-2">
                <ScanFace size={14} color="#D9822B" />
                <Text className="text-[11.5px] font-semibold text-gold">
                  Bentuk Wajah: {faceShape} • Rambut: {hairLabel}
                </Text>
              </View>
              <Text className="mt-4 text-center text-[24px] font-extrabold leading-8 text-white">
                Ini yang paling pas{'\n'}buat kamu
              </Text>
              <Text className="mt-2 max-w-[300px] text-center text-[12.5px] leading-5 text-white/45">
                {styles.length} opsi dari DeepSeek, disesuaikan dengan bentuk wajah, tekstur
                rambut asli, dan preferensimu.
              </Text>
              <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1">
                <View
                  className={`h-1.5 w-1.5 rounded-full ${
                    analysis?.source === 'mediapipe' ? 'bg-emerald-400' : 'bg-white/35'
                  }`}
                />
                <Text className="text-[10px] text-white/40">{sourceLabel}</Text>
              </View>
            </View>

            <View className="mt-6">
              <SectionHeading
                title="Preview Virtual Try-On"
                hint="Render AI dari fotomu. Hanya rambut yang berubah; wajah, ekspresi, dan latar tetap sama."
              />
              <View className="mt-3">
                <TryOnPreview
                  photoUri={photo.uri}
                  variantIndex={activeIndex}
                  styleName={selected.namaGaya}
                  resultUri={tryOnImages[activeIndex] ?? null}
                  isGenerating={Boolean(tryOnLoading[activeIndex])}
                  errorMessage={tryOnErrors[activeIndex] ?? null}
                  onRetry={() => {
                    void requestTryOn(activeIndex, true);
                  }}
                />
              </View>
            </View>

            <View className="mt-6">
              <SectionHeading title="Pilih Gaya" hint="Ketuk kartu untuk melihat panduan tiap gaya." />
              <View className="mt-3 flex-row gap-2">
                {styles.map((style, index) => {
                  const isSelected = index === activeIndex;

                  return (
                    <Pressable
                      key={`${style.namaGaya}-${index}`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        setSelectedIndex(index);
                        setPromptOpen(false);
                      }}
                      className={`flex-1 rounded-2xl border px-2.5 py-3 ${
                        isSelected ? 'border-gold bg-gold' : 'border-ink-border bg-ink-card'
                      }`}>
                      <Text
                        className={`text-[9px] font-extrabold uppercase tracking-widest ${
                          isSelected ? 'text-ink/55' : 'text-gold'
                        }`}>
                        Gaya {index + 1}
                      </Text>
                      <Text
                        numberOfLines={2}
                        className={`mt-1 text-[12px] font-bold leading-4 ${
                          isSelected ? 'text-ink' : 'text-white/85'
                        }`}>
                        {style.namaGaya}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-5 rounded-3xl border border-ink-border bg-ink-card p-5">
              <View className="flex-row items-center gap-2">
                <Sparkles size={15} color="#D9822B" />
                <Text className="text-[13.5px] font-bold text-white">Kenapa Cocok Untukmu</Text>
              </View>
              <Text className="mt-3 text-[12.5px] leading-6 text-white/70">
                {selected.alasanCocok}
              </Text>

              <View className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
                <View className="flex-row items-center gap-1.5">
                  <Info size={11} color="#D9822B" />
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-gold">
                    Catatan tekstur rambut
                  </Text>
                </View>
                <Text className="mt-1.5 text-[12px] leading-5 text-white/60">
                  Rekomendasi ini sudah mempertimbangkan rambut {hairLabel.toLowerCase()} kamu.
                  Kalau hasil di barber melenceng dari tekstur asli, tunjukkan bagian panduan
                  teknis di bawah.
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-3xl border-2 border-gold/60 bg-[#1C1712] p-5">
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-gold-soft">
                  <Scissors size={19} color="#D9822B" />
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-extrabold text-white">
                    Panduan Cukur untuk Barber
                  </Text>
                  <Text className="mt-0.5 text-[10.5px] leading-4 text-white/45">
                    Tunjukkan layar ini ke barber — bahasanya sudah teknis.
                  </Text>
                </View>
              </View>

              <Text className="mt-4 text-[12.5px] leading-6 text-white/80">
                {selected.panduanBarber}
              </Text>

              <View className="mt-4 flex-row items-start gap-2 border-t border-white/5 pt-3">
                <RotateCcw size={12} color="#6F6F6F" />
                <Text className="flex-1 text-[10.5px] leading-4 text-white/35">
                  Tetap tunjukkan referensi fotonya, ya. Hasil tiap barber bisa sedikit berbeda
                  tergantung alat dan teknik.
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-3xl border border-ink-border bg-ink-card">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: promptOpen }}
                onPress={() => setPromptOpen((open) => !open)}
                className="flex-row items-center gap-3 p-4">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-gold-soft">
                  <Wand2 size={16} color="#D9822B" />
                </View>
                <View className="flex-1">
                  <Text className="text-[12.5px] font-bold text-white">Prompt Visual (English)</Text>
                  <Text className="mt-0.5 text-[10px] leading-4 text-white/40">
                    Dipakai untuk simulasi AI di atas, bisa juga kamu salin ke generator lain.
                  </Text>
                </View>
                {promptOpen ? (
                  <ChevronUp size={16} color="#FFFFFF80" />
                ) : (
                  <ChevronDown size={16} color="#FFFFFF80" />
                )}
              </Pressable>

              {promptOpen ? (
                <View className="px-4 pb-4">
                  <View className="rounded-2xl border border-white/5 bg-black/30 p-3.5">
                    <Text className="text-[11px] leading-5 text-white/60">
                      {selected.promptVisual}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View className="mt-6">
              <PrimaryButton
                variant="danger"
                label="Hapus Foto & Ulangi"
                icon={<Trash2 size={16} color="#E5484D" />}
                onPress={handleReset}
                caption="Foto asli dan semua simulasi AI langsung dihapus dari memori aplikasi."
              />
            </View>

            <Text className="mt-4 text-center text-[10px] leading-4 text-white/25">
              Rekomendasi ini bersifat saran, bukan diagnosis. Hasil akhir tetap tergantung
              preferensi dan penilaian barber.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
