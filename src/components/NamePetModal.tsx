import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FONT, KAWAII, KAWAII_BTN } from '../lib/theme';
import { getSkinImages } from '../lib/skinImages';
import { useGameStore, MAX_NAME_LENGTH } from '../store/useGameStore';

const SUGGESTIONS = ['Mochi', 'Boba', 'Pudding', 'Dumpling', 'Peachy', 'Nubby', 'Taro', 'Sprout'];

interface Props {
  visible: boolean;
  // 'hatch' is the first-launch prompt (no way to skip); 'rename' comes from Settings.
  mode: 'hatch' | 'rename';
  onDone: () => void;
}

export default function NamePetModal({ visible, mode, onDone }: Props) {
  const creature       = useGameStore(s => s.creature);
  const renameCreature = useGameStore(s => s.renameCreature);
  const nubkinImgs     = getSkinImages(creature.equippedSkinId);

  const [name, setName] = useState('');
  const cardAnim = useRef(new Animated.Value(0)).current;
  const hopY     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setName(mode === 'rename' ? creature.name : '');
    cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
  }, [visible]);

  // Little hop whenever the name changes — the Nubkin reacts to being named.
  useEffect(() => {
    if (!visible || !name) return;
    hopY.setValue(0);
    Animated.sequence([
      Animated.timing(hopY, { toValue: -10, duration: 90, useNativeDriver: true }),
      Animated.spring(hopY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 14 }),
    ]).start();
  }, [name]);

  const trimmed = name.trim();

  function confirm() {
    if (!trimmed) return;
    renameCreature(trimmed);
    onDone();
  }

  const cardStyle = {
    opacity: cardAnim,
    transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={mode === 'rename' ? onDone : () => {}}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={mode === 'rename' ? onDone : undefined} />
        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.Image
            source={nubkinImgs.excited}
            style={[styles.nubkin, { transform: [{ translateY: hopY }] }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            {mode === 'hatch' ? 'A Nubkin hatched!' : 'Rename your Nubkin'}
          </Text>
          <Text style={styles.sub}>
            {mode === 'hatch' ? "They're looking at you… what's their name?" : 'Pick a new name they’ll love.'}
          </Text>

          <TextInput
            value={name}
            onChangeText={t => setName(t.slice(0, MAX_NAME_LENGTH))}
            placeholder="Type a name"
            placeholderTextColor="#B9A3BE"
            style={styles.input}
            maxLength={MAX_NAME_LENGTH}
            autoFocus={mode === 'rename'}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={confirm}
          />
          <Text style={styles.counter}>{trimmed.length}/{MAX_NAME_LENGTH}</Text>

          <View style={styles.chips}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.chip} onPress={() => setName(s)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, !trimmed && styles.confirmBtnDisabled]}
            onPress={confirm}
            disabled={!trimmed}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>
              {trimmed ? `Hi, ${trimmed}! 💕` : 'Choose a name'}
            </Text>
          </TouchableOpacity>

          {mode === 'rename' && (
            <TouchableOpacity onPress={onDone} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: KAWAII.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 330,
    backgroundColor: KAWAII.card,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: KAWAII.cardBorder,
    padding: 22,
    paddingTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  nubkin: { width: 110, height: 110, marginBottom: -4 },
  title: { fontFamily: FONT, color: KAWAII.ink, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  sub:   { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  input: {
    alignSelf: 'stretch',
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '800',
    color: KAWAII.ink,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: KAWAII.ink,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  counter: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 11, alignSelf: 'flex-end', marginTop: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: {
    backgroundColor: '#FFE3F1',
    borderWidth: 1.5,
    borderColor: KAWAII.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: FONT, color: KAWAII.ink, fontSize: 12, fontWeight: '700' },
  confirmBtn: {
    ...KAWAII_BTN,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: KAWAII.pink,
    paddingVertical: 14,
    marginTop: 6,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: { fontFamily: FONT, color: KAWAII.ink, fontSize: 17, fontWeight: '900' },
  cancelBtn:  { padding: 6 },
  cancelText: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14, fontWeight: '700' },
});
