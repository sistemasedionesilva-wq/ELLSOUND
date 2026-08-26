-- ============================================================
-- ELLSOUND — Painel Admin / Assinaturas / Locais
-- Execute este arquivo no SQL Editor do Supabase.
-- Depois, torne-se admin com o comando indicado no final.
-- ============================================================

-- 1) PERFIS DE USUÁRIO (estende auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  place_name text not null default '',
  place_address text not null default '',
  plan text not null default 'trial' check (plan in ('trial', 'active', 'expired')),
  price_cents int not null default 1990,
  expires_at timestamptz,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_timezone text
);

-- 2) PAGAMENTOS (mensalidades)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents int not null,
  reference_month date not null,
  paid_at timestamptz not null default now(),
  note text not null default ''
);

alter table public.profiles enable row level security;
alter table public.payments enable row level security;

-- 3) POLÍTICAS RLS
-- Perfis: cada usuário lê/edita o próprio; admin lê e edita todos
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Pagamentos: usuário vê os próprios; admin vê tudo e insere
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "payments_insert_admin" on public.payments;
create policy "payments_insert_admin" on public.payments
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 4) CRIA PERFIL AUTOMÁTICO AO CADASTRAR
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 5) TORNAR-SE ADMIN
-- Cadastre-se pelo app primeiro, depois rode no SQL Editor:
--
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'SEU_EMAIL_AQUI');
-- ============================================================
