import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import CircleTabBar       from './src/components/CircleTabBar';
import MemoryBookScreen   from './src/screens/MemoryBookScreen';
import ShopCategoryScreen from './src/screens/ShopCategoryScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <CircleTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen}      />
      <Tab.Screen name="Games"    component={MiniGamesScreen} />
      <Tab.Screen name="Shop"     component={ShopScreen}      />
      <Tab.Screen name="Settings" component={SettingsScreen}  />
    </Tab.Navigator>
  );
}

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
          <Stack.Screen name="MemoryBook"    component={MemoryBookScreen}   />
          <Stack.Screen name="ShopCategory"  component={ShopCategoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
