import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/useGameStore';
import { COSMETICS } from '../data/cosmetics';
import { Cosmetic, CosmeticType } from '../types';
import CoinDisplay from '../components/CoinDisplay';
import NubkinCreature from '../components/NubkinCreature';
import { FONT } from '../lib/theme';
import { getThemeById } from '../data/themes';
import { COINS_PER_DIAMOND } from '../data/economy';
import TooltipCard from '../components/TooltipCard';
import { useTooltip } from '../hooks/useTooltip';

const TABS: { id: CosmeticType | 'all'; label: string }[] = [
  { id: 'all',        label: 'All'        },
  { id: 'skin',       label: 'Skins'      },
  { id: 'accessory',  label: 'Accessories' },
  { id: 'tattoo',     label: 'Tattoos'    },
  { id: 'special',    label: 'Special'    },
  { id: 'background', label: 'Themes'     },
];

const FEATURED_IDS = [
  'skin-starry', 'acc-fighthat', 'acc-frostcrown', 'acc-halo',
  'acc-witch4', 'acc-witch5', 'acc-glasses', 'acc-bow',
];

function getDailyFeatured(): Cosmetic | null {
  const day = Math.floor(Date.now() / 86400000);
  const id  = FEATURED_IDS[day % FEATURED_IDS.length];
  return COSMETICS.find(c => c.id === id) ?? null;
}

const RARITY_COLOR: Record<string, string> = {
  common:    '#7777AA',
  rare:      '#3498DB',
  epic:      '#9B59B6',
  legendary: '#F39C12',
};

