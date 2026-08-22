import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT } from '../lib/theme';

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
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: '#1A1A35',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    borderColor: '#9B59B6',
    minWidth: 220,
  },
  title: {
    fontFamily: FONT,
    color: '#EFEFFF',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  resumeBtn: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  resumeText: {
    fontFamily: FONT,
    color: '#FFF',
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
    color: '#7777AA',
    fontWeight: '700',
    fontSize: 14,
  },
});
