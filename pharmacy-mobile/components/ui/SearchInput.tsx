import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Pressable,
  ViewStyle,
  TextInputProps,
  StyleProp,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';

interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  style,
  inputStyle,
  ...rest
}: SearchInputProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const handleClear = () => {
    onChangeText('');
    if (onClear) onClear();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      <Search size={18} color={theme.mutedText} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedText}
        style={[styles.input, { color: theme.text }, inputStyle]}
        clearButtonMode="never"
        returnKeyType="search"
        {...rest}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
          onPress={handleClear}
          hitSlop={8}
          style={styles.clearButton}
        >
          <X size={16} color={theme.mutedText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: layout.radius.md,
    borderWidth: 1,
    paddingHorizontal: layout.spacing.md,
  },
  searchIcon: {
    marginRight: layout.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
});

export default SearchInput;
