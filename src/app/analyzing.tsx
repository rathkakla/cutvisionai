import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { AlertTriangle, Check, RotateCcw, ScanFace, WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Wordmark } from '@/components/brand';
import { PrimaryButton } from '@/components/primary-button';
import { PrivacyBadge } from '@/components/privacy-badge';
import { useCutVision } from '@/context/cutvision-context';
import { getHairTypeLabel, getPreferenceLabel } from '@/data/hairstyles';
import { analyzeFace } from '@/services/faceAnalysisService';
import { GeminiError, getHairstyleRecommendations, type GeminiErrorCode } from '@/services/geminiService';
import { formatRatio, hasRealRatios } from '@/services/faceLandmark/classify';
import { FaceCaptureError, type FaceAnalysis } from '@/services/faceLandmark/types';

type Phase = 'detecting' | 'recommending' | 'done' | 'error';

interface PipelineError {
  code: GeminiErrorCode | 'capture' | 'unknown';
  message: string;
}

const STAGES = [
  'Mendeteksi landmark & mengukur rasio wajah...',
  'Meminta rekomendasi ke Gemini...',
  'Menyusun panduan untuk barber...',
];

const PROGRESS_BY_PHASE: Record<Exclude<Phase, 'error'>, number> = {
  detecting: 12,
  recommending: 62,
  done: 100,
};

const CONFIDENCE_LABEL = {
  high: 'Keyakinan tinggi',
  medium: 'Keyakinan sedang',
  low: 'Keyakinan rendah',
} as const;

// react-native-web tidak punya native animated module. Kalau dipaksa `true`,
// React Native mencetak warning dan animasi tetap jatuh ke JS, jadi matikan
// saja di web supaya log tetap bersih.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function stageForPhase(phase: Phase): number {
  if (phase === 'detecting') {
    return 0;
  }
  if (phase === 'recommending') {
    return 1;
  }
  return 2;
}

function errorHint(code: PipelineError['code']): string {
  switch (code) {
    case 'capture':
      return 'Ambil foto ulang dengan pencahayaan cukup, wajah sendirian, dan kepala tegak menghadap kamera.';
    case 'missing-key':
      return 'Tambahkan EXPO_PUBLIC_GEMINI_API_KEY=AQ... di file .env, lalu restart Expo.';
    case 'network':
      return 'Periksa koneksi internet lalu coba lagi.';
    case 'timeout':
      return 'Koneksi ke Gemini terlalu lama. Coba lagi saat jaringan lebih stabil.';
    case 'rate-limit':
      return 'Kuota harian Gemini untuk akun ini sedang penuh. Tunggu beberapa saat atau ganti model di EXPO_PUBLIC_GEMINI_MODEL.';
    case 'unavailable':
      return 'Model Gemini sedang sibuk. Tekan Coba Lagi — aplikasi otomatis mencoba model lain.';
    case 'http':
      return 'Periksa API key dan nama model Gemini, lalu coba lagi.';
    case 'invalid-response':
      return 'Format jawaban Gemini tidak sesuai. Tekan Coba Lagi untuk meminta ulang.';
    default:
      return 'Terjadi kendala tak terduga. Coba lagi atau kembali ke layar scan.';
  }
}

