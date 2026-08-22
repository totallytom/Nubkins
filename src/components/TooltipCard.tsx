import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT } from '../lib/theme';

interface Props {
  visible: boolean;
  icon: string;
  title: string;
  message: string;
  onDismiss: () => void;
}

export default function TooltipCard({ visible, icon, title, message, onDismiss }: Props) {
  const [mounted, setMounted] = useState(false);
  const slideY = useRef(new Animated.Value(120)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 120, duration: 220, useNativeDriver: true }),
        Animated.timing(fade,   { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity: fade, transform: [{ translateY: slideY }] }]}
    >
      <View style={styles.card} pointerEvents="auto">
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.btnText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  card: {
    backgroundColor: '#1E1040',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#9B59B6',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#9B59B6',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
  icon:    { fontSize: 26 },
  body:    { flex: 1 },
  title:   { fontFamily: FONT, color: '#EFEFFF', fontWeight: '800', fontSize: 13, marginBottom: 3 },
  message: { fontFamily: FONT, color: '#9999BB', fontSize: 11, lineHeight: 17 },
  btn: {
    backgroundColor: '#9B59B6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 12 },
});
