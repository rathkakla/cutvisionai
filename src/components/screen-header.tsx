import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface ScreenHeaderProps {
  title: string;
  step?: string;
}

export function ScreenHeader({ title, step }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}
        className="h-10 w-10 items-center justify-center rounded-2xl border border-ink-border bg-ink-card active:bg-ink-soft">
        <ChevronLeft size={20} color="#F59E0B" />
      </Pressable>

      <Text className="flex-1 text-lg font-extrabold tracking-tight text-white">{title}</Text>

      {step ? (
        <View className="rounded-full border border-gold/30 bg-gold-soft px-3 py-1">
          <Text className="text-[11px] font-bold tracking-wider text-gold">{step}</Text>
        </View>
      ) : null}
    </View>
  );
}
