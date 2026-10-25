-- Initial setup for a NEW Aloe table. Run once in your Supabase SQL Editor.
-- This is an unapplied setup script, not a generated migration.
-- No example prescriptions are inserted into real accounts.
begin;

create table public.aloe_medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  dosage text not null check (char_length(btrim(dosage)) between 1 and 80),
  schedule text not null check (char_length(btrim(schedule)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 500),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index aloe_medications_user_sort on public.aloe_medications (user_id, pinned desc, created_at, id);
alter table public.aloe_medications enable row level security;

revoke all on public.aloe_medications from public, anon, authenticated;
grant select, delete on public.aloe_medications to authenticated;
grant insert (user_id, name, dosage, schedule, description) on public.aloe_medications to authenticated;
grant update (pinned, name, dosage, schedule, description) on public.aloe_medications to authenticated;

create policy "Read own medications" on public.aloe_medications
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own medications" on public.aloe_medications
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own medications" on public.aloe_medications
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Remove own medications" on public.aloe_medications
for delete to authenticated using ((select auth.uid()) = user_id);

commit;
