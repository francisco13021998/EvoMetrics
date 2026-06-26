alter table public.clients
add column if not exists birth_date date;

comment on column public.clients.birth_date is 'Fecha de nacimiento del cliente para calcular la edad de forma derivada.';