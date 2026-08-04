alter table public.clients
add column if not exists estado text not null default 'activo';

update public.clients
set estado = 'activo'
where estado is null;
