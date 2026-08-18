alter table public.client_payments
add column if not exists due_date date;

update public.client_payments
set due_date = payment_date
where due_date is null;

alter table public.client_payments
alter column due_date set not null;

comment on column public.client_payments.due_date is 'Fecha prevista de vencimiento del pago para notificaciones y estado.';
