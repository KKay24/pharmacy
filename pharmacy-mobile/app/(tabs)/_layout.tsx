import React from 'react';
import { Tabs } from 'expo-router';
import {
  Home,
  LayoutGrid,
  FileText,
  ShoppingCart,
  User,
  Boxes,
  Store,
} from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { canViewStaffWorkspace } from '@/utils/accountAccess';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_GREEN = '#00966d';
const ACTIVE_GREEN_BG = '#d1fae5';
const ACTIVE_GREEN_DARK_BG = 'rgba(0, 150, 109, 0.22)';

function TabIcon({
  focused,
  isDark,
  children,
}: {
  focused: boolean;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.tabIconWrap,
        focused && [
          styles.tabIconActive,
          { backgroundColor: isDark ? ACTIVE_GREEN_DARK_BG : ACTIVE_GREEN_BG },
        ],
      ]}
    >
      {focused ? <View style={styles.activeTopBar} /> : null}
      {children}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const { cartCount } = useCart();
  const insets = useSafeAreaInsets();

  const isStaff = canViewStaffWorkspace(user);

  // Tab bar height: 64dp content area + bottom safe-area inset
  // Ensures the bar always sits above Android system nav (3-button ~48dp, gesture ~16-24dp)
  const TAB_BAR_CONTENT_HEIGHT = 64;
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;
  const tabBarPaddingBottom = insets.bottom > 0 ? insets.bottom + 4 : 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_GREEN,
        tabBarInactiveTintColor: theme.mutedText,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: theme.surface,
        },
        headerTitleStyle: {
          fontWeight: '800',
          color: theme.navigation,
        },
        headerTintColor: ACTIVE_GREEN,
        headerShown: false,
      }}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <Home size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
            </TabIcon>
          ),
        }}
      />

      {/* 2a. POS (Visible for staff/cashiers so active POS tab is highlighted in MediQuick green) */}
      <Tabs.Screen
        name="pos"
        options={{
          href: isStaff ? undefined : null,
          title: 'POS',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <Store size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
            </TabIcon>
          ),
        }}
      />

      {/* 2b. Categories (Visible for customers/guests; still routable for staff) */}
      <Tabs.Screen
        name="categories"
        options={{
          href: isStaff ? null : undefined,
          title: 'Categories',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <LayoutGrid size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
            </TabIcon>
          ),
        }}
      />

      {/* 3a. Inventory (Visible for staff/cashiers) */}
      <Tabs.Screen
        name="inventory"
        options={{
          href: isStaff ? undefined : null,
          title: 'Inventory',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <Boxes size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
            </TabIcon>
          ),
        }}
      />

      {/* 3b. Prescriptions / Scripts */}
      <Tabs.Screen
        name="prescriptions"
        options={{
          title: 'Scripts',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <FileText size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
            </TabIcon>
          ),
        }}
      />

      {/* 4. Cart (Visible for customers/guests; staff can still open via header cart icon) */}
      <Tabs.Screen
        name="cart"
        options={{
          href: isStaff ? null : undefined,
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <View style={{ position: 'relative' }}>
                <ShoppingCart size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
                {cartCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                  </View>
                ) : null}
              </View>
            </TabIcon>
          ),
        }}
      />

      {/* 5. Account */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} isDark={isDark}>
              <User size={20} color={focused ? ACTIVE_GREEN : color} strokeWidth={focused ? 2.6 : 2} />
            </TabIcon>
          ),
        }}
      />

      {/* Hidden Staff Route (accessible via Hamburger Menu / Account) */}
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
    position: 'relative',
    minWidth: 46,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabIconActive: {
    borderWidth: 1,
    borderColor: 'rgba(0, 150, 109, 0.25)',
  },
  activeTopBar: {
    position: 'absolute',
    top: -6,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACTIVE_GREEN,
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -9,
    backgroundColor: ACTIVE_GREEN,
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
