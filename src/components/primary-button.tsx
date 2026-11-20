import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type ButtonVariant = 'gold' | 'outline' | 'danger';

interface PrimaryButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}

const CONTAINER: Record<ButtonVariant, string> = {
  gold: 'bg-gold active:opacity-90',
  outline: 'border border-white/15 bg-ink-card active:bg-ink-soft',
  danger: 'border border-danger/40 bg-danger-soft active:opacity-80',
};

// Shadow via inline style: utility `shadow-*` memakai CSS variable, dan
// menambahkannya setelah render pertama (mis. disabled -> enabled) memicu
// warning upgrade NativeWind.
const CONTAINER_SHADOW: Record<ButtonVariant, ViewStyle | undefined> = {
  gold: {
    shadowColor: '#F59E0B',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  outline: undefined,
  danger: undefined,
};

const LABEL: Record<ButtonVariant, string> = {
  gold: 'text-[#0B0D13] font-black',
  outline: 'text-white font-bold',
  danger: 'text-danger font-bold',
};

export function PrimaryButton({
  label,
  variant = 'gold',
  icon,
  loading = false,
  caption,
  disabled,
  style,
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = Boolean(disabled) || loading;

  return (
    <View style={style} className="w-full">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        className={`w-full flex-row items-center justify-center gap-2.5 rounded-2xl px-5 py-4 ${
          isDisabled ? 'border border-ink-border bg-ink-soft/60' : CONTAINER[variant]
        }`}
        {...rest}
        style={isDisabled ? undefined : CONTAINER_SHADOW[variant]}>
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'gold' ? '#0B0D13' : '#F59E0B'} />
        ) : (
          icon
        )}
        <Text
          className={`text-center text-[15px] ${
            isDisabled ? 'text-white/30 font-bold' : LABEL[variant]
          }`}>
          {label}
        </Text>
      </Pressable>
      {caption ? (
        <Text className="mt-2 text-center text-xs text-white/45">{caption}</Text>
      ) : null}
    </View>
  );
}
