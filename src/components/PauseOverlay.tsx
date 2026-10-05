import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT, KAWAII, KAWAII_BTN } from '../lib/theme';

interface Props {
  visible: boolean;
  onResume: () => void;
  onQuit:   () => void;
}

export default function PauseOverlay({ visible, onResume, onQuit }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Paused</Text>
        <TouchableOpacity style={styles.resumeBtn} onPress={onResume}>
          <Text style={styles.resumeText}>▶  Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quitBtn} onPress={onQuit}>
          <Text style={styles.quitText}>Quit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: KAWAII.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: KAWAII.card,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 4,
    borderColor: KAWAII.cardBorder,
    minWidth: 220,
  },
  title: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  resumeBtn: {
    ...KAWAII_BTN,
    backgroundColor: KAWAII.mint,
    paddingHorizontal: 40,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  resumeText: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontWeight: '800',
    fontSize: 17,
  },
  quitBtn: {
    paddingVertical: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  quitText: {
    fontFamily: FONT,
    color: KAWAII.inkSoft,
    fontWeight: '700',
    fontSize: 14,
  },
});
