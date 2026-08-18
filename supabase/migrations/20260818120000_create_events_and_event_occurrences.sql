create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text,
  location text,
  kind text not null default 'meeting' check (kind in ('call', 'meeting', 'visit', 'training', 'other')),
  start_date date not null,
  start_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  timezone text not null default 'UTC',
  all_day boolean not null default false,
  recurrence_enabled boolean not null default false,
  recurrence_frequency text check (recurrence_frequency in ('daily', 'weekly', 'monthly')),
  recurrence_interval integer check (recurrence_interval > 0),
  recurrence_weekdays smallint[] check (
    recurrence_weekdays is null
    or recurrence_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  recurrence_month_day smallint check (recurrence_month_day between 1 and 31),
  recurrence_end_type text check (recurrence_end_type in ('never', 'until', 'count')),
  recurrence_end_date date,
  recurrence_count integer check (recurrence_count > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  planned_start_at timestamptz not null,
  planned_end_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  completed_at timestamptz,
  cancelled_at timestamptz,
  rescheduled_from_occurrence_id uuid references public.event_occurrences(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_owner_id_start_date_idx
  on public.events (owner_id, start_date, start_time);

create index if not exists events_client_id_start_date_idx
  on public.events (client_id, start_date, start_time);

create index if not exists event_occurrences_event_id_planned_start_at_idx
  on public.event_occurrences (event_id, planned_start_at desc);

create index if not exists event_occurrences_owner_id_planned_start_at_idx
  on public.event_occurrences (owner_id, planned_start_at desc);

create index if not exists event_occurrences_status_planned_start_at_idx
  on public.event_occurrences (status, planned_start_at desc);

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

drop trigger if exists set_event_occurrences_updated_at on public.event_occurrences;
create trigger set_event_occurrences_updated_at
before update on public.event_occurrences
for each row
execute function public.set_updated_at();

comment on table public.events is 'Definicion base de eventos y sus reglas de recurrencia.';
comment on column public.events.kind is 'Tipo funcional del evento: llamada, reunion, visita, entrenamiento u otro.';
comment on column public.events.start_date is 'Fecha local de inicio del evento base o de la serie.';
comment on column public.events.start_time is 'Hora local de inicio del evento base o de la serie.';
comment on column public.events.duration_minutes is 'Duracion en minutos del evento base para generar instancias.';
comment on column public.events.recurrence_frequency is 'Frecuencia base de la recurrencia cuando el evento se repite.';
comment on column public.events.recurrence_interval is 'Cada cuantas unidades se repite el evento.';
comment on column public.events.recurrence_weekdays is 'Dias de la semana permitidos para recurrencia semanal; usa 0 para domingo y 6 para sabado.';
comment on column public.events.recurrence_month_day is 'Dia del mes para recurrencia mensual fija.';
comment on column public.events.recurrence_end_type is 'Como finaliza la serie: nunca, hasta una fecha o por cantidad de instancias.';
comment on column public.events.recurrence_end_date is 'Fecha local en la que termina la serie cuando recurrence_end_type = until.';
comment on column public.events.recurrence_count is 'Cantidad total de instancias cuando recurrence_end_type = count.';

comment on table public.event_occurrences is 'Instancias concretas generadas a partir de un evento base.';
comment on column public.event_occurrences.planned_start_at is 'Inicio programado de la instancia concreta.';
comment on column public.event_occurrences.planned_end_at is 'Fin programado de la instancia concreta.';
comment on column public.event_occurrences.status is 'Estado concreto de la instancia: programada, completada, cancelada o reprogramada.';
comment on column public.event_occurrences.rescheduled_from_occurrence_id is 'Referencia a la instancia anterior cuando esta ocurrencia nace por reprogramacion.';