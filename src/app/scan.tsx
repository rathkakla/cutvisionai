import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertCircle,
  Camera,
  CameraOff,
  ImagePlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { FaceGuideOverlay } from '@/components/face-guide-overlay';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeading } from '@/components/section-heading';
import { useCutVision } from '@/context/cutvision-context';
import {
  HAIR_TYPE_OPTIONS,
  PREFERENCE_OPTIONS,
  type HairTypeId,
  type PreferenceId,
} from '@/data/hairstyles';
import { compressFacePhoto } from '@/lib/image';
import { pickPhotoFromLibrary } from '@/lib/photo-picker';

interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
}

export default function ScanScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const permissionRequested = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [isFocused, setIsFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [pickedPhoto, setPickedPhoto] = useState<LocalPhoto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { hairType, preference, setPhoto, setHairType, setPreference } = useCutVision();

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setCameraReady(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) {
      return;
    }
    if (permissionRequested.current) {
      return;
    }

    permissionRequested.current = true;
    requestPermission().catch(() => {
      setMessage('Izin kamera tidak bisa diminta sekarang. Kamu masih bisa pilih dari galeri.');
    });
  }, [permission, requestPermission]);

  const handleFrameLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrameSize({ width, height });
  };

  const pickFromGallery = async () => {
    try {
      setMessage(null);

      const outcome = await pickPhotoFromLibrary();

      if (outcome.status === 'picked') {
        setPickedPhoto(outcome.photo);
        // Kamera otomatis nonaktif selama foto galeri dipakai; tanda ini memaksa
        // "Kamera siap" dihitung ulang saat pengguna kembali ke mode kamera.
        setCameraReady(false);
        return;
      }

      if (outcome.status === 'denied') {
        setMessage('Akses galeri ditolak. Aktifkan izin galeri di pengaturan HP, ya.');
      }
    } catch {
      setMessage('Gagal membuka galeri. Coba lagi sebentar.');
    }
  };

  const takePhoto = async (): Promise<LocalPhoto> => {
    if (!cameraRef.current || !cameraReady) {
      throw new Error('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
    }

    const captured: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({
      quality: 0.8,
    });

    if (!captured?.uri) {
      throw new Error('Foto gagal diambil. Coba posisikan wajah lalu ulangi.');
    }

    return { uri: captured.uri, width: captured.width, height: captured.height };
  };

  const handleAnalyze = async () => {
    if (!hairType) {
      setMessage('Pilih tipe rambut asli kamu dulu.');
      return;
    }
    if (!preference) {
      setMessage('Pilih preferensi gaya yang paling kamu suka.');
      return;
    }

    setMessage(null);
    setIsProcessing(true);

    try {
      const source = pickedPhoto ?? (await takePhoto());
      const compressed = await compressFacePhoto(source.uri);

      setPhoto({
        uri: compressed.uri,
        width: compressed.width || source.width,
        height: compressed.height || source.height,
      });

      router.push('/analyzing');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Terjadi kendala saat memproses foto.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedHair = HAIR_TYPE_OPTIONS.find((option) => option.id === hairType);
  const isCameraLive = Boolean(permission?.granted && isFocused && !pickedPhoto && !cameraError);
  const buttonCaption = !pickedPhoto
    ? 'Foto akan dikompres ke lebar maks 800px sebelum dianalisis.'
    : 'Menggunakan foto dari galeri. Kamu bisa ganti kapan saja.';

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="px-6 pt-2">
          <ScreenHeader title="Scan Wajah" step="Langkah 1 · 2" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="w-full max-w-lg self-center px-6">
            <Text className="mt-4 text-[13px] leading-5 text-white/45">
              Hadapkan wajah ke kamera depan dengan pencahayaan cukup. Tidak perlu senyum,
              cukup ekspresi santai.
            </Text>

            <View className="mt-4 overflow-hidden rounded-3xl border border-ink-border bg-ink-card">
              <View style={{ aspectRatio: 3 / 4 }}>
                {pickedPhoto ? (
                  <Image
                    source={{ uri: pickedPhoto.uri }}
                    style={{ flex: 1 }}
                    contentFit="cover"
                    transition={200}
                  />
                ) : isCameraLive ? (
                  <CameraView
                    ref={cameraRef}
                    facing="front"
                    style={{ flex: 1 }}
                    onCameraReady={() => {
                      setCameraReady(true);
                      setCameraError(null);
                    }}
                    onMountError={(event) => {
                      setCameraReady(false);
                      setCameraError(event.message);
                    }}
                  />
                ) : (
                  <View className="flex-1 items-center justify-center px-8">
                    {!permission ? (
                      <>
                        <ActivityIndicator color="#D9822B" />
                        <Text className="mt-3 text-center text-xs text-white/50">
                          Menyiapkan kamera...
                        </Text>
                      </>
                    ) : permission.granted ? (
                      <>
                        <CameraOff size={30} color="#D9822B" />
                        <Text className="mt-3 text-center text-sm font-semibold text-white">
                          Kamera sedang tidak aktif
                        </Text>
                        <Text className="mt-1 text-center text-xs leading-5 text-white/45">
                          Coba aktifkan ulang, atau pilih foto langsung dari galeri.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setCameraError(null);
                            setCameraReady(false);
                          }}
                          className="mt-4 rounded-full border border-gold-line bg-gold-soft px-5 py-2.5">
                          <Text className="text-xs font-bold text-gold">
                            Coba Aktifkan Kamera
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-gold-soft">
                          <Camera size={26} color="#D9822B" />
                        </View>
                        <Text className="mt-4 text-center text-sm font-bold text-white">
                          {permission.canAskAgain ? 'Izinkan akses kamera' : 'Izin kamera diblokir'}
                        </Text>
                        <Text className="mt-1 text-center text-xs leading-5 text-white/45">
                          {permission.canAskAgain
                            ? 'Kamera depan hanya dipakai untuk memindai wajah saat ini juga.'
                            : 'Aktifkan izin kamera lewat pengaturan HP, atau pilih foto dari galeri.'}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            if (permission.canAskAgain) {
                              requestPermission();
                            } else {
                              Linking.openSettings().catch(() => {});
                            }
                          }}
                          className="mt-4 rounded-full bg-gold px-5 py-2.5">
                          <Text className="text-xs font-bold text-ink">
                            {permission.canAskAgain ? 'Izinkan Kamera' : 'Buka Pengaturan'}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}

                {isCameraLive ? (
                  <View
                    className="absolute bottom-0 left-0 right-0 top-0"
                    pointerEvents="none"
                    onLayout={handleFrameLayout}>
                    <FaceGuideOverlay width={frameSize.width} height={frameSize.height} />
                    <View className="absolute bottom-4 left-0 right-0 items-center">
                      <View className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5">
                        <Text className="text-[11px] font-medium text-white/80">
                          Posisikan wajah di dalam bingkai
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {pickedPhoto ? (
                  <>
                    <View className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/50 px-3 py-1">
                      <Text className="text-[10px] font-semibold tracking-wide text-white/80">
                        FOTO GALERI
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setPickedPhoto(null);
                        setCameraReady(false);
                      }}
                      className="absolute right-3 top-3 flex-row items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5">
                      <RefreshCw size={12} color="#FFFFFF" />
                      <Text className="text-[10px] font-semibold text-white">Pakai kamera</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            <View className="mt-3 flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-2">
                <View
                  className={`h-1.5 w-1.5 rounded-full ${
                    cameraError ? 'bg-danger' : 'bg-emerald-400'
                  }`}
                />
                <Text className="text-[11px] text-white/45">
                  {cameraError
                    ? 'Kamera bermasalah, gunakan galeri.'
                    : pickedPhoto
                      ? 'Foto galeri siap dianalisis.'
                      : 'Kamera depan · mode potret'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={pickFromGallery}
                className="flex-row items-center gap-1.5 rounded-full border border-ink-border bg-ink-card px-3 py-2">
                <ImagePlus size={13} color="#D9822B" />
                <Text className="text-[11px] font-semibold text-white/80">
                  Pilih dari Galeri
                </Text>
              </Pressable>
            </View>

            <View className="mt-7 gap-3">
              <SectionHeading
                title="Tipe Rambut Asli"
                required
                hint="Pilih yang paling mirip dengan rambutmu saat ini."
              />
              <View className="flex-row flex-wrap gap-2">
                {HAIR_TYPE_OPTIONS.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    selected={hairType === option.id}
                    onPress={() => setHairType(option.id as HairTypeId)}
                  />
                ))}
              </View>
              <Text className="text-[11px] leading-4 text-white/40">
                {selectedHair
                  ? selectedHair.hint
                  : 'Belum dipilih — ini wajib supaya rekomendasinya tidak asal.'}
              </Text>
            </View>

            <View className="mt-7 gap-3">
              <SectionHeading
                title="Preferensi Gaya"
                required
                hint="Mau terlihat seperti apa setelah keluar dari barbershop?"
              />
              <View className="gap-2.5">
                {[PREFERENCE_OPTIONS.slice(0, 2), PREFERENCE_OPTIONS.slice(2)].map((row) => (
                  <View key={row[0].id} className="flex-row gap-2.5">
                    {row.map((option) => {
                      const selected = preference === option.id;
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setPreference(option.id as PreferenceId)}
                          className={`flex-1 rounded-2xl border p-3 ${
                            selected
                              ? 'border-gold bg-gold-soft'
                              : 'border-ink-border bg-ink-card'
                          }`}>
                          <View className="flex-row items-center justify-between gap-2">
                            <Text
                              className={`flex-1 text-[12.5px] font-bold ${
                                selected ? 'text-gold-light' : 'text-white/85'
                              }`}>
                              {option.label}
                            </Text>
                            <View
                              className={`h-3.5 w-3.5 rounded-full border ${
                                selected
                                  ? 'border-gold bg-gold'
                                  : 'border-white/20 bg-transparent'
                              }`}
                            />
                          </View>
                          <Text className="mt-1 text-[10.5px] leading-4 text-white/40">
                            {option.hint}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {message ? (
              <View className="mt-5 flex-row items-start gap-2 rounded-2xl border border-danger/40 bg-danger-soft px-3.5 py-3">
                <AlertCircle size={15} color="#E5484D" />
                <Text className="flex-1 text-[11.5px] leading-4 text-danger">{message}</Text>
              </View>
            ) : null}

            <View className="mt-6">
              <PrimaryButton
                label="Analisis Gaya Rambut"
                icon={<Sparkles size={17} color="#121212" />}
                loading={isProcessing}
                onPress={handleAnalyze}
                caption={buttonCaption}
              />
            </View>

            <View className="mt-4 flex-row items-center justify-center gap-1.5">
              <ShieldCheck size={12} color="#4A4A4A" />
              <Text className="text-[10.5px] text-white/30">
                Foto hanya ada di memori perangkat selama sesi ini.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

