-- Reprogramación atómica de ocurrencias.
--
-- Contexto: eventsService.rescheduleOccurrence hace hoy dos operaciones separadas (update a
-- 'rescheduled' + insert de la sucesora): si el insert falla, la original queda 'rescheduled'
-- sin sucesora. Este RPC lo hace en una única transacción.
--
-- Tras aplicarlo, cambiar src/services/events.ts:rescheduleOccurrence para llamar a
-- supabase.rpc('reschedule_event_occurrence', ...) y mapear las dos filas devueltas.

create or replace function public.reschedule_event_occurrence(
  p_owner_id uuid,
  p_occurrence_id uuid,
  p_new_planned_start_at timestamptz,
  p_new_planned_end_at timestamptz,
  p_notes text default null
)
returns setof public.event_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  original_occurrence public.event_occurrences;
  next_occurrence public.event_occurrences;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_owner_id is distinct from auth.uid() then
    raise exception 'owner_id does not match authenticated user';
  end if;

  if p_new_planned_end_at <= p_new_planned_start_at then
    raise exception 'planned_end_at must be after planned_start_at';
  end if;

  update public.event_occurrences
  set status = 'rescheduled',
      notes = coalesce(p_notes, notes)
  where id = p_occurrence_id
    and owner_id = p_owner_id
    and status = 'scheduled'
  returning * into original_occurrence;

  if original_occurrence.id is null then
    raise exception 'Occurrence not found, not owned by user, or not in scheduled status';
  end if;

  insert into public.event_occurrences (
    event_id,
    owner_id,
    client_id,
    planned_start_at,
    planned_end_at,
    status,
    rescheduled_from_occurrence_id
  )
  values (
    original_occurrence.event_id,
    original_occurrence.owner_id,
    original_occurrence.client_id,
    p_new_planned_start_at,
    p_new_planned_end_at,
    'scheduled',
    original_occurrence.id
  )
  returning * into next_occurrence;

  return next original_occurrence;
  return next next_occurrence;
end;
$$;

grant execute on function public.reschedule_event_occurrence(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
