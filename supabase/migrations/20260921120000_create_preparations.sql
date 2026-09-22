-- Preparaciones (etapas) de un cliente: cada revisión pertenece a una preparación.
-- Es un cambio aditivo: revisions.preparation_id es nullable y un trigger asigna la
-- preparación actual cuando una revisión se inserta sin ella (compatibilidad con apps antiguas).

create table if not exists public.preparations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  phase text,
  name text,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preparations_dates_check check (end_date is null or end_date >= start_date)
);

create index if not exists preparations_client_id_start_date_idx
  on public.preparations (client_id, start_date desc);

-- Solo una preparación abierta (actual) por cliente.
create unique index if not exists preparations_one_open_per_client_idx
  on public.preparations (client_id)
  where end_date is null;

alter table public.revisions
  add column if not exists preparation_id uuid references public.preparations(id) on delete set null;

create index if not exists revisions_preparation_id_idx
  on public.revisions (preparation_id);

create or replace function public.set_preparations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_preparations_updated_at on public.preparations;
create trigger set_preparations_updated_at
  before update on public.preparations
  for each row execute function public.set_preparations_updated_at();

alter table public.preparations enable row level security;

drop policy if exists preparations_select_own on public.preparations;
create policy preparations_select_own on public.preparations
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists preparations_insert_own on public.preparations;
create policy preparations_insert_own on public.preparations
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists preparations_update_own on public.preparations;
create policy preparations_update_own on public.preparations
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists preparations_delete_own on public.preparations;
create policy preparations_delete_own on public.preparations
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists athletes_read_own_preparations on public.preparations;
create policy athletes_read_own_preparations on public.preparations
  for select using (
    client_id in (select clients.id from public.clients where clients.athlete_user_id = auth.uid())
  );

-- Al crear una revisión sin preparación se asigna la actual del cliente; si no existe ninguna, se abre una.
create or replace function public.assign_revision_preparation()
returns trigger
language plpgsql
as $$
declare
  v_preparation_id uuid;
begin
  if new.preparation_id is not null then
    return new;
  end if;

  select id into v_preparation_id
  from public.preparations
  where client_id = new.client_id and end_date is null
  order by start_date desc
  limit 1;

  if v_preparation_id is null then
    insert into public.preparations (owner_id, client_id, phase, start_date)
    values (new.owner_id, new.client_id, new.phase, new.reviewed_at::date)
    returning id into v_preparation_id;
  end if;

  new.preparation_id := v_preparation_id;
  return new;
end;
$$;

drop trigger if exists assign_revision_preparation on public.revisions;
create trigger assign_revision_preparation
  before insert on public.revisions
  for each row execute function public.assign_revision_preparation();

-- Inicia una nueva preparación: cierra la actual y abre otra en la fecha indicada.
create or replace function public.start_preparation(
  p_client_id uuid,
  p_phase text,
  p_start_date date,
  p_name text default null
)
returns public.preparations
language plpgsql
as $$
declare
  v_owner_id uuid;
  v_open public.preparations;
  v_last_revision date;
  v_result public.preparations;
begin
  select owner_id into v_owner_id from public.clients where id = p_client_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Cliente no encontrado o sin permisos';
  end if;

  select * into v_open from public.preparations where client_id = p_client_id and end_date is null;

  if found then
    select max(reviewed_at)::date into v_last_revision from public.revisions where preparation_id = v_open.id;

    update public.preparations
    set end_date = greatest(start_date, least(coalesce(v_last_revision, p_start_date - 1), p_start_date - 1))
    where id = v_open.id;
  end if;

  insert into public.preparations (owner_id, client_id, phase, name, start_date)
  values (v_owner_id, p_client_id, p_phase, nullif(trim(p_name), ''), p_start_date)
  returning * into v_result;

  return v_result;
end;
$$;
