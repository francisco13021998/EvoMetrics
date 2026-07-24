alter table public.clients
alter column revision_frequency_value drop not null,
alter column revision_frequency_value drop default,
alter column revision_frequency_unit drop not null,
alter column revision_frequency_unit drop default;

comment on column public.clients.revision_frequency_value is 'Numero de unidades entre revisiones. Null indica que no hay frecuencia activa.';
comment on column public.clients.revision_frequency_unit is 'Unidad de tiempo para la frecuencia de revisiones: week o month. Null indica que no hay frecuencia activa.';