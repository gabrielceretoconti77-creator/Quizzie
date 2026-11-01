-- Ejecuta esto en Supabase → SQL Editor
create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"decks":[]}',
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "ver lo mio"      on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "crear lo mio"    on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "editar lo mio"   on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrar lo mio"   on public.user_data for delete to authenticated using (auth.uid() = user_id);
