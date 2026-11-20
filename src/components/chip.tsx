import { Check } from 'lucide-react-native';
import { Pressable, Text, type ViewStyle } from 'react-native';

// Shadow via inline style: utility `shadow-*` memakai CSS variable, dan
// menambahkannya setelah render pertama memicu warning upgrade NativeWind.
const SELECTED_SHADOW: ViewStyle = {
  shadowColor: '#F59E0B',
  shadowOpacity: 0.25,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
};

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={selected ? SELECTED_SHADOW : undefined}
      className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2.5 ${
        selected ? 'border-gold bg-gold' : 'border-ink-border bg-ink-card active:bg-ink-soft'
      }`}>
      {selected ? <Check size={14} color="#0B0D13" strokeWidth={3} /> : null}
      <Text
        className={`text-[13px] ${
          selected ? 'font-bold text-[#0B0D13]' : 'font-medium text-white/80'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}
