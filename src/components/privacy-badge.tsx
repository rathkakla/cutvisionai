import { Text, View } from 'react-native';

export function PrivacyBadge() {
  return (
    <View className="flex-row items-center gap-1.5 self-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      <View className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <Text className="text-[11px] font-medium text-white/55">
        Foto tidak disimpan permanen
      </Text>
    </View>
  );
}

export default PrivacyBadge;
