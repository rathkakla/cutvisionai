import { Maximize2, Scissors, TrendingUp, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface FaceRatios {
  lengthToWidth: number;
  foreheadToCheek: number;
  jawToCheek: number;
}

interface BarberBriefProps {
  styleName: string;
  faceShape: string;
  hairTypeLabel: string;
  guide: string;
  ratios?: FaceRatios | null;
  /** Dipakai di mode barber: teks lebih besar + tombol layar penuh. */
  emphasis?: boolean;
  onExpand?: () => void;
}

function RatioRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center rounded-xl bg-white/[0.04] px-2 py-2">
      <Text className="text-[9.5px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </Text>
      <Text className="mt-0.5 text-base font-extrabold text-white">{value.toFixed(2)}×</Text>
    </View>
  );
}

function MetaChips({ faceShape, hairTypeLabel }: { faceShape: string; hairTypeLabel: string }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <View className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1">
        <Text className="text-[10.5px] font-semibold text-white/75">Bentuk: {faceShape}</Text>
      </View>
      <View className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1">
        <Text className="text-[10.5px] font-semibold text-white/75">Rambut: {hairTypeLabel}</Text>
      </View>
    </View>
  );
}

/**
 * Kartu panduan cukur yang bisa dibaca barber dari layar HP.
 *
 * Di mode barber kartu ini dinaikkan ke atas halaman dan teksnya diperbesar,
 * karena yang membaca adalah barber di kursi cukur, bukan pelanggan.
 */
export function BarberBriefCard({
  styleName,
  faceShape,
  hairTypeLabel,
  guide,
  ratios,
  emphasis = false,
  onExpand,
}: BarberBriefProps) {
  return (
    <View
      className={`rounded-3xl border-2 border-gold/60 bg-[#1C1712] ${emphasis ? 'p-6' : 'p-5'}`}>
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-gold-soft">
          <Scissors size={19} color="#F59E0B" />
        </View>
        <View className="flex-1">
          <Text
            className={`font-extrabold text-white ${emphasis ? 'text-[17px]' : 'text-[14px]'}`}>
            Panduan Cukur untuk Barber
          </Text>
          <Text className="mt-0.5 text-[10.5px] leading-4 text-white/45">
            {emphasis
              ? 'Bacakan atau tunjukkan layar ini langsung ke barber.'
              : 'Tunjukkan layar ini ke barber — bahasanya sudah teknis.'}
          </Text>
        </View>
      </View>

      {emphasis ? (
        <View className="mt-4 gap-2">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-gold/80">
            Target potongan
          </Text>
          <Text className="text-2xl font-black leading-8 text-white">{styleName}</Text>
          <MetaChips faceShape={faceShape} hairTypeLabel={hairTypeLabel} />
        </View>
      ) : null}

      <Text
        className={
          emphasis
            ? 'mt-4 text-[15.5px] leading-7 text-white/90'
            : 'mt-4 text-[12.5px] leading-6 text-white/80'
        }>
        {guide}
      </Text>

      {ratios ? (
        <View className="mt-4">
          <View className="mb-1.5 flex-row items-center gap-1.5">
            <TrendingUp size={11} color="#F59E0B" />
            <Text className="text-[9.5px] font-bold uppercase tracking-widest text-white/40">
              Rasio wajah terukur
            </Text>
          </View>
          <View className="flex-row gap-2">
            <RatioRow label="Panjang/Lebar" value={ratios.lengthToWidth} />
            <RatioRow label="Dahi/Pipi" value={ratios.foreheadToCheek} />
            <RatioRow label="Rahang/Pipi" value={ratios.jawToCheek} />
          </View>
        </View>
      ) : null}

      {emphasis && onExpand ? (
        <Pressable
          accessibilityRole="button"
          onPress={onExpand}
          className="mt-5 flex-row items-center justify-center gap-2 rounded-full bg-gold px-4 py-3">
          <Maximize2 size={14} color="#0B0D13" />
          <Text className="text-[12.5px] font-extrabold text-ink">
            Tampilkan Layar Penuh untuk Barber
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface BarberBriefModalProps extends BarberBriefProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Versi layar penuh: kontras tinggi, teks besar, angka rasio ditampilkan.
 * Dipakai saat mode barber aktif supaya bisa disodorkan langsung ke barber.
 */
export function BarberBriefModal({
  visible,
  onClose,
  styleName,
  faceShape,
  hairTypeLabel,
  guide,
  ratios,
}: BarberBriefModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-[#0B0D13]">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <View className="flex-row items-center justify-between border-b border-white/10 px-5 pb-4 pt-2">
            <View className="flex-row items-center gap-2">
              <Scissors size={22} color="#F59E0B" />
              <Text className="text-base font-black uppercase tracking-wider text-gold">
                Barber Brief
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <X size={13} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Tutup</Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 px-5 pt-5"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}>
            <Text className="text-[11px] font-bold uppercase tracking-widest text-white/45">
              Target potongan
            </Text>
            <Text className="mt-1 text-3xl font-black leading-9 text-white">{styleName}</Text>

            <View className="mt-3">
              <MetaChips faceShape={faceShape} hairTypeLabel={hairTypeLabel} />
            </View>

            {ratios ? (
              <View className="mt-5 flex-row gap-2">
                <RatioRow label="Panjang/Lebar" value={ratios.lengthToWidth} />
                <RatioRow label="Dahi/Pipi" value={ratios.foreheadToCheek} />
                <RatioRow label="Rahang/Pipi" value={ratios.jawToCheek} />
              </View>
            ) : null}

            <View className="mt-5 rounded-2xl border-2 border-gold/50 bg-[#161B29] p-5">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                Instruksi teknis
              </Text>
              <Text className="mt-2 text-[16px] leading-8 text-white/90">{guide}</Text>
            </View>

            <Text className="mt-4 text-center text-[11px] leading-5 text-white/35">
              Panduan ini saran, bukan diagnosis. Tetap cek hasil di depan cermin sebelum
              pelanggan keluar dari kursi.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}