create or replace function public.create_client_payment(
  p_owner_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_due_date date default null
)
returns public.client_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_payment public.client_payments;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_owner_id is distinct from auth.uid() then
    raise exception 'owner_id does not match authenticated user';
  end if;

  insert into public.client_payments (owner_id, client_id, amount, payment_date, due_date)
  values (
    p_owner_id,
    p_client_id,
    p_amount,
    p_payment_date,
    coalesce(p_due_date, p_payment_date)
  )
  returning * into inserted_payment;

  return inserted_payment;
end;
$$;

grant execute on function public.create_client_payment(uuid, uuid, numeric, date, date) to authenticated;