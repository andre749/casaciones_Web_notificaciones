-- ============================================================
-- Alertas de expedientes (CEJ) y notificaciones - Casaciones Web
-- Ejecutar este script completo en: Supabase > SQL Editor
-- Es seguro volver a ejecutarlo (usa IF NOT EXISTS / OR REPLACE)
--
-- El scraper (CejScrapper/cej_scrapper.py monitorear --fuente supabase)
-- escribe en estas tablas con la service role key (ignora RLS).
-- ============================================================

-- 1. Expedientes monitoreados por cada usuario (interfaz Alerta de la demo)
create table if not exists public.alertas_expedientes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null default 'expediente' check (tipo in ('expediente', 'palabra_clave')),
  valor text not null,          -- CUE o "NNNNN-AAAA" si se registro por filtros
  parte text,                   -- apellido / razon social exigido por el CEJ
  filtros jsonb,                -- FiltrosBusqueda completo (modo 'filtros' o 'codigo')
  detalle text,                 -- distrito · organo · parte
  estado text not null default 'activo' check (estado in ('activo', 'pausado', 'encontrado')),
  ficha jsonb,                  -- ultima ficha del expediente devuelta por el scraper
  actuaciones_vistas text[] not null default '{}', -- huellas de actuaciones ya notificadas
  ultima_actuacion timestamptz,
  ultimo_error text,
  costo_creditos integer not null default 0,
  fecha_registro timestamptz not null default now(),
  ultima_revision timestamptz not null default now(),
  unique (perfil_id, valor)
);

alter table public.alertas_expedientes enable row level security;

drop policy if exists "alertas_expedientes_select_propio" on public.alertas_expedientes;
create policy "alertas_expedientes_select_propio"
  on public.alertas_expedientes for select
  using (auth.uid() = perfil_id);

drop policy if exists "alertas_expedientes_insert_propio" on public.alertas_expedientes;
create policy "alertas_expedientes_insert_propio"
  on public.alertas_expedientes for insert
  with check (auth.uid() = perfil_id);

drop policy if exists "alertas_expedientes_update_propio" on public.alertas_expedientes;
create policy "alertas_expedientes_update_propio"
  on public.alertas_expedientes for update
  using (auth.uid() = perfil_id);

drop policy if exists "alertas_expedientes_delete_propio" on public.alertas_expedientes;
create policy "alertas_expedientes_delete_propio"
  on public.alertas_expedientes for delete
  using (auth.uid() = perfil_id);

create index if not exists idx_alertas_expedientes_estado on public.alertas_expedientes(estado);

-- 2. Notificaciones generadas por el scraper (interfaz Notificacion de la demo)
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  alerta_id uuid not null references public.alertas_expedientes(id) on delete cascade,
  huella text not null,         -- identifica la actuacion; evita notificarla dos veces
  titulo text not null,
  mensaje text not null,
  fecha_hora timestamptz not null default now(),
  leida boolean not null default false,
  expediente text,
  url_documento text,
  created_at timestamptz not null default now(),
  unique (alerta_id, huella)
);

alter table public.notificaciones enable row level security;

drop policy if exists "notificaciones_select_propio" on public.notificaciones;
create policy "notificaciones_select_propio"
  on public.notificaciones for select
  using (auth.uid() = perfil_id);

-- El usuario puede actualizar sus notificaciones (p. ej. marcarlas como leidas)
drop policy if exists "notificaciones_update_propio" on public.notificaciones;
create policy "notificaciones_update_propio"
  on public.notificaciones for update
  using (auth.uid() = perfil_id);

create index if not exists idx_notificaciones_perfil on public.notificaciones(perfil_id, fecha_hora desc);

-- ============================================================
-- Fin de la migracion
-- ============================================================
