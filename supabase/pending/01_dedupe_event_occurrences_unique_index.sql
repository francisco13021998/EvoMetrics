-- Limpieza de ocurrencias duplicadas + unique index.
--
-- Contexto: hasta el fix del cliente, la deduplicación de syncOccurrencesForEvent comparaba
-- timestamps por string en formatos incompatibles ('+00:00' vs '.000Z'), así que cada sync
-- reinsertaba las ocurrencias. La BD puede contener muchos duplicados por (event_id, planned_start_at).
--
-- ANTES DE APLICAR: ejecutar el SELECT de diagnóstico y revisar qué se va a borrar.
--
-- select event_id, planned_start_at, count(*), array_agg(status order by created_at)
-- from public.event_occurrences
-- group by event_id, planned_start_at
-- having count(*) > 1
-- order by count(*) desc;

begin;

-- Se conserva UNA fila por (event_id, planned_start_at):
--   1º preferencia: una fila sobre la que el usuario actuó (completed/cancelled/rescheduled)
--   2º criterio: la más antigua.
-- Las referencias rescheduled_from_occurrence_id a filas borradas quedan en null (FK on delete set null).
delete from public.event_occurrences
where id not in (
  select distinct on (event_id, planned_start_at) id
  from public.event_occurrences
  order by
    event_id,
    planned_start_at,
    (status = 'scheduled') asc, -- false (= estado con acción del usuario) primero
    created_at asc
);

-- A partir de aquí la deduplicación es atómica también frente a syncs concurrentes.
create unique index if not exists event_occurrences_event_id_planned_start_at_unique
  on public.event_occurrences (event_id, planned_start_at);

commit;

-- Opcional (mejora futura del cliente): con este índice, el insert de ocurrencias puede usar
-- ON CONFLICT (event_id, planned_start_at) DO NOTHING y eliminar el SELECT previo de dedupe.
