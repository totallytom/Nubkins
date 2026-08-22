import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text, Image } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useGameStore } from './src/store/useGameStore';
import { useBGM }           from './src/hooks/useBGM';
import { useRevenueCat }    from './src/hooks/useRevenueCat';
import { useNotifications } from './src/hooks/useNotifications';
import { BG, FONT, FONT_MARU } from './src/lib/theme';
import HomeScreen      from './src/screens/HomeScreen';
import MiniGamesScreen from './src/screens/MiniGamesScreen';
import ShopScreen      from './src/screens/ShopScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import WardrobeScreen     from './src/screens/WardrobeScreen';
import DiamondStoreScreen from './src/screens/DiamondStoreScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: '#1A1A35',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor:   '#fefbff',
        tabBarInactiveTintColor: '#000000',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', fontFamily: FONT },
        tabBarIcon: ({ focused }) =>
          TAB_IMG[route.name] ? (
            <Image
              source={TAB_IMG[route.name]}
              style={{ width: 26, height: 26, opacity: focused ? 1 : 0.45 }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontFamily: FONT, fontSize: 22, opacity: focused ? 1 : 0.5 }}>
              {'cfg'}
            </Text>
          ),
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen}      />
      <Tab.Screen name="Games"    component={MiniGamesScreen} />
      <Tab.Screen name="Shop"     component={ShopScreen}      />
      <Tab.Screen name="Settings" component={SettingsScreen}  />
    </Tab.Navigator>
  );
}

const TAB_IMG: Record<string, any> = {
  Home:     require('./assets/nubkins/Nubkin1-Happy.png'),
  Games:    require('./assets/nav-bar/game.png'),
  Shop:     require('./assets/nav-bar/shop.png'),
  Settings: require('./assets/nav-bar/settings.png'),
};

export default function App() {
  const load   = useGameStore(s => s.load);
  const loaded = useGameStore(s => s.loaded);
  useBGM();
  useRevenueCat();
  useNotifications();

  const [fontsLoaded] = useFonts({
    [FONT]:      require('./assets/fonts/MUNMAK_BYEOLBANCHE.ttf'),
    [FONT_MARU]: require('./assets/fonts/MaruMinyaHangul.ttf'),
  });

  useEffect(() => { load(); }, []);

  if (!loaded || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
<ActivityIndicator color="#9B59B6" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="MainTabs"      component={TabNavigator}      />
          <Stack.Screen name="Wardrobe"      component={WardrobeScreen}     />
          <Stack.Screen name="DiamondStore"  component={DiamondStoreScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
