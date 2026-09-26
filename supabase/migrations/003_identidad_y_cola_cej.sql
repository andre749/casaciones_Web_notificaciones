-- ============================================================
-- Identidad del consultante (cifrada) y cola de consultas al CEJ.
-- Requiere 002_alertas_expedientes.sql.
-- Ejecutar este script completo en: Supabase > SQL Editor
-- Es seguro volver a ejecutarlo (usa IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- 1. Identidad que el CEJ pide en el modal "Validacion de identidad del consultante".
--    Los datos viajan cifrados (AES-256-GCM) con IDENTIDAD_CLAVE, que solo conocen
--    el servidor de Next.js y el worker. En la BD nunca se guardan en texto plano.
create table if not exists public.identidad_consultante (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in ('DNI', 'CE')),
  documento_mascara text not null,  -- p. ej. "****3780", solo para mostrar
  datos_cifrados text not null,     -- v1:<iv>:<datos+tag> en base64
  updated_at timestamptz not null default now()
);

alter table public.identidad_consultante enable row level security;

drop policy if exists "identidad_select_propio" on public.identidad_consultante;
create policy "identidad_select_propio"
  on public.identidad_consultante for select
  using (auth.uid() = perfil_id);

drop policy if exists "identidad_insert_propio" on public.identidad_consultante;
create policy "identidad_insert_propio"
  on public.identidad_consultante for insert
  with check (auth.uid() = perfil_id);

drop policy if exists "identidad_update_propio" on public.identidad_consultante;
create policy "identidad_update_propio"
  on public.identidad_consultante for update
  using (auth.uid() = perfil_id);

drop policy if exists "identidad_delete_propio" on public.identidad_consultante;
create policy "identidad_delete_propio"
  on public.identidad_consultante for delete
  using (auth.uid() = perfil_id);

-- 2. Cola de consultas: la pagina marca una alerta como 'pendiente' y el worker
--    (worker/cej_scrapper.py servir) la toma, consulta el CEJ y deja el resultado.
alter table public.alertas_expedientes
  add column if not exists consulta_estado text not null default 'pendiente'
    check (consulta_estado in ('pendiente', 'consultando', 'requiere_captcha', 'ok', 'no_encontrado', 'error'));

alter table public.alertas_expedientes
  add column if not exists consulta_solicitada timestamptz not null default now();

create index if not exists idx_alertas_expedientes_consulta
  on public.alertas_expedientes(consulta_estado, consulta_solicitada);

-- ============================================================
-- Fin de la migracion
-- ============================================================