export default function AnalyzingScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { photo, hairType, preference, analysis, setAnalysis, setRecommendation } =
    useCutVision();

  const [phase, setPhase] = useState<Phase>('detecting');
  const [progress, setProgress] = useState(PROGRESS_BY_PHASE.detecting);
  const [pipelineError, setPipelineError] = useState<PipelineError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  const [sweep] = useState(() => new Animated.Value(0));
  const analysisRef = useRef<FaceAnalysis | null>(analysis);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  const previewHeight = Math.min(windowHeight * 0.3, 280);
  const previewWidth = Math.min(windowWidth - 48, previewHeight * (4 / 5), 320);

  useEffect(() => {
    if (!photo || !hairType || !preference) {
      router.replace(photo ? '/scan' : '/');
      return;
    }

    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setPipelineError(null);

      let current = analysisRef.current;

      if (!current) {
        setPhase('detecting');
        setProgress(PROGRESS_BY_PHASE.detecting);

        try {
          current = await analyzeFace(photo);
        } catch (error) {
          if (cancelled) {
            return;
          }

          setPhase('error');
          setPipelineError({
            code: error instanceof FaceCaptureError ? 'capture' : 'unknown',
            message:
              error instanceof Error
                ? error.message
                : 'Wajah tidak bisa dianalisis dari foto ini. Coba foto lain.',
          });
          return;
        }

        if (cancelled) {
          return;
        }

        analysisRef.current = current;
        setAnalysis(current);
      }

      setPhase('recommending');
      setProgress(PROGRESS_BY_PHASE.recommending);

      try {
        const result = await getHairstyleRecommendations({
          bentukWajah: current.faceShape,
          ratios: current.measurements.ratios,
          confidence: current.confidence,
          alternatifBentuk: current.alternatives,
          tipeRambut: getHairTypeLabel(hairType),
          preferensiGaya: getPreferenceLabel(preference),
        });

        if (cancelled) {
          return;
        }

        setRecommendation(result);
        setPhase('done');
        setProgress(PROGRESS_BY_PHASE.done);

        redirectTimer = setTimeout(() => {
          if (!cancelled) {
            router.replace('/result');
          }
        }, 450);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPhase('error');
        setPipelineError({
          code: error instanceof GeminiError ? error.code : 'unknown',
          message:
            error instanceof Error
              ? error.message
              : 'Rekomendasi Gemini gagal dibuat. Coba lagi.',
        });
      }
    };

    run();

    return () => {
      cancelled = true;
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
    // `analysisRef` sengaja dibaca lewat ref supaya retry API tidak memicu deteksi ulang.
  }, [attempt, photo, hairType, preference, router, setAnalysis, setRecommendation]);

  // Progres berjalan pelan selama menunggu supaya layar tidak terlihat macet,
  // lalu berhenti di batas atas masing-masing fase.
  useEffect(() => {
    if (phase === 'error' || phase === 'done') {
      return;
    }

    const cap = phase === 'detecting' ? 55 : 92;
    const interval = setInterval(() => {
      setProgress((current) => (current >= cap ? current : Math.min(cap, current + 1)));
    }, 380);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (frame.height <= 0 || phase === 'error' || phase === 'done') {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [frame.height, phase, sweep]);

  const handleFrameLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame({ width, height });
  };

  const handleRetry = () => {
    if (!pipelineError) {
      return;
    }
    const nextPhase = analysisRef.current ? 'recommending' : 'detecting';
    setPipelineError(null);
    setPhase(nextPhase);
    setProgress(PROGRESS_BY_PHASE[nextPhase]);
    setAttempt((current) => current + 1);
  };

  const handleBack = () => {
    router.replace('/scan');
  };

  if (!photo) {
    return <View className="flex-1 bg-ink" />;
  }

  const activeStage = stageForPhase(phase);
  const isProcessing = phase === 'detecting' || phase === 'recommending';
  const translateY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [8, Math.max(8, frame.height - 34)],
  });
  const sourceLabel =
    analysis?.source === 'mediapipe'
      ? 'Face-landmark · MediaPipe'
      : 'Estimasi rasio · fallback';

  // 478 titik terlalu padat untuk SVG di HP; tiap titik ketiga sudah cukup sebagai bukti.
  const landmarkDots =
    analysis?.source === 'mediapipe' ? (analysis.landmarks ?? []).filter((_, index) => index % 3 === 0) : [];
  const showRatios = analysis ? hasRealRatios(analysis.measurements) : false;

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 px-6">
        <View className="flex-row items-center justify-between pt-2">
          <Wordmark size="sm" />
          <View className="rounded-full border border-gold-line bg-gold-soft px-3 py-1.5">
            <Text className="text-[10px] font-semibold tracking-wide text-gold">
              {phase === 'error' ? 'ANALISIS GAGAL' : 'AI PROCESSING'}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}>
          <View className="items-center pt-4">
            <View className="items-center">
              <View className="flex-row items-center gap-2">
                <ScanFace size={16} color="#F59E0B" />
                <Text className="text-[11px] font-bold uppercase tracking-widest text-gold">
                  {phase === 'error' ? 'Belum selesai' : 'Menganalisis'}
                </Text>
              </View>
              <Text className="mt-2 text-center text-[22px] font-extrabold text-white">
                {phase === 'error'
                  ? 'Hampir jadi, satu langkah lagi'
                  : phase === 'done'
                    ? 'Rekomendasi siap!'
                    : 'Sebentar, wajahmu sedang dibaca'}
              </Text>
            </View>

            <View
              onLayout={handleFrameLayout}
              className="mt-5 overflow-hidden rounded-3xl border border-gold-line bg-ink-card"
              style={{
                width: previewWidth,
                height: previewHeight,
                shadowColor: '#F59E0B',
                shadowOpacity: 0.18,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 10 },
                elevation: 8,
              }}>
              <Image
                source={{ uri: photo.uri }}
                style={{ flex: 1 }}
                contentFit="contain"
                transition={180}
              />

              <View className="absolute bottom-0 left-0 right-0 top-0 bg-black/35" />

              {/*
                Overlay landmark: bukti visual bahwa wajah benar-benar diukur, bukan
                diestimasi. Ditampilkan hanya kalau sumbernya MediaPipe.
              */}
              {landmarkDots.length > 0 ? (
                <Svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  pointerEvents="none"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                  {landmarkDots.map((point, index) => (
                    <Circle
                      key={`lm-${index}`}
                      cx={point.x * 100}
                      cy={point.y * 100}
                      r={0.32}
                      fill="#F59E0B"
                      fillOpacity={0.75}
                    />
                  ))}
                </Svg>
              ) : null}

              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 100 125"
                preserveAspectRatio="none"
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {[25, 50, 75].map((x) => (
                  <Line
                    key={`v-${x}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={125}
                    stroke="#FFFFFF"
                    strokeOpacity={0.1}
                    strokeWidth={0.4}
                  />
                ))}
                {[25, 50, 75, 100].map((y) => (
                  <Line
                    key={`h-${y}`}
                    x1={0}
                    y1={y}
                    x2={100}
                    y2={y}
                    stroke="#FFFFFF"
                    strokeOpacity={0.1}
                    strokeWidth={0.4}
                  />
                ))}
                <Circle
                  cx={50}
                  cy={62}
                  r={22}
                  stroke="#F59E0B"
                  strokeOpacity={0.35}
                  strokeWidth={0.5}
                  fill="none"
                />
                <Circle cx={50} cy={62} r={0.7} fill="#F59E0B" />
              </Svg>

              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <Path
                  d="M4 14 L4 4 L14 4"
                  stroke="#F59E0B"
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d="M86 4 L96 4 L96 14"
                  stroke="#F59E0B"
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d="M4 86 L4 96 L14 96"
                  stroke="#F59E0B"
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d="M86 96 L96 96 L96 86"
                  stroke="#F59E0B"
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>

              {isProcessing ? (
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 10,
                    right: 10,
                    height: 26,
                    borderBottomWidth: 2,
                    borderBottomColor: '#F59E0B',
                    backgroundColor: 'rgba(217, 130, 43, 0.18)',
                    transform: [{ translateY }],
                    shadowColor: '#F59E0B',
                    shadowOpacity: 0.9,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 6,
                  }}
                />
              ) : null}

              <View className="absolute bottom-3 left-0 right-0 items-center">
                <View className="flex-row items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1">
                  <View className="h-1.5 w-1.5 rounded-full bg-gold" />
                  <Text className="text-[10px] font-medium text-white/75">
                    Foto tetap di perangkat
                  </Text>
                </View>
              </View>
            </View>

            {analysis ? (
              <View className="mt-4 w-full max-w-sm rounded-2xl border border-ink-border bg-ink-card p-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-[9.5px] font-bold uppercase tracking-widest text-white/40">
                      Bentuk wajah terdeteksi
                    </Text>
                    <Text className="mt-1 text-[20px] font-extrabold text-white">
                      {analysis.faceShape}
                    </Text>
                  </View>
                  <View className="items-end gap-1">
                    <View
                      className={`rounded-full px-2.5 py-1 ${
                        analysis.source === 'mediapipe'
                          ? 'bg-gold-soft'
                          : 'bg-white/[0.06]'
                      }`}>
                      <Text
                        className={`text-[9.5px] font-semibold ${
                          analysis.source === 'mediapipe' ? 'text-gold' : 'text-white/50'
                        }`}>
                        {sourceLabel}
                      </Text>
                    </View>
                    <Text className="text-[9.5px] text-white/35">
                      {CONFIDENCE_LABEL[analysis.confidence]}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row gap-2">
                  {[
                    { label: 'Panjang', value: analysis.measurements.ratios.lengthToWidth },
                    { label: 'Dahi', value: analysis.measurements.ratios.foreheadToCheek },
                    { label: 'Rahang', value: analysis.measurements.ratios.jawToCheek },
                  ].map((item) => (
                    <View
                      key={item.label}
                      className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] px-2 py-2">
                      <Text className="text-[9px] uppercase tracking-wide text-white/35">
                        {item.label}
                      </Text>
                      <Text className="mt-0.5 text-[14px] font-bold text-gold-light">
                        {showRatios ? `${formatRatio(item.value)}×` : '—'}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text className="mt-2.5 text-[10px] leading-4 text-white/35">
                  {showRatios
                    ? 'Rasio terhadap lebar tulang pipi. '
                    : 'Angka rasio disembunyikan karena foto tidak diukur dengan landmark. '}
                  {analysis.note}
                </Text>
              </View>
            ) : null}

            {pipelineError ? (
              <View className="mt-4 w-full max-w-sm rounded-2xl border border-danger/40 bg-danger-soft p-4">
                <View className="flex-row items-center gap-2">
                  {pipelineError.code === 'network' ? (
                    <WifiOff size={16} color="#E5484D" />
                  ) : (
                    <AlertTriangle size={16} color="#E5484D" />
                  )}
                  <Text className="flex-1 text-[13px] font-bold text-white">
                    {pipelineError.code === 'capture' ? 'Foto belum bisa dipakai' : 'Rekomendasi belum berhasil'}
                  </Text>
                </View>

                <Text className="mt-2 text-[12px] leading-5 text-white/70">
                  {pipelineError.message}
                </Text>
                <Text className="mt-2 text-[10.5px] leading-4 text-white/40">
                  {errorHint(pipelineError.code)}
                </Text>

                <View className="mt-4 gap-2.5">
                  {pipelineError.code === 'capture' ? null : (
                    <PrimaryButton
                      label="Coba Lagi"
                      icon={<RotateCcw size={16} color="#121212" />}
                      onPress={handleRetry}
                    />
                  )}
                  <PrimaryButton
                    label={pipelineError.code === 'capture' ? 'Ambil Foto Ulang' : 'Kembali ke Scan'}
                    variant="outline"
                    onPress={handleBack}
                  />
                </View>
              </View>
            ) : (
              <View className="mt-5 w-full max-w-sm gap-3">
                {STAGES.map((label, index) => {
                  const isDone = index < activeStage || phase === 'done';
                  const isActive = index === activeStage && phase !== 'done';

                  return (
                    <View key={label} className="flex-row items-center gap-3">
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full border ${
                          isDone
                            ? 'border-gold bg-gold'
                            : isActive
                              ? 'border-gold bg-gold-soft'
                              : 'border-ink-border bg-ink-card'
                        }`}>
                        {isDone ? (
                          <Check size={13} color="#121212" strokeWidth={3.5} />
                        ) : isActive ? (
                          <ActivityIndicator size="small" color="#F59E0B" />
                        ) : (
                          <View className="h-1.5 w-1.5 rounded-full bg-white/25" />
                        )}
                      </View>
                      <Text
                        className={`flex-1 text-[12px] ${
                          isDone || isActive ? 'text-white/85' : 'text-white/35'
                        }`}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        <View className="pb-3">
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-ink-soft">
            <View
              className={`h-full rounded-full ${pipelineError ? 'bg-danger' : 'bg-gold'}`}
              style={{ width: `${progress}%` }}
            />
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-[10px] text-white/35">
              {phase === 'recommending'
                ? 'Menghubungi Gemini · hanya teks yang dikirim'
                : phase === 'detecting'
                  ? 'Memproses di perangkat'
                  : phase === 'error'
                    ? 'Analisis terhenti'
                    : 'Selesai'}
            </Text>
            <Text
              className={`text-[10px] font-semibold ${
                pipelineError ? 'text-danger' : 'text-gold'
              }`}>
              {pipelineError ? 'GAGAL' : `${progress}%`}
            </Text>
          </View>

          <View className="mt-3">
            <PrivacyBadge />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
