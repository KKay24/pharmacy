import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  subValue,
  icon,
  iconBg,
  trend,
  style,
}: StatCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: colorScheme === 'dark' ? '#000000' : '#0b3156',
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        {icon ? (
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: iconBg || theme.primarySoft },
            ]}
          >
            {icon}
          </View>
        ) : null}
        {trend ? (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor:
                  trend.direction === 'up'
                    ? theme.successSoft
                    : trend.direction === 'down'
                    ? theme.dangerSoft
                    : theme.surfaceMuted,
              },
            ]}
          >
            {trend.direction === 'up' ? (
              <TrendingUp size={12} color={theme.success} />
            ) : trend.direction === 'down' ? (
              <TrendingDown size={12} color={theme.danger} />
            ) : null}
            <Text
              style={[
                styles.trendText,
                {
                  color:
                    trend.direction === 'up'
                      ? theme.success
                      : trend.direction === 'down'
                      ? theme.danger
                      : theme.mutedText,
                },
              ]}
            >
              {trend.value}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: theme.mutedText }]} numberOfLines={1}>
        {label}
      </Text>
      {subValue ? (
        <Text style={[styles.subValue, { color: theme.textSecondary }]} numberOfLines={1}>
          {subValue}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: layout.radius.md,
    borderWidth: 1,
    padding: layout.spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.spacing.sm,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: layout.radius.full,
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  subValue: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
});
