alter table public.clients
drop constraint if exists clients_revision_frequency_value_check;

alter table public.clients
add constraint clients_revision_frequency_value_check
check (revision_frequency_value >= 0);

comment on column public.clients.revision_frequency_value is 'Numero de unidades entre revisiones. 0 indica que no hay frecuencia activa.';