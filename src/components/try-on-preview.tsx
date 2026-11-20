import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Siluet ilustratif; dipilih lewat index karena nama gaya berasal dari AI, bukan katalog lokal. */
const HAIR_PATHS: string[] = [
  'M42 112 C42 34 68 12 100 12 C132 12 158 34 158 112 L148 98 L140 112 L130 98 L120 114 L110 98 L100 114 L90 98 L80 112 L70 98 L60 112 L52 98 Z',
  'M42 112 L42 46 C42 26 68 12 100 12 C132 12 158 26 158 46 L158 112 L142 112 L142 70 C126 60 74 60 58 70 L58 112 Z',
  'M42 112 C42 36 66 12 104 12 C142 12 160 34 160 64 C160 80 156 92 150 104 L136 98 C142 82 140 66 130 54 C112 46 82 50 64 58 L62 112 Z',
];

interface TryOnPreviewProps {
  photoUri: string;
  variantIndex: number;
  styleName: string;
  /** Hasil render AI untuk gaya ini; null berarti masih memakai foto asli. */
  resultUri?: string | null;
  isGenerating?: boolean;
  /** Mode mock mengembalikan gambar contoh, jadi harus diberi label jujur. */
  isMock?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

/**
 * Preview Virtual Try-On: menampilkan foto asli selagi simulasi AI dibuat, lalu
 * berganti ke hasil render Fal.ai untuk gaya yang sedang dipilih.
 */
export function TryOnPreview({
  photoUri,
  variantIndex,
  styleName,
  resultUri,
  isGenerating = false,
  isMock = false,
  errorMessage,
  onRetry,
}: TryOnPreviewProps) {
  const hairPath = HAIR_PATHS[((variantIndex % HAIR_PATHS.length) + HAIR_PATHS.length) % HAIR_PATHS.length];
  const hasResult = Boolean(resultUri);

  return (
    <View className="overflow-hidden rounded-3xl border border-ink-border bg-ink-card">
      <View style={{ aspectRatio: 4 / 5 }}>
        <Image
          source={{ uri: resultUri ?? photoUri }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          contentFit="cover"
          transition={220}
        />

        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 200 250"
          preserveAspectRatio="none"
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.45" stopColor="#121212" stopOpacity={0} />
              <Stop offset="1" stopColor="#121212" stopOpacity={0.9} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="200" height="250" fill="url(#fade)" />
        </Svg>

        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1">
          <View className={`h-1.5 w-1.5 rounded-full ${hasResult ? 'bg-gold' : 'bg-white/45'}`} />
          <Text className="text-[9.5px] font-semibold tracking-wide text-white/75">
            {hasResult
              ? isMock
                ? 'CONTOH RENDER · BUKAN HASIL AI'
                : 'SIMULASI AI'
              : 'PREVIEW VIRTUAL TRY-ON'}
          </Text>
        </View>

        {isGenerating ? (
          <View className="absolute right-3 top-3 flex-row items-center gap-1.5 rounded-full border border-gold/40 bg-black/60 px-2.5 py-1">
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text className="text-[9.5px] font-semibold text-white/80">Membuat simulasi…</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View className="absolute inset-0 items-center justify-center bg-black/60 px-5">
            <View className="w-full rounded-2xl border border-white/15 bg-[#1A1414] p-4">
              <Text className="text-[12.5px] font-bold text-white">Simulasi belum berhasil</Text>
              <Text className="mt-1.5 text-[11px] leading-5 text-white/60">{errorMessage}</Text>
              {onRetry ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetry}
                  className="mt-3 flex-row items-center justify-center rounded-xl bg-gold px-3 py-2">
                  <Text className="text-[11.5px] font-extrabold text-ink">Coba Lagi</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="absolute bottom-0 left-0 right-0 p-3.5">
          <View className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-black/55 p-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-gold/50 bg-gold-soft">
              <Svg width={32} height={22} viewBox="0 0 200 125">
                <Path
                  d={hairPath}
                  fill="#3A2A20"
                  stroke="#F59E0B"
                  strokeOpacity={0.85}
                  strokeWidth={4}
                />
              </Svg>
            </View>

            <View className="flex-1">
              <Text className="text-[9px] font-bold uppercase tracking-widest text-gold">
                Gaya terpilih
              </Text>
              <Text className="mt-0.5 text-lg font-extrabold text-white">{styleName}</Text>
            </View>

            <View
              className={`rounded-full px-2.5 py-1 ${
                hasResult ? 'bg-emerald-400/20' : 'bg-gold'
              }`}>
              <Text
                className={`text-[9.5px] font-extrabold ${
                  hasResult ? 'text-emerald-300' : 'text-ink'
                }`}>
                {hasResult ? (isMock ? 'CONTOH' : 'HASIL AI') : 'AI PICK'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
