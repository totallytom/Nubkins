import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { FONT } from '../lib/theme';

interface Props {
  coins: number;
  diamonds: number;
}

export default function CoinDisplay({ coins, diamonds }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <Image source={require('../../assets/currency/Coin.png')} style={styles.icon} resizeMode="contain" />
        <Text style={styles.amount}>{coins}</Text>
      </View>
      <View style={styles.pill}>
        <Image source={require('../../assets/currency/Diamond.png')} style={styles.icon} resizeMode="contain" />
        <Text style={styles.amount}>{diamonds}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dfdfeb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
    borderWidth: 1,
    borderColor: '#3D3D6B',
  },
  icon:   { width: 20, height: 20 },
  amount: { fontFamily: FONT, color: '#030303', fontWeight: '700', fontSize: 14 },
});
