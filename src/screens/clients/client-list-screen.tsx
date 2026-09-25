import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { AppSelect } from '@/components/forms/app-select';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius } from '@/constants/theme';
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
  tone: 'active' | 'revision' | 'payment' | 'inactive';
};

type ClientFilter = 'all' | 'active' | 'attention' | 'inactive';

const CLIENTS_PER_PAGE = 5;

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

  const pendingCandidates: { kind: 'payment' | 'revision'; date: Date }[] = [];

  if (paymentStatus.isPending && paymentStatus.nextPaymentDate) {
    pendingCandidates.push({ kind: 'payment', date: startOfDay(paymentStatus.nextPaymentDate) });
  }

  if (revisionStatus.isPending && revisionStatus.nextRevisionDate) {
    pendingCandidates.push({ kind: 'revision', date: startOfDay(revisionStatus.nextRevisionDate) });
  }

  if (pendingCandidates.length > 0) {
    pendingCandidates.sort((left, right) => left.date.getTime() - right.date.getTime());
    const selected = pendingCandidates[0];
    const isToday = selected.date.getTime() === today.getTime();

    if (selected.kind === 'payment') {
      return { label: isToday ? 'Pago hoy' : 'Pago pendiente', tone: 'payment' };
    }

    return { label: 'Revisión pendiente', tone: 'revision' };
  }

  return { label: 'Activo', tone: 'active' };
}

