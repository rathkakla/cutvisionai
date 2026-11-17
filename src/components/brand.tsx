import { Scissors } from 'lucide-react-native';
import { Text, View } from 'react-native';

interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 72 }: BrandMarkProps) {
  return (
    <View
      className="items-center justify-center rounded-3xl border border-gold-line bg-gold-soft"
      style={{ width: size, height: size }}>
      <Scissors color="#D9822B" size={size * 0.46} strokeWidth={1.8} />
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
      <Text
        className={
          isLarge
            ? 'text-4xl font-extrabold tracking-tight text-white'
            : 'text-lg font-extrabold tracking-tight text-white'
        }>
        CutVision <Text className="text-gold">AI</Text>
      </Text>
      {subtitle ? (
        <Text
          className={
            isLarge
              ? 'mt-2 text-center text-base text-white/60'
              : 'mt-0.5 text-[11px] tracking-wide text-white/50'
          }>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
