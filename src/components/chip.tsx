import { Check } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

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
      className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2.5 ${
        selected ? 'border-gold bg-gold' : 'border-ink-border bg-ink-card'
      }`}>
      {selected ? <Check size={14} color="#121212" strokeWidth={3} /> : null}
      <Text
        className={`text-[13px] font-semibold ${
          selected ? 'text-ink' : 'text-white/75'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}