export default function ShopScreen() {
  const navigation = useNavigation<any>();
  const profile               = useGameStore(s => s.profile);
  const creature               = useGameStore(s => s.creature);
  const buyCosmetic            = useGameStore(s => s.buyCosmetic);
  const equipSkin              = useGameStore(s => s.equipSkin);
  const equipAccessory         = useGameStore(s => s.equipAccessory);
  const equipTattoo            = useGameStore(s => s.equipTattoo);
  const equipSpecial           = useGameStore(s => s.equipSpecial);
  const convertCoinsToDiamonds = useGameStore(s => s.convertCoinsToDiamonds);
  const themeId                = useGameStore(s => s.themeId);
  const setTheme                = useGameStore(s => s.setTheme);
  const activeTheme = getThemeById(themeId);

  const [tab,           setTab]           = useState<CosmeticType | 'all'>('all');
  const [preview,       setPreview]       = useState<Cosmetic | null>(null);
  const [previewSkin,    setPreviewSkin]    = useState(creature.equippedSkinId);
  const [previewAcc,     setPreviewAcc]     = useState(creature.equippedAccessoryId);
  const [previewTattoo,  setPreviewTattoo]  = useState(creature.equippedTattooId);
  const [previewSpecial, setPreviewSpecial] = useState(creature.equippedSpecialId);
  const [convertOpen,           setConvertOpen]           = useState(false);
  const [convertAmount,         setConvertAmount]         = useState(0);
  const [convertTrackWidth,     setConvertTrackWidth]     = useState(0);
  const shopTooltip = useTooltip('first_shop');
  const [floatEmoji, setFloatEmoji]  = useState('');
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

  const diamondsAvailable = Math.floor(profile.coins / COINS_PER_DIAMOND);
  const coinsAfter        = profile.coins - diamondsAvailable * COINS_PER_DIAMOND;
  const progressPct       = Math.min((profile.coins % COINS_PER_DIAMOND) / COINS_PER_DIAMOND, 1);

  const spendCoins   = convertAmount * COINS_PER_DIAMOND;
  const remainCoins  = profile.coins - spendCoins;

  function openConvertModal() {
    setConvertAmount(diamondsAvailable);
    setConvertOpen(true);
  }

  function updateConvertFromX(x: number) {
    if (diamondsAvailable < 1 || convertTrackWidth <= 0) return;
    const pct = Math.max(0, Math.min(1, x / convertTrackWidth));
    setConvertAmount(Math.max(1, Math.round(pct * diamondsAvailable)));
  }

  const convertPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: e => updateConvertFromX(e.nativeEvent.locationX),
    onPanResponderMove:  e => updateConvertFromX(e.nativeEvent.locationX),
  });

  const visibleItems  = COSMETICS.filter(c => tab === 'all' || c.type === tab);
  const featuredItem  = getDailyFeatured();

  function handleSelectPreview(item: Cosmetic) {
    setPreview(item);
    if (item.type === 'skin')      setPreviewSkin(item.id);
    if (item.type === 'accessory') setPreviewAcc(item.id);
    if (item.type === 'tattoo')    setPreviewTattoo(item.id);
    if (item.type === 'special')   setPreviewSpecial(item.id);
  }

  function handleClosePreview() {
    setPreview(null);
    setPreviewSkin(creature.equippedSkinId);
    setPreviewAcc(creature.equippedAccessoryId);
    setPreviewTattoo(creature.equippedTattooId);
    setPreviewSpecial(creature.equippedSpecialId);
  }

  function handleBuyOrEquip(item: Cosmetic) {
    const owned = profile.ownedCosmeticIds.includes(item.id);
    if (owned) {
      if (item.type === 'skin')             equipSkin(item.id);
      else if (item.type === 'accessory')   equipAccessory(item.id);
      else if (item.type === 'tattoo')      equipTattoo(item.id);
      else if (item.type === 'special')     equipSpecial(item.id);
      else if (item.type === 'background')  setTheme(item.id);
      handleClosePreview();
      return;
    }

    if (item.unlockLevel && creature.level < item.unlockLevel) {
      Alert.alert('Locked!', `Reach level ${item.unlockLevel} to unlock this item.`);
      return;
    }

    const costStr = item.priceDiamond > 0
      ? `${item.priceDiamond} diamonds`
      : `${item.priceCoin} coins`;
    const haveEnough = item.priceDiamond > 0
      ? profile.diamonds >= item.priceDiamond
      : profile.coins >= item.priceCoin;

    if (!haveEnough) {
      Alert.alert('Not enough!', `You need ${costStr}.`);
      return;
    }

    Alert.alert(
      `Buy ${item.name}?`,
      `This costs ${costStr}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy & Equip',
          onPress: () => {
            const ok = buyCosmetic(item.id, item.priceCoin, item.priceDiamond);
            if (ok) {
              if (item.type === 'skin')             equipSkin(item.id);
              else if (item.type === 'accessory')   equipAccessory(item.id);
              else if (item.type === 'tattoo')      equipTattoo(item.id);
              else if (item.type === 'special')     equipSpecial(item.id);
              else if (item.type === 'background')  setTheme(item.id);
              handleClosePreview();
              if (item.type !== 'background') {
                triggerItemFloat(item.emoji ?? '✨');
              }
            }
          },
        },
      ]
    );
  }

  function handleConfirmConvert() {
    const ok = convertCoinsToDiamonds(convertAmount);
    if (ok) setConvertOpen(false);
  }

  const previewAccCosmetic       = previewAcc ? COSMETICS.find(c => c.id === previewAcc) : null;
  const previewAccessoryEmoji    = previewAccCosmetic?.emoji ?? null;
  const previewAccessoryImage    = previewAccCosmetic?.image ?? null;
  const previewAccessoryImgStyle = previewAccCosmetic?.imageStyle ?? undefined;
  const previewTattooCosmetic    = previewTattoo ? COSMETICS.find(c => c.id === previewTattoo) : null;
  const previewTattooImage       = previewTattooCosmetic?.image ?? undefined;
  const previewTattooImgStyle    = previewTattooCosmetic?.imageStyle ?? undefined;
  const previewSpecialCosmetic   = previewSpecial ? COSMETICS.find(c => c.id === previewSpecial) : null;
  const previewSpecialImage      = previewSpecialCosmetic?.image ?? undefined;
  const previewSpecialImgStyle   = previewSpecialCosmetic?.imageStyle ?? undefined;

  return (
    <ImageBackground
      source={require('../../assets/bg/shopbg.png')}
      style={styles.bgImage}
      resizeMode="stretch"
    >
      <View style={styles.bgOverlay} />
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Cosmetic preview modal ── */}
      <Modal visible={preview !== null} transparent animationType="slide" onRequestClose={handleClosePreview}>
        <Pressable style={styles.previewBackdrop} onPress={handleClosePreview}>
          <Pressable style={styles.previewSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.previewCreatureArea}>
              {preview?.type === 'special' && preview.image ? (
                <Image source={preview.image} style={styles.previewSpecialStandalone} resizeMode="contain" />
              ) : (
                <NubkinCreature
                  mood="happy"
                  skinId={previewSkin}
                  accessoryEmoji={previewAccessoryEmoji}
                  accessoryImage={previewAccessoryImage}
                  accessoryImageStyle={previewAccessoryImgStyle}
                  tattooImage={previewTattooImage}
                  tattooImageStyle={previewTattooImgStyle}
                  specialImage={previewSpecialImage}
                  specialImageStyle={previewSpecialImgStyle}
                  onTap={() => {}}
                />
              )}
            </View>
            {preview && (
              <>
                <View style={styles.previewInfo}>
                  {preview.image
                    ? <Image source={preview.image} style={styles.previewImg} resizeMode="contain" />
                    : <Text style={styles.previewEmoji}>{preview.emoji}</Text>
                  }
                  <View>
                    <Text style={styles.previewName}>{preview.name}</Text>
                    <Text style={[styles.rarityBadge, { color: RARITY_COLOR[preview.rarity] }]}>
                      {preview.rarity.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.previewDesc}>{preview.description}</Text>
                {preview.unlockLevel && creature.level < preview.unlockLevel && (
                  <View style={styles.lockBanner}>
                    <Text style={styles.lockText}>Requires Level {preview.unlockLevel}</Text>
                  </View>
                )}
                {preview.achievementScores && !profile.ownedCosmeticIds.includes(preview.id) && (
                  <View style={[styles.lockBanner, { backgroundColor: '#F39C1222', borderWidth: 1, borderColor: '#F39C1266' }]}>
                    {preview.achievementScores.map(req => (
                      <Text key={req.gameId} style={[styles.lockText, { color: '#F39C12' }]}>
                        {req.score.toLocaleString()}+ in{' '}
                        {req.gameId.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                      </Text>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.buyBtn,
                    profile.ownedCosmeticIds.includes(preview.id) && styles.equipBtn,
                    (preview.achievementScores && !profile.ownedCosmeticIds.includes(preview.id)) && styles.lockedBtn,
                  ]}
                  onPress={() => {
                    if (preview.achievementScores && !profile.ownedCosmeticIds.includes(preview.id)) return;
                    handleBuyOrEquip(preview);
                  }}
                >
                  <Text style={styles.buyBtnText}>
                    {profile.ownedCosmeticIds.includes(preview.id)
                      ? (creature.equippedSkinId === preview.id || creature.equippedAccessoryId === preview.id || creature.equippedTattooId === preview.id || creature.equippedSpecialId === preview.id)
                        ? '✓ Equipped'
                        : 'Equip'
                      : preview.achievementScores
                        ? 'Locked'
                        : preview.priceDiamond > 0
                          ? `Buy for ${preview.priceDiamond} diamonds`
                          : preview.priceCoin === 0
                            ? 'Claim Free'
                            : `Buy for ${preview.priceCoin} coins`
                    }
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Convert modal ── */}
      <Modal visible={convertOpen} transparent animationType="slide" onRequestClose={() => setConvertOpen(false)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setConvertOpen(false)}>
          <Pressable style={styles.convertSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />

            <Text style={styles.convertTitle}>Coin Exchange</Text>
            <Text style={styles.convertRate}>{COINS_PER_DIAMOND.toLocaleString()} coins = 1 diamond</Text>

            <View style={styles.convertRow}>
              <View style={styles.convertSide}>
                <Text style={styles.convertLabel}>You spend</Text>
                <Text style={styles.convertAmount}>
                  {spendCoins.toLocaleString()} coins
                </Text>
              </View>
              <Text style={styles.convertArrow}>→</Text>
              <View style={styles.convertSide}>
                <Text style={styles.convertLabel}>You receive</Text>
                <Text style={[styles.convertAmount, { color: '#3498DB' }]}>
                  {convertAmount} diamonds
                </Text>
              </View>
            </View>

            {diamondsAvailable >= 1 && (
              <View style={styles.convertSliderWrap}>
                <View
                  style={styles.convertSliderTrack}
                  onLayout={e => setConvertTrackWidth(e.nativeEvent.layout.width)}
                  {...convertPanResponder.panHandlers}
                >
                  <View
                    style={[styles.convertSliderFill, { width: `${(convertAmount / diamondsAvailable) * 100}%` }]}
                  />
                  <View
                    style={[
                      styles.convertSliderHandle,
                      { left: Math.max(0, (convertAmount / diamondsAvailable) * convertTrackWidth - 14) },
                    ]}
                  />
                </View>
                <View style={styles.convertSliderLabels}>
                  <Text style={styles.convertSliderMinMax}>1</Text>
                  <Text style={styles.convertSliderMinMax}>{diamondsAvailable} max</Text>
                </View>
              </View>
            )}

            <View style={styles.convertRemaining}>
              <Text style={styles.convertRemainingLabel}>Remaining after conversion</Text>
              <Text style={styles.convertRemainingVal}>{remainCoins.toLocaleString()} coins</Text>
            </View>

            {diamondsAvailable < 1 ? (
              <View style={styles.convertShortfall}>
                <Text style={styles.convertShortfallText}>
                  Need {(COINS_PER_DIAMOND - profile.coins).toLocaleString()} more coins
                </Text>
                <View style={styles.convertProgressTrack}>
                  <View style={[styles.convertProgressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
                </View>
                <Text style={styles.convertProgressLabel}>
                  {profile.coins.toLocaleString()} / {COINS_PER_DIAMOND.toLocaleString()}
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.convertBtn} onPress={handleConfirmConvert}>
                <Text style={styles.convertBtnText}>Convert {convertAmount} diamond{convertAmount === 1 ? '' : 's'}</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Fixed top panel (header + tabs + utility banners) ── */}
      <View style={styles.topPanel}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Shop</Text>
            <Text style={styles.subtitle}>Customize your Nubkin</Text>
          </View>
          <CoinDisplay coins={profile.coins} diamonds={profile.diamonds} />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Get Diamonds */}
        <TouchableOpacity style={styles.gemBanner} onPress={() => navigation.navigate('DiamondStore')} activeOpacity={0.8}>
          <Image source={require('../../assets/currency/Diamond.png')} style={styles.gemBannerIcon} resizeMode="contain" />
          <View style={styles.gemBannerText}>
            <Text style={styles.gemBannerTitle}>Get Diamonds</Text>
            <Text style={styles.gemBannerSub}>Buy bundles to unlock premium items</Text>
          </View>
          <Text style={styles.gemBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* Coin Exchange */}
        <TouchableOpacity style={styles.convertBanner} onPress={openConvertModal} activeOpacity={0.8}>
          <View style={styles.convertBannerLeft}>
            <Text style={styles.convertBannerIcon}>Coins→Diamonds</Text>
            <View>
              <Text style={styles.convertBannerTitle}>Coin Exchange</Text>
              {diamondsAvailable >= 1
                ? <Text style={styles.convertBannerSub}>Ready: convert {diamondsAvailable} dias now!</Text>
                : <Text style={styles.convertBannerSub}>{profile.coins.toLocaleString()} / {COINS_PER_DIAMOND.toLocaleString()} coins</Text>
              }
            </View>
          </View>
          <View style={styles.convertBannerRight}>
            {diamondsAvailable >= 1
              ? <View style={styles.convertReadyBadge}><Text style={styles.convertReadyText}>Convert</Text></View>
              : <View style={styles.convertProgressMini}>
                  <View style={[styles.convertProgressMiniFill, { width: `${Math.round(progressPct * 100)}%` }]} />
                </View>
            }
          </View>
        </TouchableOpacity>

      </View>{/* end topPanel */}

      {/* ── Item grid ── */}
      <ScrollView style={styles.itemsScroll} contentContainerStyle={styles.scrollContent}>

        {/* Featured card — only on All tab */}
        {tab === 'all' && featuredItem && (() => {
          const fOwned = profile.ownedCosmeticIds.includes(featuredItem.id);
          return (
            <TouchableOpacity
              style={styles.featuredCard}
              onPress={() => handleSelectPreview(featuredItem)}
              activeOpacity={0.82}
            >
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>FEATURED TODAY</Text>
              </View>
              <View style={styles.featuredRow}>
                {featuredItem.image
                  ? <Image source={featuredItem.image} style={styles.featuredImg} resizeMode="contain" />
                  : <Text style={styles.featuredEmoji}>{featuredItem.emoji}</Text>
                }
                <View style={styles.featuredInfo}>
                  <Text style={styles.featuredName}>{featuredItem.name}</Text>
                  <Text style={[styles.featuredRarity, { color: RARITY_COLOR[featuredItem.rarity] }]}>
                    {featuredItem.rarity.toUpperCase()}
                  </Text>
                  <Text style={styles.featuredDesc} numberOfLines={2}>{featuredItem.description}</Text>
                  <View style={styles.featuredFooter}>
                    {!fOwned && featuredItem.priceDiamond > 0 ? (
                      <View style={styles.featuredPriceRow}>
                        <Text style={styles.featuredPrice}>{featuredItem.priceDiamond}</Text>
                        <Image source={require('../../assets/currency/Diamond.png')} style={styles.featuredPriceIcon} resizeMode="contain" />
                      </View>
                    ) : (
                      <Text style={styles.featuredPrice}>
                        {fOwned ? 'Owned' : featuredItem.priceCoin === 0 ? 'Free' : `${featuredItem.priceCoin} coins`}
                      </Text>
                    )}
                    <View style={[styles.featuredBtn, fOwned && styles.featuredBtnOwned]}>
                      <Text style={styles.featuredBtnText}>{fOwned ? 'Equip' : 'View'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })()}

        <View style={styles.grid}>
        {visibleItems.map(item => {
          const owned   = profile.ownedCosmeticIds.includes(item.id);
          const equipped = item.type === 'skin'
            ? creature.equippedSkinId === item.id
            : item.type === 'tattoo'
              ? creature.equippedTattooId === item.id
              : item.type === 'special'
                ? creature.equippedSpecialId === item.id
                : item.type === 'background'
                  ? themeId === item.id
                  : creature.equippedAccessoryId === item.id;
          const locked  = !!(item.unlockLevel && creature.level < item.unlockLevel);
          const achievementLocked = !!(item.achievementScores && !owned);

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.itemCard, equipped && styles.itemCardEquipped]}
              onPress={() => handleSelectPreview(item)}
              activeOpacity={0.8}
            >
              {item.image
                ? <Image source={item.image} style={styles.itemImg} resizeMode="contain" />
                : <Text style={styles.itemEmoji}>{item.emoji}</Text>
              }
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.itemRarity, { color: RARITY_COLOR[item.rarity] }]}>{item.rarity}</Text>
              {equipped ? (
                <View style={[styles.pricePill, { backgroundColor: '#9B59B633', borderColor: '#9B59B6' }]}>
                  <Text style={{ color: '#9B59B6', fontWeight: '800', fontSize: 11 }}>On</Text>
                </View>
              ) : owned ? (
                <View style={[styles.pricePill, { backgroundColor: '#27AE6033', borderColor: '#27AE60' }]}>
                  <Text style={{ color: '#27AE60', fontWeight: '700', fontSize: 11 }}>Owned</Text>
                </View>
              ) : locked ? (
                <View style={[styles.pricePill, { backgroundColor: '#55557733', borderColor: '#555577' }]}>
                  <Text style={{ fontFamily: FONT, color: '#7777AA', fontSize: 10 }}>Lv{item.unlockLevel}</Text>
                </View>
              ) : achievementLocked ? (
                <View style={[styles.pricePill, { backgroundColor: '#F39C1233', borderColor: '#F39C12' }]}>
                  <Text style={{ fontFamily: FONT, color: '#F39C12', fontSize: 10 }}>Achievement</Text>
                </View>
              ) : item.priceCoin === 0 && item.priceDiamond === 0 ? (
                <View style={[styles.pricePill, { backgroundColor: '#27AE6033', borderColor: '#27AE60' }]}>
                  <Text style={{ fontFamily: FONT, color: '#27AE60', fontWeight: '700', fontSize: 11 }}>Free</Text>
                </View>
              ) : item.priceDiamond > 0 ? (
                <View style={[styles.pricePill, { backgroundColor: '#3498DB33', borderColor: '#3498DB' }]}>
                  <Text style={{ fontFamily: FONT, color: '#3498DB', fontWeight: '700', fontSize: 11 }}>{item.priceDiamond} gems</Text>
                </View>
              ) : (
                <View style={[styles.pricePill, { backgroundColor: '#F39C1233', borderColor: '#F39C12' }]}>
                  <Text style={{ fontFamily: FONT, color: '#F39C12', fontWeight: '700', fontSize: 11 }}>{item.priceCoin} coins</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        </View>

        {visibleItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌟</Text>
            <Text style={styles.emptyTitle}>Coming Soon</Text>
            <Text style={styles.emptyDesc}>More items are on the way!</Text>
          </View>
        )}

      </ScrollView>

      {/* Accessory float-down — appears when a new item is first equipped */}
      {floatEmoji !== '' && (
        <Animated.View pointerEvents="none" style={[styles.floatOverlay, { opacity: floatOp, transform: [{ translateY: floatY }] }]}>
          <Text style={styles.floatEmoji}>{floatEmoji}</Text>
        </Animated.View>
      )}

      <TooltipCard
        visible={shopTooltip.visible}
        icon="🛍️"
        title="Welcome to the Shop!"
        message="Spend coins on common items and diamonds on rare cosmetics. Earn diamonds from daily logins and milestone levels!"
        onDismiss={shopTooltip.dismiss}
      />

    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage:      { flex: 1 },
  floatOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 999, pointerEvents: 'none' },
  floatEmoji:   { fontSize: 60 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,235,180,0.18)' },
  safe:      { flex: 1, backgroundColor: 'transparent' },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 0 },

  topPanel: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
  },
  itemsScroll:   { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Featured card
  featuredCard: {
    marginHorizontal: 12,
    marginBottom: 14,
    marginTop: 4,
    backgroundColor: '#ffffffee',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    shadowColor: '#B8860B',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#C9A84C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  featuredBadgeText: { fontFamily: FONT, color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  featuredRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featuredImg:  { width: 88, height: 88 },
  featuredEmoji: { fontSize: 56, width: 88, textAlign: 'center' },
  featuredInfo:  { flex: 1, gap: 3 },
  featuredName:  { fontFamily: FONT, color: '#111', fontSize: 18, fontWeight: '900' },
  featuredRarity: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  featuredDesc:  { fontFamily: FONT, color: '#666688', fontSize: 12, lineHeight: 17 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  featuredPrice: { fontFamily: FONT, color: '#C9A84C', fontWeight: '900', fontSize: 14 },
  featuredPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featuredPriceIcon: { width: 16, height: 16 },
  featuredBtn:      { backgroundColor: '#C9A84C', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  featuredBtnOwned: { backgroundColor: '#27AE60' },
  featuredBtnText:  { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 13 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: FONT, color: '#444466', fontWeight: '800', fontSize: 18 },
  emptyDesc:  { fontFamily: FONT, color: '#9999BB', fontSize: 13 },
  title:    { fontFamily: FONT, color: '#121212', fontSize: 26, fontWeight: '900' },
  subtitle: { fontFamily: FONT, color: '#7777AA', fontSize: 13, marginTop: 2 },

  tabsRow: { flexShrink: 0 },
  tabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, columnGap: 8 },
  tab: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#eeeef3',
    borderWidth: 1,
    borderColor: '#2D2D4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive:     { backgroundColor: '#9B59B6', borderColor: '#9B59B6' },
  tabText:       { fontFamily: FONT, color: '#000000', fontWeight: '700', fontSize: 13 },
  tabTextActive: { fontFamily: FONT, color: '#FFF' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 10,
    justifyContent: 'center',
  },
  itemCard: {
    width: 100,
    backgroundColor: '#e4e4eb',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#2D2D4E',
  },
  itemCardEquipped: { borderColor: '#9B59B6', backgroundColor: '#e4e4eb' },
  itemEmoji:  { fontFamily: FONT, fontSize: 38 },
  itemImg:    { width: 72, height: 72 },
  itemName:   { fontFamily: FONT, color: '#000000', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  itemRarity: { fontFamily: FONT, fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  pricePill: {
    marginTop: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },

  // Preview modal
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(46, 45, 45, 0.05)', justifyContent: 'flex-end' },
  previewSheet: {
    backgroundColor: '#d1d1e0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#3D3D6B', borderRadius: 2, marginBottom: 8 },
  previewCreatureArea: { height: 180, justifyContent: 'center', alignItems: 'center' },
  previewSpecialStandalone: { width: 150, height: 150 },
  previewInfo: { flexDirection: 'row', alignItems: 'center', gap: 16, alignSelf: 'stretch' },
  previewEmoji: { fontFamily: FONT, fontSize: 44 },
  previewImg:   { width: 80, height: 80 },
  previewName: { fontFamily: FONT, color: '#000000', fontWeight: '800', fontSize: 20 },
  rarityBadge: { fontFamily: FONT, fontWeight: '700', fontSize: 12, marginTop: 2 },
  previewDesc: { fontFamily: FONT, color: '#7777AA', fontSize: 14, textAlign: 'center', alignSelf: 'stretch' },
  lockBanner: {
    backgroundColor: '#55557733',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  lockText: { fontFamily: FONT, color: '#7777AA', fontWeight: '700' },
  buyBtn: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 4,
  },
  equipBtn:   { backgroundColor: '#27AE60' },
  lockedBtn:  { backgroundColor: '#555577' },
  buyBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 16 },

  // ── Get Diamonds banner ────────────────────────────────
  gemBanner: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3498DB44',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  gemBannerIcon:  { width: 36, height: 36 },
  gemBannerText:  { flex: 1 },
  gemBannerTitle: { fontFamily: FONT, color: '#000000', fontSize: 15, fontWeight: '900' },
  gemBannerSub:   { fontFamily: FONT, color: '#555577', fontSize: 11, marginTop: 2 },
  gemBannerArrow: { color: '#000000', fontSize: 24, fontWeight: '700' },

  // ── Conversion banner ──────────────────────────────────
  convertBanner: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3498DB44',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convertBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  convertBannerIcon:  { fontFamily: FONT, fontSize: 15 },
  convertBannerTitle: { fontFamily: FONT, color: '#000000', fontWeight: '700', fontSize: 13 },
  convertBannerSub:   { fontFamily: FONT, color: '#7777AA', fontSize: 11, marginTop: 1 },
  convertBannerRight: { alignItems: 'flex-end' },
  convertReadyBadge:  { backgroundColor: '#3498DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  convertReadyText:   { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 12 },
  convertProgressMini: {
    width: 72,
    height: 6,
    backgroundColor: '#2D2D4E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  convertProgressMiniFill: { height: '100%', backgroundColor: '#F39C12', borderRadius: 3 },

  // ── Convert sheet ──────────────────────────────────────
  convertSheet: {
    backgroundColor: '#e6e6fd',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  convertTitle: { fontFamily: FONT, color: '#00000c', fontWeight: '900', fontSize: 24 },
  convertRate:  { fontFamily: FONT, color: '#7777AA', fontSize: 14 },
  convertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    alignSelf: 'stretch',
    backgroundColor: '#c6c6d8',
    borderRadius: 16,
    padding: 18,
  },
  convertSide:   { flex: 1, alignItems: 'center', gap: 4 },
  convertLabel:  { fontFamily: FONT, color: '#7777AA', fontSize: 12 },
  convertAmount: { fontFamily: FONT, color: '#f59700', fontWeight: '900', fontSize: 22 },
  convertArrow:  { fontFamily: FONT, color: '#555577', fontSize: 22, fontWeight: '700' },
  convertSliderWrap:  { alignSelf: 'stretch', gap: 6 },
  convertSliderTrack: {
    height: 32,
    borderRadius: 16,
    backgroundColor: '#c6c6d8',
    justifyContent: 'center',
    overflow: 'visible',
  },
  convertSliderFill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: '#3498DB',
    borderRadius: 16,
  },
  convertSliderHandle: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#3498DB',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  convertSliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  convertSliderMinMax: { fontFamily: FONT, color: '#7777AA', fontSize: 11 },
  convertRemaining: {
    alignSelf: 'stretch',
    backgroundColor: '#bcbcd3',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  convertRemainingLabel: { fontFamily: FONT, color: '#00000c', fontSize: 12 },
  convertRemainingVal:   { fontFamily: FONT, color: '#000000', fontWeight: '700', fontSize: 16 },
  convertShortfall: { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  convertShortfallText: { fontFamily: FONT, color: '#7777AA', fontSize: 14 },
  convertProgressTrack: {
    alignSelf: 'stretch',
    height: 8,
    backgroundColor: '#2D2D4E',
    borderRadius: 4,
    overflow: 'hidden',
  },
  convertProgressFill: { height: '100%', backgroundColor: '#F39C12', borderRadius: 4 },
  convertProgressLabel: { fontFamily: FONT, color: '#555577', fontSize: 12 },
  convertBtn: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 4,
  },
  convertBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 16 },
});
