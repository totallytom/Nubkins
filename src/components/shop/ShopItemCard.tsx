import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Cosmetic } from '../../types';
import { FONT, KAWAII } from '../../lib/theme';
import { getThemeById } from '../../data/themes';
import { RARITY_COLOR } from './CosmeticPreviewModal';

const DIAMOND_IMG = require('../../../assets/currency/Diamond.png');
const COIN_IMG    = require('../../../assets/currency/Coin.png');

interface Props {
  item: Cosmetic;
  owned: boolean;
  equipped: boolean;
  playerLevel: number;
  accent: string;
  onPress: () => void;
}

// Themes have no artwork — draw a tiny capsule in the theme's colors instead.
function ThemeSwatch({ id }: { id: string }) {
  const t = getThemeById(id);
  return (
    <View style={[styles.swatch, { backgroundColor: t.shell }]}>
      <View style={[styles.swatchScreen, { backgroundColor: t.screen }]} />
      <View style={[styles.swatchPanel, { backgroundColor: t.panel }]} />
    </View>
  );
}

export default function ShopItemCard({ item, owned, equipped, playerLevel, accent, onPress }: Props) {
  const levelLocked       = !!(item.unlockLevel && playerLevel < item.unlockLevel);
  const achievementLocked = !!(item.achievementScores && !owned);

  let pill: React.ReactNode;
  if (equipped) {
    pill = <View style={[styles.pill, { backgroundColor: accent }]}><Text style={styles.pillText}>✓ On</Text></View>;
  } else if (owned) {
    pill = <View style={[styles.pill, { backgroundColor: KAWAII.mint }]}><Text style={styles.pillText}>Owned</Text></View>;
  } else if (levelLocked) {
    pill = <View style={[styles.pill, styles.pillMuted]}><Text style={styles.pillText}>🔒 Lv{item.unlockLevel}</Text></View>;
  } else if (achievementLocked) {
    pill = <View style={[styles.pill, { backgroundColor: '#FFF1B8' }]}><Text style={styles.pillText}>🏆 Achievement</Text></View>;
  } else if (item.priceCoin === 0 && item.priceDiamond === 0) {
    pill = <View style={[styles.pill, { backgroundColor: KAWAII.mint }]}><Text style={styles.pillText}>Free</Text></View>;
  } else if (item.priceDiamond > 0) {
    pill = (
      <View style={[styles.pill, { backgroundColor: '#DDF1FF' }]}>
        <Text style={styles.pillText}>{item.priceDiamond}</Text>
        <Image source={DIAMOND_IMG} style={styles.pillIcon} resizeMode="contain" />
      </View>
    );
  } else {
    pill = (
      <View style={[styles.pill, { backgroundColor: '#FFF1B8' }]}>
        <Text style={styles.pillText}>{item.priceCoin}</Text>
        <Image source={COIN_IMG} style={styles.pillIcon} resizeMode="contain" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, equipped && { borderColor: KAWAII.ink, backgroundColor: '#FFFFFF' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.art, (levelLocked || achievementLocked) && { opacity: 0.55 }]}>
        {item.type === 'background'
          ? <ThemeSwatch id={item.id} />
          : item.image
            ? <Image source={item.image} style={styles.img} resizeMode="contain" />
            : <Text style={styles.emoji}>{item.emoji}</Text>
        }
      </View>
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.rarity, { color: RARITY_COLOR[item.rarity] }]}>{item.rarity}</Text>
      {pill}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 104,
    backgroundColor: KAWAII.card,
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: '#FFC2E0',
  },
  art:    { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  img:    { width: 72, height: 72 },
  emoji:  { fontSize: 40 },
  name:   { fontFamily: FONT, color: KAWAII.ink, fontWeight: '800', fontSize: 11, textAlign: 'center' },
  rarity: { fontFamily: FONT, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: KAWAII.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillMuted: { backgroundColor: '#F1E8F4' },
  pillText:  { fontFamily: FONT, color: KAWAII.ink, fontWeight: '800', fontSize: 11 },
  pillIcon:  { width: 12, height: 12 },

  swatch: {
    width: 48,
    height: 66,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: KAWAII.ink,
    alignItems: 'center',
    paddingTop: 8,
    gap: 6,
  },
  swatchScreen: { width: 32, height: 24, borderRadius: 6 },
  swatchPanel:  { width: 32, height: 12, borderRadius: 6 },
});
