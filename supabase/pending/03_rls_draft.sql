-- ⚠️ BORRADOR de RLS — NO APLICAR SIN REVISAR CONTRA EL ESQUEMA Y LAS POLICIES REALES.
--
-- Las tablas base y el RLS existente NO están versionados en este repo: es imposible saber desde
-- aquí qué policies existen ya en el proyecto Supabase. Este borrador documenta el modelo de
-- acceso que el código cliente asume:
--   * Profesional (trainer/coach/nutritionist/owner): CRUD sobre sus filas (owner_id = auth.uid()).
--   * Atleta: SOLO LECTURA de su propio cliente y datos derivados, vía clients.athlete_user_id
--     (el código usa getByIdForViewer / listBy*ForViewer sin filtrar por owner, confiando en esto).
--
-- Pasos: (1) inventariar policies existentes en el dashboard, (2) ajustar este fichero,
-- (3) probar con un usuario trainer y uno athlete, (4) mover a migrations/ y aplicar.

-- ── clients ──────────────────────────────────────────────────────────────────
alter table public.clients enable row level security;

drop policy if exists clients_owner_all on public.clients;
create policy clients_owner_all on public.clients
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists clients_athlete_read on public.clients;
create policy clients_athlete_read on public.clients
  for select using (athlete_user_id = auth.uid());

-- ── revisions ────────────────────────────────────────────────────────────────
alter table public.revisions enable row level security;

drop policy if exists revisions_owner_all on public.revisions;
create policy revisions_owner_all on public.revisions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists revisions_athlete_read on public.revisions;
create policy revisions_athlete_read on public.revisions
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = revisions.client_id and c.athlete_user_id = auth.uid()
    )
  );

-- ── client_photos ────────────────────────────────────────────────────────────
alter table public.client_photos enable row level security;

drop policy if exists client_photos_owner_all on public.client_photos;
create policy client_photos_owner_all on public.client_photos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists client_photos_athlete_read on public.client_photos;
create policy client_photos_athlete_read on public.client_photos
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = client_photos.client_id and c.athlete_user_id = auth.uid()
    )
  );

-- ── client_payments ──────────────────────────────────────────────────────────
-- Nota: los atletas NO deben ver pagos (la UI de pagos es solo de entrenador).
alter table public.client_payments enable row level security;

drop policy if exists client_payments_owner_all on public.client_payments;
create policy client_payments_owner_all on public.client_payments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── events / event_occurrences ───────────────────────────────────────────────
alter table public.events enable row level security;

drop policy if exists events_owner_all on public.events;
create policy events_owner_all on public.events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.event_occurrences enable row level security;

drop policy if exists event_occurrences_owner_all on public.event_occurrences;
create policy event_occurrences_owner_all on public.event_occurrences
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── body_fat_formulas (catálogo de solo lectura) ─────────────────────────────
alter table public.body_fat_formulas enable row level security;

drop policy if exists body_fat_formulas_read_all on public.body_fat_formulas;
create policy body_fat_formulas_read_all on public.body_fat_formulas
  for select using (auth.uid() is not null);

-- ── profiles ─────────────────────────────────────────────────────────────────
-- El cliente solo lee su propia fila (auth-provider.fetchRole).
alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid());

-- ── Storage: bucket client-images ────────────────────────────────────────────
-- Las rutas son ownerId/clientId/fichero. El owner gestiona sus objetos; el atleta solo lee
-- los de su cliente. Revisar en el dashboard (Storage > Policies) — sintaxis de referencia:
--
-- create policy client_images_owner_all on storage.objects
--   for all using (
--     bucket_id = 'client-images' and (storage.foldername(name))[1] = auth.uid()::text
--   ) with check (
--     bucket_id = 'client-images' and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- create policy client_images_athlete_read on storage.objects
--   for select using (
--     bucket_id = 'client-images' and exists (
--       select 1 from public.clients c
--       where c.athlete_user_id = auth.uid()
--         and (storage.foldername(name))[2] = c.id::text
--     )
--   );
