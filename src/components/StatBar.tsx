import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { FONT } from '../lib/theme';

interface Props {
  label: string;
  emoji: string;
  value: number;    // 0–100
  color: string;
}

export default function StatBar({ label, emoji, value, color }: Props) {
  const widthAnim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: value,
      useNativeDriver: false,
      speed: 12,
    }).start();
  }, [value]);

  const urgentColor = value < 25 ? '#E74C3C' : color;

  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.trackWrapper}>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: urgentColor,
                width: widthAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.label, value < 25 && styles.labelUrgent]}>{label}</Text>
      </View>
      <Text style={[styles.value, value < 25 && styles.labelUrgent]}>{Math.round(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  emoji: {
    fontFamily: FONT,
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  trackWrapper: {
    flex: 1,
  },
  track: {
    height: 10,
    backgroundColor: '#2D2D4E',
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  label: {
    fontFamily: FONT,
    fontSize: 10,
    color: '#8888AA',
    marginTop: 2,
  },
  value: {
    fontFamily: FONT,
    fontSize: 13,
    color: '#CCCCDD',
    width: 28,
    textAlign: 'right',
    fontWeight: '700',
  },
  labelUrgent: {
    color: '#FF6B6B',
  },
});
