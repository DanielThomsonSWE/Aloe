-- Apply in the Supabase SQL Editor when aloe_medications already exists.
begin;

alter table public.aloe_medications
add column if not exists description text not null default ''
check (char_length(description) <= 500);

grant insert (user_id, name, dosage, schedule, description)
on public.aloe_medications to authenticated;

grant update (pinned, name, dosage, schedule, description)
on public.aloe_medications to authenticated;

drop policy if exists "Pin own medications" on public.aloe_medications;
drop policy if exists "Update own medications" on public.aloe_medications;
create policy "Update own medications" on public.aloe_medications
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
