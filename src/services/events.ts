import { supabase } from '@/lib/supabase';
import {
    Event,
    EventKind,
    EventOccurrence,
    EventOccurrenceStatus,
    EventRecurrenceEndType,
    EventRecurrenceFrequency,
} from '@/types/domain';
import { generateEventOccurrenceDrafts } from '@/utils/events';

export const EVENTS_TABLE = 'events';
export const EVENT_OCCURRENCES_TABLE = 'event_occurrences';

type DbEventRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  kind: EventKind;
  start_date: string;
  start_time: string;
  duration_minutes: number;
  timezone: string;
  all_day: boolean;
  recurrence_enabled: boolean;
  recurrence_frequency: EventRecurrenceFrequency | null;
  recurrence_interval: number | null;
  recurrence_weekdays: number[] | null;
  recurrence_month_day: number | null;
  recurrence_end_type: EventRecurrenceEndType | null;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbEventOccurrenceRow = {
  id: string;
  event_id: string;
  owner_id: string;
  client_id: string | null;
  planned_start_at: string;
  planned_end_at: string;
  status: EventOccurrenceStatus;
  completed_at: string | null;
  cancelled_at: string | null;
  rescheduled_from_occurrence_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateEventInput = {
  ownerId: string;
  clientId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  kind?: EventKind;
  startDate: string;
  startTime: string;
  durationMinutes?: number;
  timezone?: string;
  allDay?: boolean;
  recurrenceEnabled?: boolean;
  recurrenceFrequency?: EventRecurrenceFrequency | null;
  recurrenceInterval?: number | null;
  recurrenceWeekdays?: number[] | null;
  recurrenceMonthDay?: number | null;
  recurrenceEndType?: EventRecurrenceEndType | null;
  recurrenceEndDate?: string | null;
  recurrenceCount?: number | null;
  isActive?: boolean;
};

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'ownerId'>>;

export type CreateEventOccurrenceInput = {
  eventId: string;
  ownerId: string;
  clientId?: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  status?: EventOccurrenceStatus;
  notes?: string | null;
  rescheduledFromOccurrenceId?: string | null;
};

export type RescheduleEventOccurrenceInput = {
  plannedStartAt: string;
  plannedEndAt: string;
  notes?: string | null;
};

export type SyncEventOccurrencesRangeInput = {
  rangeStart: Date;
  rangeEnd: Date;
};

function mapDbEvent(row: DbEventRow): Event {
  return {
    id: row.id,
    ownerId: row.owner_id,
    clientId: row.client_id,
    title: row.title,
    description: row.description,
    location: row.location,
    kind: row.kind,
    startDate: row.start_date,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    allDay: row.all_day,
    recurrenceEnabled: row.recurrence_enabled,
    recurrenceFrequency: row.recurrence_frequency,
    recurrenceInterval: row.recurrence_interval,
    recurrenceWeekdays: row.recurrence_weekdays,
    recurrenceMonthDay: row.recurrence_month_day,
    recurrenceEndType: row.recurrence_end_type,
    recurrenceEndDate: row.recurrence_end_date,
    recurrenceCount: row.recurrence_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbEventOccurrence(row: DbEventOccurrenceRow): EventOccurrence {
  return {
    id: row.id,
    eventId: row.event_id,
    ownerId: row.owner_id,
    clientId: row.client_id,
    plannedStartAt: row.planned_start_at,
    plannedEndAt: row.planned_end_at,
    status: row.status,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    rescheduledFromOccurrenceId: row.rescheduled_from_occurrence_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toNullableString(value: string | null | undefined) {
  return value ?? null;
}

function buildCreateEventPayload(payload: CreateEventInput) {
  return {
    owner_id: payload.ownerId,
    client_id: payload.clientId ?? null,
    title: payload.title,
    description: toNullableString(payload.description),
    location: toNullableString(payload.location),
    kind: payload.kind ?? 'meeting',
    start_date: payload.startDate,
    start_time: payload.startTime,
    duration_minutes: payload.durationMinutes ?? 60,
    timezone: payload.timezone ?? 'UTC',
    all_day: payload.allDay ?? false,
    recurrence_enabled: payload.recurrenceEnabled ?? false,
    recurrence_frequency: payload.recurrenceFrequency ?? null,
    recurrence_interval: payload.recurrenceInterval ?? null,
    recurrence_weekdays: payload.recurrenceWeekdays ?? null,
    recurrence_month_day: payload.recurrenceMonthDay ?? null,
    recurrence_end_type: payload.recurrenceEndType ?? null,
    recurrence_end_date: payload.recurrenceEndDate ?? null,
    recurrence_count: payload.recurrenceCount ?? null,
    is_active: payload.isActive ?? true,
  };
}

function buildUpdateEventPayload(payload: UpdateEventInput) {
  return {
    ...(payload.clientId !== undefined ? { client_id: payload.clientId } : {}),
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.location !== undefined ? { location: payload.location } : {}),
    ...(payload.kind !== undefined ? { kind: payload.kind } : {}),
    ...(payload.startDate !== undefined ? { start_date: payload.startDate } : {}),
    ...(payload.startTime !== undefined ? { start_time: payload.startTime } : {}),
    ...(payload.durationMinutes !== undefined ? { duration_minutes: payload.durationMinutes } : {}),
    ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
    ...(payload.allDay !== undefined ? { all_day: payload.allDay } : {}),
    ...(payload.recurrenceEnabled !== undefined ? { recurrence_enabled: payload.recurrenceEnabled } : {}),
    ...(payload.recurrenceFrequency !== undefined ? { recurrence_frequency: payload.recurrenceFrequency } : {}),
    ...(payload.recurrenceInterval !== undefined ? { recurrence_interval: payload.recurrenceInterval } : {}),
    ...(payload.recurrenceWeekdays !== undefined ? { recurrence_weekdays: payload.recurrenceWeekdays } : {}),
    ...(payload.recurrenceMonthDay !== undefined ? { recurrence_month_day: payload.recurrenceMonthDay } : {}),
    ...(payload.recurrenceEndType !== undefined ? { recurrence_end_type: payload.recurrenceEndType } : {}),
    ...(payload.recurrenceEndDate !== undefined ? { recurrence_end_date: payload.recurrenceEndDate } : {}),
    ...(payload.recurrenceCount !== undefined ? { recurrence_count: payload.recurrenceCount } : {}),
    ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
  };
}

function buildCreateOccurrencePayload(payload: CreateEventOccurrenceInput) {
  return {
    event_id: payload.eventId,
    owner_id: payload.ownerId,
    client_id: payload.clientId ?? null,
    planned_start_at: payload.plannedStartAt,
    planned_end_at: payload.plannedEndAt,
    status: payload.status ?? 'scheduled',
    notes: payload.notes ?? null,
    rescheduled_from_occurrence_id: payload.rescheduledFromOccurrenceId ?? null,
  };
}

function buildUpdateOccurrencePayload(payload: Partial<CreateEventOccurrenceInput> & { completedAt?: string | null; cancelledAt?: string | null }) {
  return {
    ...(payload.clientId !== undefined ? { client_id: payload.clientId } : {}),
    ...(payload.plannedStartAt !== undefined ? { planned_start_at: payload.plannedStartAt } : {}),
    ...(payload.plannedEndAt !== undefined ? { planned_end_at: payload.plannedEndAt } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload.rescheduledFromOccurrenceId !== undefined ? { rescheduled_from_occurrence_id: payload.rescheduledFromOccurrenceId } : {}),
    ...(payload.completedAt !== undefined ? { completed_at: payload.completedAt } : {}),
    ...(payload.cancelledAt !== undefined ? { cancelled_at: payload.cancelledAt } : {}),
  };
}

export const eventsService = {
  async listByOwner(ownerId: string) {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbEventRow[] | null)?.map(mapDbEvent) ?? [];
  },

  async getById(eventId: string, ownerId: string) {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select('*')
      .eq('id', eventId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapDbEvent(data as DbEventRow) : null;
  },

  async create(payload: CreateEventInput) {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .insert(buildCreateEventPayload(payload))
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEvent(data as DbEventRow);
  },

  async update(eventId: string, ownerId: string, payload: UpdateEventInput) {
    const updatePayload = buildUpdateEventPayload(payload);

    if (Object.keys(updatePayload).length === 0) {
      throw new Error('No se proporcionaron cambios para actualizar el evento.');
    }

    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .update(updatePayload)
      .eq('id', eventId)
      .eq('owner_id', ownerId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEvent(data as DbEventRow);
  },

  async remove(eventId: string, ownerId: string) {
    const { error } = await supabase.from(EVENTS_TABLE).delete().eq('id', eventId).eq('owner_id', ownerId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async listOccurrencesByEvent(eventId: string) {
    const { data, error } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .select('*')
      .eq('event_id', eventId)
      .order('planned_start_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbEventOccurrenceRow[] | null)?.map(mapDbEventOccurrence) ?? [];
  },

  async getOccurrenceById(occurrenceId: string, ownerId: string) {
    const { data, error } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .select('*')
      .eq('id', occurrenceId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapDbEventOccurrence(data as DbEventOccurrenceRow) : null;
  },

  async listOccurrencesByOwner(ownerId: string, rangeStart?: string, rangeEnd?: string) {
    let query = supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('planned_start_at', { ascending: true });

    if (rangeStart) {
      query = query.gte('planned_start_at', rangeStart);
    }

    if (rangeEnd) {
      query = query.lte('planned_start_at', rangeEnd);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbEventOccurrenceRow[] | null)?.map(mapDbEventOccurrence) ?? [];
  },

  async createOccurrence(payload: CreateEventOccurrenceInput) {
    const { data, error } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .insert(buildCreateOccurrencePayload(payload))
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEventOccurrence(data as DbEventOccurrenceRow);
  },

  async completeOccurrence(occurrenceId: string, ownerId: string, completedAt = new Date().toISOString()) {
    const { data, error } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .update(
        buildUpdateOccurrencePayload({
          status: 'completed',
          completedAt,
          cancelledAt: null,
        })
      )
      .eq('id', occurrenceId)
      .eq('owner_id', ownerId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEventOccurrence(data as DbEventOccurrenceRow);
  },

  async cancelOccurrence(occurrenceId: string, ownerId: string, cancelledAt = new Date().toISOString(), notes?: string | null) {
    const { data, error } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .update(
        buildUpdateOccurrencePayload({
          status: 'cancelled',
          cancelledAt,
          completedAt: null,
          notes,
        })
      )
      .eq('id', occurrenceId)
      .eq('owner_id', ownerId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbEventOccurrence(data as DbEventOccurrenceRow);
  },

  async rescheduleOccurrence(
    occurrenceId: string,
    ownerId: string,
    payload: RescheduleEventOccurrenceInput
  ) {
    const existingOccurrenceResult = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .select('*')
      .eq('id', occurrenceId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (existingOccurrenceResult.error) {
      throw new Error(existingOccurrenceResult.error.message);
    }

    if (!existingOccurrenceResult.data) {
      throw new Error('No se encontró la instancia a reprogramar.');
    }

    const existingOccurrence = existingOccurrenceResult.data as DbEventOccurrenceRow;

    const updateResult = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .update(
        buildUpdateOccurrencePayload({
          status: 'rescheduled',
          completedAt: null,
          cancelledAt: null,
          notes: payload.notes ?? existingOccurrence.notes,
        })
      )
      .eq('id', occurrenceId)
      .eq('owner_id', ownerId)
      .select('*')
      .single();

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    const insertResult = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .insert(
        buildCreateOccurrencePayload({
          eventId: existingOccurrence.event_id,
          ownerId: existingOccurrence.owner_id,
          clientId: existingOccurrence.client_id,
          plannedStartAt: payload.plannedStartAt,
          plannedEndAt: payload.plannedEndAt,
          status: 'scheduled',
          notes: payload.notes ?? existingOccurrence.notes,
          rescheduledFromOccurrenceId: existingOccurrence.id,
        })
      )
      .select('*')
      .single();

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    return {
      previous: mapDbEventOccurrence(updateResult.data as DbEventOccurrenceRow),
      next: mapDbEventOccurrence(insertResult.data as DbEventOccurrenceRow),
    };
  },

  async syncOccurrencesForEvent(eventId: string, ownerId: string, rangeStart: Date, rangeEnd: Date) {
    const event = await this.getById(eventId, ownerId);

    if (!event) {
      throw new Error('No se encontró el evento.');
    }

    const drafts = generateEventOccurrenceDrafts(event, rangeStart, rangeEnd);

    if (drafts.length === 0) {
      return [] as EventOccurrence[];
    }

    const { data: existingRows, error: existingError } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .select('planned_start_at')
      .eq('event_id', eventId)
      .gte('planned_start_at', rangeStart.toISOString())
      .lte('planned_start_at', rangeEnd.toISOString());

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingStartSet = new Set((existingRows as { planned_start_at: string }[] | null)?.map((row) => row.planned_start_at) ?? []);
    const missingDrafts = drafts.filter((draft) => !existingStartSet.has(draft.plannedStartAt));

    if (missingDrafts.length === 0) {
      return [] as EventOccurrence[];
    }

    const { data, error } = await supabase
      .from(EVENT_OCCURRENCES_TABLE)
      .insert(missingDrafts.map(buildCreateOccurrencePayload))
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbEventOccurrenceRow[] | null)?.map(mapDbEventOccurrence) ?? [];
  },

  async syncOccurrencesForOwner(ownerId: string, rangeStart: Date, rangeEnd: Date) {
    const events = await this.listByOwner(ownerId);

    await Promise.all(events.map((event) => this.syncOccurrencesForEvent(event.id, ownerId, rangeStart, rangeEnd)));

    return this.listOccurrencesByOwner(ownerId, rangeStart.toISOString(), rangeEnd.toISOString());
  },
};