function getStatusStyles(tone: ClientStatus['tone']) {
  if (tone === 'payment') {
    return {
      backgroundColor: '#FFF1F2',
      textColor: '#B4233C',
      borderColor: '#FFD2D9',
    };
  }

  if (tone === 'revision') {
    return {
      backgroundColor: '#FFF7ED',
      textColor: '#9A3412',
      borderColor: '#FED7AA',
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
    backgroundColor: '#ECFDF5',
    textColor: '#14734C',
    borderColor: '#C7EFDC',
  };
}

export function ClientListScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

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
      setLoadError(message);
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

  const clientsWithStatus = useMemo(
    () => items.map((item) => ({ ...item, status: getClientStatus(item.client, item.payments, item.revisions) })),
    [items]
  );
  const activeCount = clientsWithStatus.filter(({ client }) => client.estado === 'activo').length;
  const attentionCount = clientsWithStatus.filter(({ status }) => status.tone === 'payment' || status.tone === 'revision').length;
  const inactiveCount = clientsWithStatus.filter(({ client }) => client.estado === 'baja').length;
  const sortedItems = clientsWithStatus.filter(({ client, status }) => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-ES');
    const matchesQuery = !normalizedQuery || client.name.toLocaleLowerCase('es-ES').includes(normalizedQuery);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && client.estado === 'activo') ||
      (filter === 'attention' && (status.tone === 'payment' || status.tone === 'revision')) ||
      (filter === 'inactive' && client.estado === 'baja');

    return matchesQuery && matchesFilter;
  }).sort((left, right) => {
    const leftIsInactive = left.client.estado === 'baja';
    const rightIsInactive = right.client.estado === 'baja';

    if (leftIsInactive !== rightIsInactive) {
      return leftIsInactive ? 1 : -1;
    }

    const leftName = left.client.name.toLowerCase();
    const rightName = right.client.name.toLowerCase();

    return leftName.localeCompare(rightName, 'es-ES');
  });
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / CLIENTS_PER_PAGE));
  const pageStart = (currentPage - 1) * CLIENTS_PER_PAGE;
  const paginatedItems = sortedItems.slice(pageStart, pageStart + CLIENTS_PER_PAGE);
  const pageEnd = Math.min(pageStart + paginatedItems.length, sortedItems.length);
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function goToClient(clientId: string) {
    router.push(`/clients/${clientId}`);
  }

  function goToNewClient() {
    router.push('/clients/new');
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={25} color={Accent.primary} />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.title}>Clientes</ThemedText>
          </View>
          <Pressable
            onPress={goToNewClient}
            accessibilityRole="button"
            accessibilityLabel="Añadir cliente"
            hitSlop={8}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="person-add-outline" size={23} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.summaryRow}>
          <View accessible accessibilityLabel={`${activeCount} clientes activos`} style={styles.summaryItem}>
            <View style={[styles.summaryDot, styles.summaryDotActive]} />
            <ThemedText type="smallBold" style={styles.summaryText}>{activeCount} activos</ThemedText>
          </View>
          <View accessible accessibilityLabel={`${attentionCount} clientes requieren atención`} style={styles.summaryItem}>
            <View style={[styles.summaryDot, styles.summaryDotAttention]} />
            <ThemedText type="smallBold" style={styles.summaryText}>{attentionCount} pendientes</ThemedText>
          </View>
          <View accessible accessibilityLabel={`${inactiveCount} clientes de baja`} style={styles.summaryItem}>
            <View style={[styles.summaryDot, styles.summaryDotInactive]} />
            <ThemedText type="smallBold" style={styles.summaryText}>{inactiveCount} de baja</ThemedText>
          </View>
        </View>
      </View>

      {loadError ? (
        <View style={styles.errorBlock}>
          <StatusBanner tone="danger" title="No se pudo actualizar" message={loadError} />
          <Pressable
            onPress={() => void loadClients()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.retryText}>Reintentar</ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.toolsCard}>
        <View style={styles.sectionHeading}>
          <ThemedText type="small" themeColor="textSecondary">
            {sortedItems.length} {sortedItems.length === 1 ? 'resultado' : 'resultados'}
          </ThemedText>
        </View>
        <View style={styles.toolsRow}>
          <View style={styles.searchShell}>
            <Ionicons name="search" size={19} color="#64748B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Buscar cliente por nombre"
              placeholder="Buscar"
              placeholderTextColor="#8390A7"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Borrar búsqueda"
                hitSlop={8}
                style={styles.clearSearchButton}>
                <Ionicons name="close-circle" size={20} color="#78859B" />
              </Pressable>
            ) : null}
          </View>

          <AppSelect
            label="Estado"
            value={filter}
            onChange={(value) => setFilter(value as ClientFilter)}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'active', label: 'Activos' },
              { value: 'attention', label: 'Pendientes' },
              { value: 'inactive', label: 'Baja' },
            ]}
            hideLabel
            containerStyle={styles.filterSelect}
            pickerTextStyle={styles.filterSelectText}
          />
        </View>
      </View>

      <View style={styles.listSection}>
        {isLoading ? (
          <View accessibilityLiveRegion="polite" style={styles.emptyState}>
            <ActivityIndicator size="small" color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.emptyTitle}>Actualizando clientes</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Estamos preparando el directorio.</ThemedText>
          </View>
        ) : sortedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name={query ? 'search-outline' : 'people-outline'} size={28} color={Accent.primary} />
            </View>
            <ThemedText style={styles.emptyTitle}>No hay clientes para mostrar</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyDescription}>
              {query ? 'Prueba con otro nombre o borra la búsqueda.' : 'Cambia el filtro o añade tu primer cliente.'}
            </ThemedText>
            {!query && items.length === 0 ? (
              <Pressable
                onPress={goToNewClient}
                accessibilityRole="button"
                style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
                <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                <ThemedText type="smallBold" style={styles.emptyActionText}>Añadir cliente</ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.clientListCard}>
            {paginatedItems.map(({ client, status }, index) => {
              const statusStyle = getStatusStyles(status.tone);
              const ageText = formatClientAge(client);
              const ageLabel = ageText === '-' ? 'Edad no disponible' : ageText;
              const meta = `${formatSexLabel(client.sex)} · ${ageLabel} · ${client.heightCm ?? '—'} cm`;
              const isLastRow = index === paginatedItems.length - 1;

              return (
                <Pressable
                  key={client.id}
                  onPress={() => goToClient(client.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${client.name}. ${meta}. Estado: ${status.label}`}
                  style={({ pressed }) => [
                    styles.row,
                    !isLastRow && styles.rowDivider,
                    pressed && styles.rowPressed,
                  ]}>
                  <View style={styles.avatar}>
                    <ThemedText type="smallBold" style={styles.avatarText}>
                      {getInitials(client.name) || client.name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>

                  <View style={styles.rowContent}>
                    <View style={styles.rowMainLine}>
                      <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
                        {client.name}
                      </ThemedText>
                      <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor, borderColor: statusStyle.borderColor }]}>
                        <ThemedText type="smallBold" style={[styles.statusText, { color: statusStyle.textColor }]} numberOfLines={1}>
                          {status.label}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{meta}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8794A9" />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {!isLoading && sortedItems.length > CLIENTS_PER_PAGE ? (
        <View style={styles.pagination} accessibilityLabel={`Página ${currentPage} de ${totalPages}`}>
          <Pressable
            onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={!canGoBack}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
            accessibilityState={{ disabled: !canGoBack }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.paginationButton,
              !canGoBack && styles.paginationButtonDisabled,
              pressed && canGoBack && styles.pressed,
            ]}>
            <Ionicons name="chevron-back" size={19} color={canGoBack ? Accent.primary : '#9AA5B5'} />
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.paginationText}>
            {pageStart + 1}-{pageEnd} de {sortedItems.length}
          </ThemedText>

          <Pressable
            onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={!canGoForward}
            accessibilityRole="button"
            accessibilityLabel="Página siguiente"
            accessibilityState={{ disabled: !canGoForward }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.paginationButton,
              !canGoForward && styles.paginationButtonDisabled,
              pressed && canGoForward && styles.pressed,
            ]}>
            <Ionicons name="chevron-forward" size={19} color={canGoForward ? Accent.primary : '#9AA5B5'} />
          </Pressable>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  heroPanel: {
    paddingHorizontal: 4,
    paddingTop: 6,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
    borderColor: '#D2E0FA',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#10203B',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryDotActive: {
    backgroundColor: '#1FA971',
  },
  summaryDotAttention: {
    backgroundColor: '#E29922',
  },
  summaryDotInactive: {
    backgroundColor: '#94A0B2',
  },
  summaryText: {
    color: '#485870',
    fontSize: 12,
    lineHeight: 16,
  },
  errorBlock: {
    gap: 8,
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4F6',
  },
  retryText: {
    color: Accent.primary,
  },
  toolsCard: {
    gap: 10,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 12,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E3F1',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#10203B',
    fontSize: 15,
    minHeight: 44,
    paddingVertical: 8,
  },
  clearSearchButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSelect: {
    width: 134,
    height: 48,
    borderColor: '#D9E3F1',
    backgroundColor: '#F8FAFD',
    borderRadius: 14,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  filterSelectText: {
    color: '#223653',
    backgroundColor: '#F8FAFD',
    fontSize: 13,
    height: 48,
    marginHorizontal: 0,
  },
  listSection: {
    gap: 0,
  },
  clientListCard: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
  },
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF5',
  },
  rowPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.993 }],
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#D3E1FA',
  },
  avatarText: {
    color: Accent.primary,
    fontSize: 18,
    lineHeight: 20,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  rowMainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: '#0E1F39',
    fontSize: 16,
    lineHeight: 21,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 10,
    lineHeight: 13,
  },
  emptyState: {
    minHeight: 240,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  emptyTitle: {
    color: '#10203B',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyAction: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  emptyActionText: {
    color: '#FFFFFF',
  },
  pagination: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: -2,
  },
  paginationButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E4F6',
    backgroundColor: '#FFFFFF',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F6F8FB',
    borderColor: '#E4EAF2',
  },
  paginationText: {
    minWidth: 76,
    textAlign: 'center',
  },
});
