import React from 'react';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { Boxes, ShoppingCart, User, Info } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <Boxes color={color} size={24} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable style={{ marginRight: 15 }}>
                {({ pressed }) => (
                  <Info
                    size={24}
                    color={Colors[colorScheme].text}
                    style={{ opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: 'Point of Sale',
          tabBarIcon: ({ color }) => <ShoppingCart color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
