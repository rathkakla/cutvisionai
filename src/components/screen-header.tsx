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
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-border bg-ink-card">
        <ChevronLeft size={20} color="#FFFFFF" />
      </Pressable>

      <Text className="flex-1 text-lg font-bold text-white">{title}</Text>

      {step ? (
        <View className="rounded-full border border-gold-line bg-gold-soft px-3 py-1.5">
          <Text className="text-[11px] font-semibold tracking-wide text-gold">{step}</Text>
        </View>
      ) : null}
    </View>
  );
}
