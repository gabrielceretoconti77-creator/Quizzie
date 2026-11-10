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

-- ============================================================
-- IMÁGENES de las tarjetas (ejecuta también esto en SQL Editor)
-- Bucket privado 'imagenes'; cada usuario solo accede a su carpeta (su user id).
-- ============================================================
insert into storage.buckets (id, name, public) values ('imagenes', 'imagenes', false) on conflict (id) do nothing;
create policy "ver mis imagenes"    on storage.objects for select to authenticated using (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "subir mis imagenes"  on storage.objects for insert to authenticated with check (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "editar mis imagenes" on storage.objects for update to authenticated using (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis imagenes" on storage.objects for delete to authenticated using (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);
