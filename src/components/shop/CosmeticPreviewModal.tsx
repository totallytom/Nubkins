import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { COSMETICS } from '../../data/cosmetics';
import { Cosmetic } from '../../types';
import { FONT, KAWAII, KAWAII_BTN } from '../../lib/theme';
import NubkinCreature from '../NubkinCreature';

export const RARITY_COLOR: Record<string, string> = {
  common:    '#7777AA',
  rare:      '#3498DB',
  epic:      '#9B59B6',
  legendary: '#F39C12',
};

interface Props {
  item: Cosmetic | null;
  onClose: () => void;
}

// Bottom sheet that previews a cosmetic on the Nubkin and handles buy / equip.
// Also owns the little "item floats down" flourish after a purchase, so it
// should be rendered inside a full-screen parent.
export default function CosmeticPreviewModal({ item, onClose }: Props) {
  const profile        = useGameStore(s => s.profile);
  const creature       = useGameStore(s => s.creature);
  const buyCosmetic    = useGameStore(s => s.buyCosmetic);
  const equipSkin      = useGameStore(s => s.equipSkin);
  const equipAccessory = useGameStore(s => s.equipAccessory);
  const equipTattoo    = useGameStore(s => s.equipTattoo);
  const equipSpecial   = useGameStore(s => s.equipSpecial);
  const setTheme       = useGameStore(s => s.setTheme);

  // The preview starts from what the Nubkin is wearing and swaps in the item.
  const [previewSkin,    setPreviewSkin]    = useState(creature.equippedSkinId);
  const [previewAcc,     setPreviewAcc]     = useState(creature.equippedAccessoryId);
  const [previewTattoo,  setPreviewTattoo]  = useState(creature.equippedTattooId);
  const [previewSpecial, setPreviewSpecial] = useState(creature.equippedSpecialId);

  useEffect(() => {
    setPreviewSkin(item?.type === 'skin' ? item.id : creature.equippedSkinId);
    setPreviewAcc(item?.type === 'accessory' ? item.id : creature.equippedAccessoryId);
    setPreviewTattoo(item?.type === 'tattoo' ? item.id : creature.equippedTattooId);
    setPreviewSpecial(item?.type === 'special' ? item.id : creature.equippedSpecialId);
  }, [item?.id]);

  const [floatEmoji, setFloatEmoji] = useState('');
  const floatY  = useRef(new Animated.Value(-100)).current;
  const floatOp = useRef(new Animated.Value(0)).current;

  function triggerItemFloat(emoji: string) {
    setFloatEmoji(emoji);
    floatY.setValue(-100);
    floatOp.setValue(1);
    Animated.sequence([
      Animated.spring(floatY, { toValue: 160, useNativeDriver: true, speed: 7, bounciness: 10 }),
      Animated.delay(380),
      Animated.timing(floatOp, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setFloatEmoji(''));
  }

  function equip(c: Cosmetic) {
    if (c.type === 'skin')             equipSkin(c.id);
    else if (c.type === 'accessory')   equipAccessory(c.id);
    else if (c.type === 'tattoo')      equipTattoo(c.id);
    else if (c.type === 'special')     equipSpecial(c.id);
    else if (c.type === 'background')  setTheme(c.id);
  }

  function handleBuyOrEquip(c: Cosmetic) {
    if (profile.ownedCosmeticIds.includes(c.id)) {
      equip(c);
      onClose();
      return;
    }

    if (c.unlockLevel && creature.level < c.unlockLevel) {
      Alert.alert('Locked!', `Reach level ${c.unlockLevel} to unlock this item.`);
      return;
    }

    const costStr = c.priceDiamond > 0 ? `${c.priceDiamond} diamonds` : `${c.priceCoin} coins`;
    const haveEnough = c.priceDiamond > 0
      ? profile.diamonds >= c.priceDiamond
      : profile.coins >= c.priceCoin;

    if (!haveEnough) {
      Alert.alert('Not enough!', `You need ${costStr}.`);
      return;
    }

    Alert.alert(
      `Buy ${c.name}?`,
      `This costs ${costStr}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy & Equip',
          onPress: () => {
            if (!buyCosmetic(c.id, c.priceCoin, c.priceDiamond)) return;
            equip(c);
            onClose();
            if (c.type !== 'background') triggerItemFloat(c.emoji || '✨');
          },
        },
      ]
    );
  }

  const acc     = previewAcc     ? COSMETICS.find(c => c.id === previewAcc)     : null;
  const tattoo  = previewTattoo  ? COSMETICS.find(c => c.id === previewTattoo)  : null;
  const special = previewSpecial ? COSMETICS.find(c => c.id === previewSpecial) : null;

  const owned = item ? profile.ownedCosmeticIds.includes(item.id) : false;
  const achievementLocked = !!(item?.achievementScores && !owned);
  const equipped = !!item && (
    creature.equippedSkinId === item.id || creature.equippedAccessoryId === item.id ||
    creature.equippedTattooId === item.id || creature.equippedSpecialId === item.id
  );

  return (
    <>
      <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.creatureArea}>
              {item?.type === 'special' && item.image ? (
                <Image source={item.image} style={styles.specialStandalone} resizeMode="contain" />
              ) : (
                <NubkinCreature
                  mood="happy"
                  skinId={previewSkin}
                  accessoryEmoji={acc?.emoji || null}
                  accessoryImage={acc?.image ?? null}
                  accessoryImageStyle={acc?.imageStyle}
                  tattooImage={tattoo?.image}
                  tattooImageStyle={tattoo?.imageStyle}
                  specialImage={special?.image}
                  specialImageStyle={special?.imageStyle}
                  onTap={() => {}}
                />
              )}
            </View>
            {item && (
              <>
                <View style={styles.info}>
                  {item.image
                    ? <Image source={item.image} style={styles.infoImg} resizeMode="contain" />
                    : <Text style={styles.infoEmoji}>{item.emoji}</Text>
                  }
                  <View>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={[styles.rarity, { color: RARITY_COLOR[item.rarity] }]}>
                      {item.rarity.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.desc}>{item.description}</Text>
                {item.unlockLevel && creature.level < item.unlockLevel && (
                  <View style={styles.lockBanner}>
                    <Text style={styles.lockText}>Requires Level {item.unlockLevel}</Text>
                  </View>
                )}
                {achievementLocked && (
                  <View style={[styles.lockBanner, styles.lockBannerGold]}>
                    {item.achievementScores!.map(req => (
                      <Text key={req.gameId} style={[styles.lockText, { color: KAWAII.orange }]}>
                        {req.score.toLocaleString()}+ in{' '}
                        {req.gameId.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                      </Text>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.buyBtn, owned && styles.equipBtn, achievementLocked && styles.lockedBtn]}
                  onPress={() => { if (!achievementLocked) handleBuyOrEquip(item); }}
                >
                  <Text style={styles.buyBtnText}>
                    {owned
                      ? equipped ? '✓ Equipped' : 'Equip'
                      : achievementLocked
                        ? 'Locked'
                        : item.priceDiamond > 0
                          ? `Buy for ${item.priceDiamond} diamonds`
                          : item.priceCoin === 0
                            ? 'Claim Free'
                            : `Buy for ${item.priceCoin} coins`
                    }
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Accessory float-down — appears when a new item is first equipped */}
      {floatEmoji !== '' && (
        <Animated.View pointerEvents="none" style={[styles.floatOverlay, { opacity: floatOp, transform: [{ translateY: floatY }] }]}>
          <Text style={styles.floatEmoji}>{floatEmoji}</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: KAWAII.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: KAWAII.card,
    borderWidth: 4,
    borderBottomWidth: 0,
    borderColor: KAWAII.cardBorder,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  handle:       { width: 40, height: 5, backgroundColor: KAWAII.pink, borderRadius: 3, marginBottom: 8 },
  creatureArea: { height: 180, justifyContent: 'center', alignItems: 'center' },
  specialStandalone: { width: 150, height: 150 },
  info:      { flexDirection: 'row', alignItems: 'center', gap: 16, alignSelf: 'stretch' },
  infoEmoji: { fontFamily: FONT, fontSize: 44 },
  infoImg:   { width: 80, height: 80 },
  name:      { fontFamily: FONT, color: KAWAII.ink, fontWeight: '800', fontSize: 20 },
  rarity:    { fontFamily: FONT, fontWeight: '700', fontSize: 12, marginTop: 2 },
  desc:      { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14, textAlign: 'center', alignSelf: 'stretch' },
  lockBanner: {
    backgroundColor: '#F1E8F4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  lockBannerGold: { backgroundColor: '#FFF1B8', borderWidth: 2, borderColor: '#F5A300' },
  lockText: { fontFamily: FONT, color: KAWAII.inkSoft, fontWeight: '700' },
  buyBtn: {
    ...KAWAII_BTN,
    backgroundColor: KAWAII.pink,
    paddingHorizontal: 40,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 4,
  },
  equipBtn:   { backgroundColor: KAWAII.mint },
  lockedBtn:  { backgroundColor: '#E3D8E8' },
  buyBtnText: { fontFamily: FONT, color: KAWAII.ink, fontWeight: '900', fontSize: 16 },
  floatOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  floatEmoji:   { fontSize: 60 },
});
