import { Scissors, Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';

interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 72 }: BrandMarkProps) {
  return (
    <View
      className="relative items-center justify-center rounded-3xl border border-gold/30 bg-gold-soft shadow-lg shadow-gold/20"
      style={{ width: size, height: size }}>
      {/* Subtle decorative dot/sparkle */}
      <View className="absolute top-2 right-2">
        <Sparkles size={size * 0.18} color="#FBBF24" opacity={0.8} />
      </View>
      <Scissors color="#F59E0B" size={size * 0.48} strokeWidth={2} />
    </View>
  );
}

interface WordmarkProps {
  size?: 'sm' | 'lg';
  subtitle?: string;
}

export function Wordmark({ size = 'lg', subtitle }: WordmarkProps) {
  const isLarge = size === 'lg';

  return (
    <View className="items-center">
      <View className="flex-row items-center justify-center gap-1.5">
        <Text
          className={
            isLarge
              ? 'text-3xl font-black tracking-tight text-white'
              : 'text-lg font-black tracking-tight text-white'
          }>
          CutVision
        </Text>
        <View className="rounded-lg bg-gold/15 border border-gold/30 px-2 py-0.5">
          <Text
            className={
              isLarge
                ? 'text-xl font-black tracking-wider text-gold'
                : 'text-xs font-black tracking-wider text-gold'
            }>
            AI
          </Text>
        </View>
      </View>
      {subtitle ? (
        <Text
          className={
            isLarge
              ? 'mt-2 text-center text-sm font-medium text-white/60'
              : 'mt-0.5 text-[11px] font-medium tracking-wide text-white/50'
          }>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
