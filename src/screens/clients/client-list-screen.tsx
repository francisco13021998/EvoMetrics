import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPayment, Revision } from '@/types/domain';
import { formatClientAge } from '@/utils/client-age';
import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';

type ClientListItem = {
  client: Client;
  payments: ClientPayment[];
  revisions: Revision[];
};

type ClientStatus = {
  label: string;
  tone: 'active' | 'revision' | 'pending' | 'inactive';
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function formatSexLabel(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return 'Sin sexo';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getClientStatus(client: Client, payments: ClientPayment[], revisions: Revision[], referenceDate = new Date()): ClientStatus {
  if (client.estado === 'baja') {
    return { label: 'Baja', tone: 'inactive' };
  }

  const paymentStatus = calculateClientPaymentStatus(client, payments, referenceDate);
  const revisionStatus = calculateClientRevisionStatus(client, revisions, referenceDate);
  const today = startOfDay(referenceDate);

  if (revisionStatus.nextRevisionDate) {
    const revisionDate = startOfDay(revisionStatus.nextRevisionDate);

    if (revisionDate.getTime() === today.getTime()) {
      return { label: 'Revisión hoy', tone: 'revision' };
    }
  }

  if (paymentStatus.nextPaymentDate) {
    const paymentDate = startOfDay(paymentStatus.nextPaymentDate);

    if (paymentDate.getTime() === today.getTime()) {
      return { label: 'Pago hoy', tone: 'pending' };
    }
  }

  if (paymentStatus.isPending || revisionStatus.isPending) {
    return { label: 'Pendiente', tone: 'pending' };
  }

  return { label: 'Activo', tone: 'active' };
}

function getStatusStyles(tone: ClientStatus['tone']) {
  if (tone === 'revision') {
    return {
      backgroundColor: '#EAF1FF',
      textColor: '#2F61D5',
      borderColor: '#D8E5FF',
    };
  }

  if (tone === 'pending') {
    return {
      backgroundColor: '#F3F4F6',
      textColor: '#5A6273',
      borderColor: '#E7EAF0',
    };
  }

  if (tone === 'inactive') {
    return {
      backgroundColor: '#F3F4F6',
      textColor: '#6B7280',
      borderColor: '#E5E7EB',
    };
  }

  return {
    backgroundColor: '#EAF8EF',
    textColor: '#2C7A3F',
    borderColor: '#D5F0DD',
  };
}

export function ClientListScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadClients = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const nextClients = await clientsService.listByOwner(user.id);
      const nextItems = await Promise.all(
        nextClients.map(async (client) => ({
          client,
          payments: await clientPaymentsService.listByClient(client.id),
          revisions: await revisionsService.listByClient(client.id),
        }))
      );

      setItems(nextItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los clientes.';
      Alert.alert('Error', message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients])
  );

  const filteredItems = items.filter(({ client }) => {
    const normalizedQuery = query.trim().toLowerCase();

    return !normalizedQuery || client.name.toLowerCase().includes(normalizedQuery);
  });

  const sortedItems = [...filteredItems].sort((left, right) => {
    const leftIsInactive = left.client.estado === 'baja';
    const rightIsInactive = right.client.estado === 'baja';

    if (leftIsInactive !== rightIsInactive) {
      return leftIsInactive ? 1 : -1;
    }

    const leftName = left.client.name.toLowerCase();
    const rightName = right.client.name.toLowerCase();

    return leftName.localeCompare(rightName, 'es-ES');
  });

  function goToClient(clientId: string) {
    router.push(`/clients/${clientId}`);
  }

  function goToNewClient() {
    router.push('/clients/new');
  }

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.title}>Clientes</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Gestión y seguimiento
          </ThemedText>
        </View>
        <Pressable onPress={goToNewClient} style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.9 : 1 }]} accessibilityLabel="Añadir cliente">
          <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.searchShell}>
        <Ionicons name="search" size={22} color="#8A93A8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar cliente"
          placeholderTextColor="#A1A9BC"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.listCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {isLoading ? (
            <View style={styles.emptyState}>
              <ThemedText type="small" themeColor="textSecondary">
                Cargando clientes...
              </ThemedText>
            </View>
          ) : sortedItems.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="smallBold" style={styles.emptyTitle}>
                No hay clientes para mostrar
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Prueba con otra búsqueda o cambia el filtro.
              </ThemedText>
            </View>
          ) : (
            sortedItems.map(({ client, payments, revisions }, index) => {
              const status = getClientStatus(client, payments, revisions);
              const statusStyle = getStatusStyles(status.tone);
              const ageText = formatClientAge(client);
              const ageLabel = ageText === '-' ? 'Edad no disponible' : ageText;
              const meta = `${formatSexLabel(client.sex)} · ${ageLabel} · ${client.heightCm ?? '—'} cm`;

              return (
                <Pressable
                  key={client.id}
                  onPress={() => goToClient(client.id)}
                  style={({ pressed }) => [
                    styles.row,
                      index !== sortedItems.length - 1 && styles.rowSpacing,
                    { backgroundColor: '#F9FBFF' },
                    { opacity: pressed ? 0.92 : 1 },
                  ]}>
                  <View style={styles.avatar}>
                    <ThemedText type="smallBold" style={styles.avatarText}>
                      {getInitials(client.name) || client.name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>

                  <View style={styles.rowCopy}>
                    <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
                      {client.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {meta}
                    </ThemedText>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor, borderColor: statusStyle.borderColor }]}>
                    <ThemedText type="smallBold" style={[styles.statusText, { color: statusStyle.textColor }]}>
                      {status.label}
                    </ThemedText>
                  </View>

                  <Pressable onPress={() => goToClient(client.id)} hitSlop={10} style={styles.rowLink}>
                    <ThemedText type="smallBold" style={styles.rowLinkText}>
                      Ver
                    </ThemedText>
                    <Ionicons name="chevron-forward" size={18} color={Accent.primary} />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#10203B',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    lineHeight: 18,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10203B',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D7E4F7',
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    color: '#10203B',
    fontSize: 16,
    paddingVertical: 0,
  },
  listCard: {
    marginTop: 16,
    flex: 1,
  },
  listContent: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
  },
  rowSpacing: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E9EEFA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: Accent.primary,
    fontSize: 18,
    lineHeight: 20,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: '#0E1F39',
    fontSize: 17,
    lineHeight: 21,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 13,
    lineHeight: 16,
  },
  rowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  rowLinkText: {
    color: Accent.primary,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#10203B',
  },
});