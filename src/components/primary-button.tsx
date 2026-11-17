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
  gold: 'bg-gold',
  outline: 'border border-white/20 bg-transparent',
  danger: 'border border-danger/60 bg-danger-soft',
};

const LABEL: Record<ButtonVariant, string> = {
  gold: 'text-ink',
  outline: 'text-white',
  danger: 'text-danger',
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
          isDisabled ? 'border border-ink-border bg-ink-soft' : CONTAINER[variant]
        }`}
        {...rest}>
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'gold' ? '#121212' : '#D9822B'} />
        ) : (
          icon
        )}
        <Text
          className={`text-center text-[15px] font-bold ${
            isDisabled ? 'text-white/35' : LABEL[variant]
          }`}>
          {label}
        </Text>
      </Pressable>
      {caption ? (
        <Text className="mt-2 text-center text-xs text-white/40">{caption}</Text>
      ) : null}
    </View>
  );
}
