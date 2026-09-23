-- preparations.phase se sincroniza con la fase de la revisión más reciente, pero solo al
-- INSERTAR una revisión (assign_revision_preparation). Si esa revisión más reciente se borra, o se
-- le edita la fase, preparations.phase se queda con el valor viejo: por ejemplo, si la última
-- revisión de una preparación estaba en "Volumen" y se borra, la preparación sigue marcada como
-- "Volumen" aunque la revisión que queda como más reciente sea de "Definición".
-- Este trigger recalcula preparations.phase a partir de la revisión más reciente que quede
-- realmente en esa preparación, tanto al borrar una revisión como al editarle la fase (o, por
-- seguridad, si cambiara de preparación).

create or replace function public.recalculate_preparation_phase()
returns trigger
language plpgsql
as $$
declare
  v_target_id uuid;
  v_latest_phase text;
begin
  if tg_op = 'UPDATE' and old.preparation_id is distinct from new.preparation_id and old.preparation_id is not null then
    select phase into v_latest_phase
    from public.revisions
    where preparation_id = old.preparation_id
    order by reviewed_at desc, created_at desc
    limit 1;

    update public.preparations set phase = v_latest_phase where id = old.preparation_id;
  end if;

  v_target_id := coalesce(new.preparation_id, old.preparation_id);

  if v_target_id is not null then
    select phase into v_latest_phase
    from public.revisions
    where preparation_id = v_target_id
    order by reviewed_at desc, created_at desc
    limit 1;

    update public.preparations set phase = v_latest_phase where id = v_target_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists recalculate_preparation_phase_on_delete on public.revisions;
create trigger recalculate_preparation_phase_on_delete
  after delete on public.revisions
  for each row execute function public.recalculate_preparation_phase();

drop trigger if exists recalculate_preparation_phase_on_update on public.revisions;
create trigger recalculate_preparation_phase_on_update
  after update of phase, preparation_id on public.revisions
  for each row execute function public.recalculate_preparation_phase();
