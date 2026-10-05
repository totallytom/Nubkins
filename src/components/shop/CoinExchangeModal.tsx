import React, { useEffect, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../../store/useGameStore';
import { COINS_PER_DIAMOND } from '../../data/economy';
import { FONT, KAWAII, KAWAII_BTN } from '../../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Bottom sheet for converting coins to diamonds with a drag slider.
export default function CoinExchangeModal({ visible, onClose }: Props) {
  const coins                  = useGameStore(s => s.profile.coins);
  const convertCoinsToDiamonds = useGameStore(s => s.convertCoinsToDiamonds);

  const diamondsAvailable = Math.floor(coins / COINS_PER_DIAMOND);
  const progressPct       = Math.min((coins % COINS_PER_DIAMOND) / COINS_PER_DIAMOND, 1);

  const [amount,     setAmount]     = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  // Default the slider to the max the player can afford each time it opens.
  useEffect(() => {
    if (visible) setAmount(diamondsAvailable);
  }, [visible]);

  const spendCoins  = amount * COINS_PER_DIAMOND;
  const remainCoins = coins - spendCoins;

  function updateFromX(x: number) {
    if (diamondsAvailable < 1 || trackWidth <= 0) return;
    const pct = Math.max(0, Math.min(1, x / trackWidth));
    setAmount(Math.max(1, Math.round(pct * diamondsAvailable)));
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: e => updateFromX(e.nativeEvent.locationX),
    onPanResponderMove:  e => updateFromX(e.nativeEvent.locationX),
  });

  function handleConfirm() {
    if (convertCoinsToDiamonds(amount)) onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Coin Exchange</Text>
          <Text style={styles.rate}>{COINS_PER_DIAMOND.toLocaleString()} coins = 1 diamond</Text>

          <View style={styles.row}>
            <View style={styles.side}>
              <Text style={styles.label}>You spend</Text>
              <Text style={styles.amount}>{spendCoins.toLocaleString()} coins</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.side}>
              <Text style={styles.label}>You receive</Text>
              <Text style={[styles.amount, { color: '#3498DB' }]}>{amount} diamonds</Text>
            </View>
          </View>

          {diamondsAvailable >= 1 && (
            <View style={styles.sliderWrap}>
              <View
                style={styles.sliderTrack}
                onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
              >
                <View style={[styles.sliderFill, { width: `${(amount / diamondsAvailable) * 100}%` }]} />
                <View style={[styles.sliderHandle, { left: Math.max(0, (amount / diamondsAvailable) * trackWidth - 14) }]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderMinMax}>1</Text>
                <Text style={styles.sliderMinMax}>{diamondsAvailable} max</Text>
              </View>
            </View>
          )}

          <View style={styles.remaining}>
            <Text style={styles.remainingLabel}>Remaining after conversion</Text>
            <Text style={styles.remainingVal}>{remainCoins.toLocaleString()} coins</Text>
          </View>

          {diamondsAvailable < 1 ? (
            <View style={styles.shortfall}>
              <Text style={styles.shortfallText}>
                Need {(COINS_PER_DIAMOND - coins).toLocaleString()} more coins
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
              </View>
              <Text style={styles.progressLabel}>
                {coins.toLocaleString()} / {COINS_PER_DIAMOND.toLocaleString()}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={handleConfirm}>
              <Text style={styles.btnText}>Convert {amount} diamond{amount === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
    gap: 14,
  },
  handle: { width: 40, height: 5, backgroundColor: KAWAII.pink, borderRadius: 3, marginBottom: 8 },
  title:  { fontFamily: FONT, color: KAWAII.ink, fontWeight: '900', fontSize: 24 },
  rate:   { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFC2E0',
    borderRadius: 18,
    padding: 18,
  },
  side:   { flex: 1, alignItems: 'center', gap: 4 },
  label:  { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12 },
  amount: { fontFamily: FONT, color: KAWAII.orange, fontWeight: '900', fontSize: 22 },
  arrow:  { fontFamily: FONT, color: KAWAII.ink, fontSize: 22, fontWeight: '700' },
  sliderWrap:  { alignSelf: 'stretch', gap: 6 },
  sliderTrack: {
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1E8F4',
    borderWidth: 2,
    borderColor: KAWAII.ink,
    justifyContent: 'center',
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: KAWAII.sky,
    borderRadius: 14,
  },
  sliderHandle: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5, borderColor: KAWAII.ink,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderMinMax: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 11 },
  remaining: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF1B8',
    borderWidth: 2,
    borderColor: '#F5A300',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  remainingLabel: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12 },
  remainingVal:   { fontFamily: FONT, color: KAWAII.ink, fontWeight: '700', fontSize: 16 },
  shortfall:      { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  shortfallText:  { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 10,
    backgroundColor: '#F1E8F4',
    borderWidth: 1.5,
    borderColor: KAWAII.ink,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill:  { height: '100%', backgroundColor: KAWAII.yellow, borderRadius: 4 },
  progressLabel: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12 },
  btn: {
    ...KAWAII_BTN,
    backgroundColor: KAWAII.sky,
    paddingHorizontal: 40,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { fontFamily: FONT, color: KAWAII.ink, fontWeight: '900', fontSize: 16 },
});
