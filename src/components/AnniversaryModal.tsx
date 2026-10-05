import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT, KAWAII, KAWAII_BTN } from '../lib/theme';
import { outfitProps } from '../lib/outfit';
import { Anniversary } from '../lib/together';
import { Cosmetic } from '../types';
import { useGameStore } from '../store/useGameStore';
import NubkinCreature from './NubkinCreature';

const { width: SW, height: SH } = Dimensions.get('window');
const CONFETTI = ['🎉', '🎊', '✨', '💖', '🎈', '⭐', '💕', '🎀'];
const CONFETTI_N = 18;

interface Props {
  anniversary: Anniversary | null;
  reward: Cosmetic | null;
  onClose: () => void;
}

export default function AnniversaryModal({ anniversary, reward, onClose }: Props) {
  const creature       = useGameStore(s => s.creature);
  const equipAccessory = useGameStore(s => s.equipAccessory);
  const visible = anniversary !== null;

  const cardAnim = useRef(new Animated.Value(0)).current;
  const confetti = useRef(
    Array.from({ length: CONFETTI_N }, (_, i) => ({
      emoji: CONFETTI[i % CONFETTI.length],
      x: Math.random() * (SW - 30),
      fall: new Animated.Value(0),
      spin: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    cardAnim.setValue(0);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 12 }).start();
    Animated.stagger(90, confetti.map(c => {
      c.fall.setValue(0);
      c.spin.setValue(0);
      return Animated.parallel([
        Animated.timing(c.fall, { toValue: 1, duration: 2200 + Math.random() * 900, useNativeDriver: true }),
        Animated.timing(c.spin, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ]);
    })).start();
  }, [visible, anniversary?.days]);

  if (!anniversary) return null;

  const cardStyle = {
    opacity: cardAnim,
    transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
  };
  // Preview the Nubkin already wearing the reward.
  const outfit = outfitProps(
    reward?.type === 'accessory' ? reward.id : creature.equippedAccessoryId,
    creature.equippedTattooId,
    creature.equippedSpecialId,
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {confetti.map((c, i) => (
          <Animated.Text
            key={i}
            pointerEvents="none"
            style={[styles.confetti, {
              left: c.x,
              transform: [
                { translateY: c.fall.interpolate({ inputRange: [0, 1], outputRange: [-60, SH + 60] }) },
                { rotate: c.spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 360 : -360}deg`] }) },
              ],
            }]}
          >
            {c.emoji}
          </Animated.Text>
        ))}

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.kicker}>{anniversary.isBirthday ? '🎂 BIRTHDAY PARTY 🎂' : '🎉 ANNIVERSARY PARTY 🎉'}</Text>
          <Text style={styles.title}>{anniversary.title}</Text>
          <Text style={styles.sub}>{anniversary.days} days with {creature.name} 💕</Text>

          <View style={styles.stage}>
            <NubkinCreature
              mood="excited"
              skinId={creature.equippedSkinId}
              {...outfit}
              trait={creature.trait}
              hideGlow
              onTap={() => {}}
            />
          </View>

          {reward ? (
            <View style={styles.rewardBox}>
              <Text style={styles.rewardLabel}>A gift from {creature.name}!</Text>
              <Text style={styles.rewardName}>{reward.emoji} {reward.name}</Text>
              <Text style={styles.rewardDesc}>{reward.description}</Text>
            </View>
          ) : (
            <Text style={styles.sub}>📸 A party photo was saved to your memory book!</Text>
          )}

          {reward?.type === 'accessory' && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: KAWAII.mint }]}
              onPress={() => { equipAccessory(reward.id); onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>Wear it now!</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.btnText}>Yay! 🎉</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
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
  confetti: { position: 'absolute', top: 0, fontSize: 26 },
  card: {
    width: 330,
    backgroundColor: KAWAII.card,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: KAWAII.cardBorder,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  kicker: { fontFamily: FONT, color: KAWAII.orange, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  title:  { fontFamily: FONT, color: KAWAII.ink, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  sub:    { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 13, textAlign: 'center' },
  stage: {
    width: 180,
    height: 170,
    borderRadius: 90,
    backgroundColor: '#FFE3F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  rewardBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#FFF1B8',
    borderWidth: 2,
    borderColor: '#F5A300',
    borderRadius: 18,
    padding: 12,
    gap: 2,
  },
  rewardLabel: { fontFamily: FONT, color: KAWAII.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  rewardName:  { fontFamily: FONT, color: KAWAII.ink, fontSize: 18, fontWeight: '900' },
  rewardDesc:  { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12, textAlign: 'center' },
  btn: {
    ...KAWAII_BTN,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: KAWAII.pink,
    paddingVertical: 13,
  },
  btnText: { fontFamily: FONT, color: KAWAII.ink, fontSize: 16, fontWeight: '900' },
});
