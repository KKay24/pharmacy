import React from 'react';
import { Tabs } from 'expo-router';
import { Home, LayoutGrid, FileText, ShoppingCart, User } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { cartCount } = useCart();
  const insets = useSafeAreaInsets();

  // Tab bar height: 60dp content area + bottom safe-area inset
  // This ensures the bar always sits above Android system nav (3-button ~48dp, gesture ~16-24dp)
  const TAB_BAR_CONTENT_HEIGHT = 60;
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;
  const tabBarPaddingBottom = insets.bottom > 0 ? insets.bottom + 4 : 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00966d',
        tabBarInactiveTintColor: '#64748b',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#eef2f6',
          borderTopWidth: 1,
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 6,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '800',
          color: '#0e3854',
        },
        headerTintColor: '#00966d',
        headerShown: false,
      }}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
              <Home size={21} color={focused ? '#00966d' : color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />

      {/* 2. Categories */}
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, focused }) => (
            <LayoutGrid size={21} color={focused ? '#00966d' : color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />

      {/* 3. Prescriptions */}
      <Tabs.Screen
        name="prescriptions"
        options={{
          title: 'Prescriptions',
          tabBarIcon: ({ color, focused }) => (
            <FileText size={21} color={focused ? '#00966d' : color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />

      {/* 4. Cart */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <ShoppingCart size={21} color={focused ? '#00966d' : color} strokeWidth={focused ? 2.5 : 2} />
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />

      {/* 5. Account */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <User size={21} color={focused ? '#00966d' : color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />

      {/* Hidden Routes (Staff & Operations accessible via Hamburger Menu / Account) */}
      <Tabs.Screen
        name="pos"
        options={{
          href: null,
          title: 'POS',
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          href: null,
          title: 'Inventory',
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          href: null,
          title: 'Operations',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    transform: [{ scale: 1.05 }],
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#00966d',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
