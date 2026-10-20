import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: any;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const isDisabled = disabled || loading;

  const getVariantStyles = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'primary':
        return {
          bg: isDisabled ? (colorScheme === 'dark' ? '#334155' : '#b4c1c2') : theme.primary,
          text: '#ffffff',
        };
      case 'secondary':
        return {
          bg: isDisabled ? (colorScheme === 'dark' ? '#1e293b' : '#e2e8f0') : theme.navigation,
          text: '#ffffff',
        };
      case 'outline':
        return {
          bg: 'transparent',
          text: isDisabled ? theme.mutedText : theme.primary,
          border: isDisabled ? theme.border : theme.primary,
        };
      case 'danger':
        return {
          bg: isDisabled ? (colorScheme === 'dark' ? '#334155' : '#fca5a5') : theme.danger,
          text: '#ffffff',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          text: isDisabled ? theme.mutedText : theme.text,
        };
      default:
        return { bg: theme.primary, text: '#ffffff' };
    }
  };

  const vStyles = getVariantStyles();

  const sizeStyles = {
    sm: { height: 36, paddingHorizontal: 12, fontSize: 13, borderRadius: layout.radius.sm },
    md: { height: 46, paddingHorizontal: 16, fontSize: 15, borderRadius: layout.radius.md },
    lg: { height: 54, paddingHorizontal: 20, fontSize: 16, borderRadius: layout.radius.lg },
  }[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: vStyles.bg,
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: sizeStyles.borderRadius,
          borderWidth: vStyles.border ? 1.5 : 0,
          borderColor: vStyles.border || 'transparent',
          width: fullWidth ? '100%' : undefined,
          opacity: pressed && !isDisabled ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vStyles.text} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon || icon ? (
            <View style={styles.leftIcon}>
              {leftIcon || (typeof icon === 'string' ? null : icon)}
            </View>
          ) : null}
          <Text
            style={[
              styles.text,
              { color: vStyles.text, fontSize: sizeStyles.fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

export default Button;
