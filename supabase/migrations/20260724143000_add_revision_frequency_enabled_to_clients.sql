alter table public.clients
add column if not exists revision_frequency_enabled boolean not null default true;

comment on column public.clients.revision_frequency_enabled is 'Indica si el cliente tiene una frecuencia de revisiones activa.';