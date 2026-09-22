-- Sustituye la señal de "nueva preparación" que dependía de un checkbox manual en la app: ahora es
-- automática y se basa únicamente en el campo "Fase" de la revisión. Si una revisión se crea con
-- fase "Inicio", se cierra la preparación abierta del cliente (si la hay) y se abre una nueva a
-- partir de esa revisión. Con cualquier otra fase, la revisión se sigue colgando de la preparación
-- abierta, igual que antes.

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
  end if;

  new.preparation_id := v_open_id;
  return new;
end;
$$;
