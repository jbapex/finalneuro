-- Tabela global de branding do sistema (logos clara/escura do Neuro Ápice)
create table if not exists public.system_branding (
  id text primary key default 'neuro_apice',
  light_logo_url text,
  dark_logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante que sempre exista pelo menos um registro padrão
insert into public.system_branding (id)
values ('neuro_apice')
on conflict (id) do nothing;

-- Habilitar RLS
alter table public.system_branding enable row level security;

-- Policies idempotentes
drop policy if exists "system_branding_select_public" on public.system_branding;
drop policy if exists "system_branding_update_super_admin" on public.system_branding;

-- Leitura: permitir que qualquer usuário (anon + authenticated) leia o registro de branding
create policy "system_branding_select_public"
on public.system_branding
for select
to public
using (true);

-- Escrita: apenas usuários marcados como super admin podem atualizar
-- Aqui usamos a coluna user_type = 'super_admin' da tabela public.profiles
create policy "system_branding_update_super_admin"
on public.system_branding
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = 'super_admin'
  )
);

