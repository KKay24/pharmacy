import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  icon,
  style,
  textStyle,
}: BadgeProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const getColors = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'primary':
        return { bg: theme.primarySoft, text: theme.primary, border: theme.primarySoft };
      case 'success':
        return { bg: theme.successSoft, text: theme.success, border: theme.successSoft };
      case 'warning':
        return { bg: theme.warningSoft, text: theme.warning, border: theme.warningSoft };
      case 'danger':
        return { bg: theme.dangerSoft, text: theme.danger, border: theme.dangerSoft };
      case 'info':
        return { bg: theme.infoSoft, text: theme.info, border: theme.infoSoft };
      case 'accent':
        return { bg: theme.accentSoft, text: theme.accent, border: theme.accentSoft };
      case 'neutral':
      default:
        return {
          bg: colorScheme === 'dark' ? '#334155' : '#f1f5f9',
          text: theme.mutedText,
          border: theme.border,
        };
    }
  };

  const colors = getColors();

  const sizeStyles = {
    sm: { paddingVertical: 2, paddingHorizontal: 6, fontSize: 10, borderRadius: layout.radius.xs },
    md: { paddingVertical: 4, paddingHorizontal: 9, fontSize: 11, borderRadius: layout.radius.sm },
    lg: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13, borderRadius: layout.radius.md },
  }[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border || 'transparent',
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: sizeStyles.borderRadius,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text
        style={[
          styles.text,
          { color: colors.text, fontSize: sizeStyles.fontSize },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default Badge;
