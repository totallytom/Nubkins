import React, { useContext, useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarHeightCallbackContext, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { FONT, KAWAII } from '../lib/theme';

const CIRCLE = 60;

// Per-tab icon and the candy color its circle fills with when selected.
const TAB_META: Record<string, { image: any; color: string }> = {
  Home:     { image: require('../../assets/nubkins/Nubkin1-Happy.png'), color: KAWAII.pink },
  Games:    { image: require('../../assets/nav-bar/game.png'),          color: KAWAII.mint },
  Shop:     { image: require('../../assets/nav-bar/shop.png'),          color: KAWAII.yellow },
  Settings: { image: require('../../assets/nav-bar/settings.png'),      color: KAWAII.sky },
};

interface TabCircleProps {
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabCircle({ label, focused, onPress, onLongPress }: TabCircleProps) {
  const meta = TAB_META[label];
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: focused ? 1 : 0, speed: 18, bounciness: 12, useNativeDriver: true }).start();
  }, [focused]);

  const lift = {
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      { scale:      anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.tab}
    >
      {({ pressed }) => (
        <>
          <Animated.View
            style={[
              styles.circle,
              { backgroundColor: focused ? meta?.color ?? KAWAII.pink : KAWAII.card },
              !focused && { borderColor: meta?.color ?? KAWAII.pink },
              pressed && styles.circlePressed,
              lift,
            ]}
          >
            {meta && (
              <Image
                source={meta.image}
                style={[styles.icon, !focused && styles.iconIdle]}
                resizeMode="contain"
              />
            )}
          </Animated.View>
          <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function CircleTabBar({ state, navigation, insets }: BottomTabBarProps) {
  // The bar is absolutely positioned (transparent, floating over each screen),
  // so report its height for screens' useBottomTabBarHeight() padding.
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      onLayout={e => onHeightChange?.(e.nativeEvent.layout.height)}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        return (
          <TabCircle
            key={route.key}
            label={route.name}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingTop: 14,   // breathing room between the screen content and the circles
    backgroundColor: 'transparent',
  },
  tab: {
    alignItems: 'center',
    gap: 4,
    minWidth: CIRCLE + 8,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: KAWAII.ink,
    shadowColor: KAWAII.ink,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  circlePressed: { opacity: 0.85 },
  icon:     { width: 34, height: 34 },
  iconIdle: { opacity: 0.6 },
  // Labels sit on a cream pill so they stay readable over any screen background.
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    color: KAWAII.inkSoft,
    backgroundColor: 'rgba(255,246,251,0.85)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  labelFocused: {
    color: KAWAII.ink,
    fontWeight: '900',
  },
});
