import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Accent } from '@/constants/theme';

const ACTIVE_COLOR = Accent.primary;
const INACTIVE_COLOR = '#9DB0D1';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function DisabledTabButton(props: React.ComponentProps<typeof TouchableOpacity>) {
  return (
    <TouchableOpacity
      {...props}
      disabled
      activeOpacity={1}
      style={[props.style, { opacity: 0.45 }]}
    />
  );
}

function tabIcon(name: IoniconsName, outlineName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? name : outlineName} size={24} color={color} />
  );
}

function TabBarBackground({ bottomInset }: { bottomInset: number }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
      {bottomInset > 0 && (
        <View style={{ height: bottomInset, backgroundColor: '#F0F3FA' }} />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarSafeAreaInsets: { bottom: 0 },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: '#E3EBF6',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 56 + bottomInset,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8 + bottomInset,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarBackground: () => <TabBarBackground bottomInset={bottomInset} />,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: tabIcon('people', 'people-outline'),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: tabIcon('calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="pagos"
        options={{
          title: 'Pagos',
          tabBarIcon: tabIcon('card', 'card-outline'),
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: 'Más',
          tabBarIcon: ({ color }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ellipsis-horizontal" size={24} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
