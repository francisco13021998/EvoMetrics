-- Corrige el backfill inicial de preparaciones (migración create_preparations): el agrupado por
-- huecos de fecha había fragmentado en exceso el historial de algunos clientes. La agrupación
-- correcta, confirmada manualmente por el entrenador: una única preparación abierta por cliente
-- cubriendo todo su historial, salvo el cliente con dos preparaciones reales (separadas por una
-- revisión de fase "Inicio" genuina el 2026-08-29), que mantiene sus dos preparaciones.

begin;

delete from public.preparations;

-- Una preparación por cliente, desde su primera revisión, abierta (end_date null).
insert into public.preparations (owner_id, client_id, phase, start_date, end_date)
select distinct on (r.client_id)
  r.owner_id, r.client_id, r.phase, r.reviewed_at::date, null
from public.revisions r
order by r.client_id, r.reviewed_at asc, r.created_at asc;

-- Vuelve a enlazar cada revisión con la preparación de su cliente vigente en su fecha.
update public.revisions r
set preparation_id = p.id
from public.preparations p
where r.client_id = p.client_id
  and r.reviewed_at::date >= p.start_date
  and (p.end_date is null or r.reviewed_at::date <= p.end_date);

commit;
