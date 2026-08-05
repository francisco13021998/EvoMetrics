import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { scheduleTestDeviceNotification } from '@/services/device-notifications';
import { router } from 'expo-router';

type MenuItemProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
};

function MenuItem({ icon, title, subtitle }: MenuItemProps) {
  return (
    <View style={styles.menuItem}>
      <View style={styles.menuIcon}>{icon}</View>
      <View style={styles.menuCopy}>
        <ThemedText type="smallBold" style={styles.menuTitle} numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.menuSubtitle} numberOfLines={2}>
          {subtitle}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8B9BB8" />
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode; }) {
  const theme = useTheme();

  return (
    <View style={[styles.sectionCard, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="label" style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function MasTab() {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = React.useState(false);
  const [testNotificationFeedback, setTestNotificationFeedback] = React.useState<{
    tone: 'info' | 'success' | 'warning' | 'danger';
    title: string;
    message: string;
  } | null>(null);

  const userName = (user?.user_metadata?.fullName as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Usuario';
  const clinicName = (user?.user_metadata?.clinicName as string | undefined)?.trim() || 'EvoMetrics Studio';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleTestNotification() {
    setIsSendingTestNotification(true);
    setTestNotificationFeedback(null);

    try {
      await scheduleTestDeviceNotification();
      setTestNotificationFeedback({
        tone: 'success',
        title: 'Notificación programada',
        message: 'Llegará en 1 minuto. Si el móvil está bloqueado, también debería mostrarse ahí.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo programar la notificación de prueba.';
      setTestNotificationFeedback({
        tone: 'danger',
        title: 'No se pudo programar',
        message,
      });
    } finally {
      setIsSendingTestNotification(false);
    }
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.title}>Más</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Ajustes, herramientas y cuenta
            </ThemedText>
          </View>
        </View>

        <View style={[styles.profileCard, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.profileAvatar}>
            <ThemedText style={styles.profileAvatarText}>{initials || 'U'}</ThemedText>
          </View>
          <View style={styles.profileCopy}>
            <ThemedText type="headline" style={styles.profileName} numberOfLines={2}>{userName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.profileCompany} numberOfLines={1}>
              {clinicName}
            </ThemedText>
          </View>
          <View style={styles.planBadge}>
            <ThemedText type="smallBold" style={styles.planBadgeText}>Plan Pro</ThemedText>
          </View>
        </View>

        <SectionCard title="Cuenta">
          <MenuItem icon={<Ionicons name="person-outline" size={22} color={Accent.primary} />} title="Perfil profesional" subtitle="Gestiona tu información personal" />
          <MenuItem icon={<Ionicons name="trophy-outline" size={22} color={Accent.primary} />} title="Mi suscripción" subtitle="Gestiona tu plan y beneficios" />
          <MenuItem icon={<Ionicons name="card-outline" size={22} color={Accent.primary} />} title="Métodos de pago" subtitle="Tarjetas y métodos guardados" />
        </SectionCard>

        <SectionCard title="Aplicación">
          <View style={styles.notificationTestCard}>
            <View style={styles.notificationTestCopy}>
              <View style={styles.menuIcon}>
                <Ionicons name="notifications-outline" size={22} color={Accent.primary} />
              </View>
              <View style={styles.menuCopy}>
                <ThemedText type="smallBold" style={styles.menuTitle} numberOfLines={1}>
                  Notificaciones
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.menuSubtitle} numberOfLines={3}>
                  Genera una alerta local de prueba para comprobar en el dispositivo si el sistema de notificaciones está funcionando.
                </ThemedText>
              </View>
            </View>
            <AppButton
              label="Probar en 1 min"
              variant="secondary"
              size="compact"
              fullWidth={false}
              onPress={() => { void handleTestNotification(); }}
              loading={isSendingTestNotification}
              leadingIcon={<Ionicons name="alarm-outline" size={16} color={Accent.primary} />}
            />
          </View>
          {testNotificationFeedback ? (
            <StatusBanner
              tone={testNotificationFeedback.tone}
              title={testNotificationFeedback.title}
              message={testNotificationFeedback.message}
              loading={isSendingTestNotification}
            />
          ) : null}
          <MenuItem icon={<Ionicons name="moon-outline" size={22} color={Accent.primary} />} title="Apariencia" subtitle="Tema claro, idioma y más" />
          <MenuItem icon={<Ionicons name="extension-puzzle-outline" size={22} color={Accent.primary} />} title="Integraciones" subtitle="Conecta con tus herramientas favoritas" />
          <MenuItem icon={<Ionicons name="download-outline" size={22} color={Accent.primary} />} title="Exportar datos" subtitle="Descarga tu información" />
        </SectionCard>

        <SectionCard title="Soporte">
          <MenuItem icon={<Ionicons name="help-circle-outline" size={22} color={Accent.primary} />} title="Ayuda y soporte" subtitle="Centro de ayuda y contacto" />
          <MenuItem icon={<Ionicons name="shield-checkmark-outline" size={22} color={Accent.primary} />} title="Política de privacidad" subtitle="Cómo protegemos tus datos" />
          <MenuItem icon={<Ionicons name="document-text-outline" size={22} color={Accent.primary} />} title="Términos y condiciones" subtitle="Términos de uso de EvoMetrics" />
        </SectionCard>

        <Pressable
          onPress={() => { void handleLogout(); }}
          style={({ pressed }) => [styles.logoutButton, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.88 : 1 }]}
          disabled={isSigningOut}>
          <Ionicons name="log-out-outline" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.logoutText}>{isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</ThemedText>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 0,
  },
  scrollContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerCopy: {
    gap: 2,
  },
  title: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    lineHeight: 18,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    ...Shadows.card,
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7E3FF',
  },
  profileAvatarText: {
    color: Accent.primary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  profileName: {
    color: '#10203B',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  profileCompany: {
    lineHeight: 18,
  },
  planBadge: {
    borderRadius: 999,
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  planBadgeText: {
    color: Accent.primary,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
    ...Shadows.card,
  },
  sectionTitle: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  sectionBody: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  notificationTestCard: {
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3FA',
  },
  notificationTestCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3FA',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
  },
  menuCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  menuTitle: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 20,
  },
  menuSubtitle: {
    lineHeight: 16,
  },
  logoutButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: Spacing.one,
    ...Shadows.soft,
  },
  logoutText: {
    color: Accent.primary,
  },
});
