import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';

interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'flat';
  children: React.ReactNode;
}

export function Card({ style, variant = 'elevated', children, ...rest }: CardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
        };
      case 'flat':
        return {
          backgroundColor: colorScheme === 'dark' ? '#172033' : '#f8fafc',
          borderWidth: 1,
          borderColor: theme.borderLight,
        };
      case 'elevated':
      default:
        return {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: colorScheme === 'dark' ? '#000000' : '#0b3156',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: colorScheme === 'dark' ? 0.3 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        };
    }
  };

  return (
    <View style={[styles.card, getVariantStyle(), style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: layout.radius.lg,
    padding: layout.spacing.lg,
    overflow: 'hidden',
  },
});

export default Card;
