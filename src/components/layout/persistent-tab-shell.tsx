import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Accent } from '@/constants/theme';

type TabId = 'home' | 'clients' | 'agenda' | 'pagos' | 'mas';

type PersistentTabShellProps = {
  children: ReactNode;
  activeTab: TabId;
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type TabItem = {
  id: TabId;
  label: string;
  icon: IoniconsName;
  outlineIcon: IoniconsName;
  route: string;
};

const TAB_ITEMS: TabItem[] = [
  { id: 'home', label: 'Inicio', icon: 'home', outlineIcon: 'home-outline', route: '/' },
  { id: 'clients', label: 'Clientes', icon: 'people', outlineIcon: 'people-outline', route: '/clientes' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', outlineIcon: 'calendar-outline', route: '/agenda' },
  { id: 'pagos', label: 'Pagos', icon: 'card', outlineIcon: 'card-outline', route: '/pagos' },
  { id: 'mas', label: 'Más', icon: 'ellipsis-horizontal', outlineIcon: 'ellipsis-horizontal', route: '/mas' },
];

export function PersistentTabShell({ children, activeTab }: PersistentTabShellProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.content}>{children}</View>

      <View style={[styles.tabBar, { paddingBottom: Platform.OS === 'ios' ? 28 : 8 + bottomInset, height: Platform.OS === 'ios' ? 84 : 56 + bottomInset }]}>
        <View style={styles.tabBarBackground}>
          <View style={styles.tabBarBase} />
          {bottomInset > 0 ? <View style={[styles.tabBarInset, { height: bottomInset }]} /> : null}
        </View>

        {TAB_ITEMS.map((item) => {
          const focused = item.id === activeTab;

          return (
            <Pressable
              key={item.id}
              onPress={() => router.replace(item.route)}
              style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name={focused ? item.icon : item.outlineIcon} size={24} color={focused ? Accent.primary : '#9DB0D1'} />
              <ThemedText type="small" style={[styles.tabLabel, focused && styles.tabLabelActiveText]}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    position: 'relative',
    borderTopWidth: 1,
    borderTopColor: '#E3EBF6',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  tabBarBase: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBarInset: {
    backgroundColor: '#F0F3FA',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 54,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    color: '#9DB0D1',
    marginTop: 2,
  },
  tabLabelActiveText: {
    color: Accent.primary,
    fontWeight: '700',
  },
});