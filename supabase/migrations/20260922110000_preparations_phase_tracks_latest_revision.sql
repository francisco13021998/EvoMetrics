-- El campo preparations.phase se fijaba una sola vez, con la fase de la revisión que abrió la
-- preparación — que por definición siempre es "Inicio" (es la señal que la abre). Eso hacía que
-- toda preparación mostrara "Inicio" aunque el cliente ya llevara varias revisiones en Definición,
-- Volumen, etc. Ahora se mantiene sincronizado con la fase de la revisión más reciente que se le
-- añade, para reflejar en qué fase está realmente la preparación ahora mismo.

create or replace function public.assign_revision_preparation()
returns trigger
language plpgsql
as $$
declare
  v_open_id uuid;
  v_last_revision date;
begin
  if new.preparation_id is not null then
    return new;
  end if;

  select id into v_open_id
  from public.preparations
  where client_id = new.client_id and end_date is null
  order by start_date desc
  limit 1;

  if v_open_id is not null and lower(trim(coalesce(new.phase, ''))) = 'inicio' then
    select max(reviewed_at)::date into v_last_revision
    from public.revisions
    where preparation_id = v_open_id;

    update public.preparations
    set end_date = greatest(start_date, coalesce(v_last_revision, new.reviewed_at::date - 1))
    where id = v_open_id;

    v_open_id := null;
  end if;

  if v_open_id is null then
    insert into public.preparations (owner_id, client_id, phase, start_date)
    values (new.owner_id, new.client_id, new.phase, new.reviewed_at::date)
    returning id into v_open_id;
  else
    -- La preparación sigue abierta: su fase pasa a ser la de esta revisión (la más reciente).
    update public.preparations set phase = new.phase where id = v_open_id;
  end if;

  new.preparation_id := v_open_id;
  return new;
end;
$$;

-- Corrige el dato de las preparaciones ya existentes con la misma regla: la fase de su revisión
-- más reciente (por fecha de revisión y, en empate, de creación).
update public.preparations p
set phase = latest.phase
from (
  select distinct on (preparation_id) preparation_id, phase
  from public.revisions
  where preparation_id is not null
  order by preparation_id, reviewed_at desc, created_at desc
) latest
where latest.preparation_id = p.id
  and p.phase is distinct from latest.phase;
