import React from 'react';
import { Image, StyleSheet } from 'react-native';

/** Official Azokar Space emblem shared by the app UI and Android launcher assets. */
export default function MoonMark({ size = 54 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/azokar-mark.png')}
      style={[styles.mark, { width: size, height: size }]}
      resizeMode="contain"
      accessibilityLabel="Logo de Azokar Space"
    />
  );
}

const styles = StyleSheet.create({ mark: { borderRadius: 999 } });
