alter table public.clients
add column if not exists coaching_price numeric not null default 0,
add column if not exists billing_frequency text not null default 'one_time',
add column if not exists force_payment_pending boolean not null default false;

comment on column public.clients.coaching_price is 'Precio base de coaching para el sistema de pagos.';
comment on column public.clients.billing_frequency is 'Frecuencia de facturacion del cliente.';
comment on column public.clients.force_payment_pending is 'Marca manual para forzar estado pendiente de pago.';

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  client_id uuid not null,
  amount numeric not null,
  payment_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists client_payments_client_id_payment_date_idx
  on public.client_payments (client_id, payment_date desc, created_at desc);

comment on table public.client_payments is 'Historial de pagos asociados a clientes.';
comment on column public.client_payments.payment_date is 'Fecha en la que se registro el pago.';