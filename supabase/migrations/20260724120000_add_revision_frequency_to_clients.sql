alter table public.clients
add column if not exists revision_frequency_value integer not null default 4,
add column if not exists revision_frequency_unit text not null default 'week';

alter table public.clients
add constraint clients_revision_frequency_value_check
check (revision_frequency_value > 0);

alter table public.clients
add constraint clients_revision_frequency_unit_check
check (revision_frequency_unit in ('week', 'month'));

comment on column public.clients.revision_frequency_value is 'Numero de unidades entre revisiones.';
comment on column public.clients.revision_frequency_unit is 'Unidad de tiempo para la frecuencia de revisiones: week o month.';