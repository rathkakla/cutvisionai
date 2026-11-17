import { Text, View } from 'react-native';

interface SectionHeadingProps {
  title: string;
  hint?: string;
  required?: boolean;
}

export function SectionHeading({ title, hint, required }: SectionHeadingProps) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1">
        <Text className="text-[13px] font-bold uppercase tracking-widest text-white/80">
          {title}
        </Text>
        {required ? <Text className="text-[13px] font-bold text-gold">*</Text> : null}
      </View>
      {hint ? <Text className="text-xs leading-5 text-white/45">{hint}</Text> : null}
    </View>
  );
}
