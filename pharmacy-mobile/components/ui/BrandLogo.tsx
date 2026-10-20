import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface BrandLogoProps {
  /**
   * Predefined size variants:
   * - 'sm': 120 x 40
   * - 'md': 155 x 52 (default)
   * - 'lg': 210 x 70
   * - 'xl': 270 x 90
   * - 'icon': 40 x 40 square mark
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export function BrandLogo({ size = 'md', width, height, style }: BrandLogoProps) {
  if (size === 'icon') {
    const iconDim = width || height || 40;
    return (
      <Image
        source={require('@/assets/images/icon.png')}
        style={[{ width: iconDim, height: iconDim }, style]}
        resizeMode="contain"
        accessibilityLabel="MediQuick Pharmacy Icon"
      />
    );
  }

  let finalWidth = 155;
  let finalHeight = 52;

  switch (size) {
    case 'sm':
      finalWidth = 120;
      finalHeight = 40;
      break;
    case 'md':
      finalWidth = 155;
      finalHeight = 52;
      break;
    case 'lg':
      finalWidth = 210;
      finalHeight = 70;
      break;
    case 'xl':
      finalWidth = 270;
      finalHeight = 90;
      break;
  }

  if (width && height) {
    finalWidth = width;
    finalHeight = height;
  } else if (width) {
    finalWidth = width;
    finalHeight = Math.round(width / 1.5015);
  } else if (height) {
    finalHeight = height;
    finalWidth = Math.round(height * 1.5015);
  }

  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={[{ width: finalWidth, height: finalHeight }, style]}
      resizeMode="contain"
      accessibilityLabel="MediQuick Pharmacy"
    />
  );
}

export default BrandLogo;
