-- ============================================================
-- Documentos de las actuaciones, prioridad de la cola y estado del worker.
-- Requiere 003_identidad_y_cola_cej.sql.
-- Ejecutar este script completo en: Supabase > SQL Editor
-- Es seguro volver a ejecutarlo (usa IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- 1. Los captchas ya no se le piden al usuario: el worker reintenta solo.
drop table if exists public.captchas_pendientes;

-- 2. Prioridad en la cola: 0 = lo pidio el usuario (registro o "Revisar ahora"),
--    1 = revision periodica. El worker atiende primero la prioridad 0.
alter table public.alertas_expedientes
  add column if not exists prioridad smallint not null default 0;

drop index if exists public.idx_alertas_expedientes_consulta;
create index if not exists idx_alertas_expedientes_cola
  on public.alertas_expedientes(consulta_estado, prioridad, consulta_solicitada);

-- 3. PDF de la resolucion descargado por el worker durante su sesion en el CEJ
alter table public.notificaciones
  add column if not exists documento_path text;  -- ruta en el bucket documentos-expedientes

-- 4. Bucket privado: cada usuario solo puede leer su carpeta (<perfil_id>/...).
--    El worker sube los archivos con la service role key.
insert into storage.buckets (id, name, public)
values ('documentos-expedientes', 'documentos-expedientes', false)
on conflict (id) do nothing;

drop policy if exists "documentos_expedientes_select_propio" on storage.objects;
create policy "documentos_expedientes_select_propio"
  on storage.objects for select
  using (
    bucket_id = 'documentos-expedientes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Latido del worker: la pagina lo usa para avisar si el servicio de consultas
--    esta apagado o esperando la verificacion de navegador del CEJ.
create table if not exists public.worker_estado (
  id text primary key,
  estado text not null check (estado in ('activo', 'verificacion_navegador')),
  mensaje text,
  actualizado timestamptz not null default now()
);

alter table public.worker_estado enable row level security;

drop policy if exists "worker_estado_select_autenticados" on public.worker_estado;
create policy "worker_estado_select_autenticados"
  on public.worker_estado for select
  to authenticated
  using (true);

-- 6. Consentimiento del tratamiento de datos de identidad (Ley 29733)
alter table public.identidad_consultante
  add column if not exists consentimiento_en timestamptz;

-- 7. Lo que el navegador puede escribir. El worker usa la service role key y no se
--    ve afectado. Sin esto un usuario podria, desde la consola del navegador, saltarse
--    la cola, forzar consultas sin limite al CEJ o crear alertas sin validar.

-- 7a. Alertas: solo se insertan estas columnas (el resto toma sus valores por defecto)
revoke insert, update on public.alertas_expedientes from anon, authenticated;
grant insert (perfil_id, tipo, valor, parte, filtros) on public.alertas_expedientes to authenticated;
drop policy if exists "alertas_expedientes_update_propio" on public.alertas_expedientes;

-- Limite de expedientes monitoreados por usuario y formato del CUE, tambien para
-- inserciones que no pasen por /api/alertas
create or replace function public.validar_alerta_expediente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'expediente'
     and new.valor !~ '^\d{5}-\d{4}-\d+-\d{4}-[A-Z]{2}-[A-Z]{2}-\d{2}$' then
    raise exception 'Codigo de expediente invalido';
  end if;
  if (select count(*) from public.alertas_expedientes where perfil_id = new.perfil_id) >= 50 then
    raise exception 'Alcanzaste el limite de 50 expedientes monitoreados';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_alerta_expediente on public.alertas_expedientes;
create trigger trg_validar_alerta_expediente
  before insert on public.alertas_expedientes
  for each row execute function public.validar_alerta_expediente();

-- 7b. "Revisar ahora": como maximo una revision manual cada 10 minutos por alerta
create or replace function public.solicitar_revision_alerta(p_alerta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.alertas_expedientes%rowtype;
begin
  select * into a from public.alertas_expedientes
  where id = p_alerta and perfil_id = auth.uid()
  for update;
  if not found then
    raise exception 'Alerta no encontrada';
  end if;
  if a.estado = 'pausado' then
    raise exception 'La alerta esta pausada';
  end if;
  -- Ya esta por consultarse: no hace falta hacer nada
  if a.consulta_estado = 'consultando'
     or (a.consulta_estado = 'pendiente' and a.consulta_solicitada <= now()) then
    return;
  end if;
  if a.ficha is not null and a.ultima_revision > now() - interval '10 minutes' then
    raise exception 'El expediente se reviso hace menos de 10 minutos';
  end if;
  update public.alertas_expedientes
  set consulta_estado = 'pendiente', consulta_solicitada = now(), prioridad = 0
  where id = p_alerta;
end;
$$;

-- 7c. Pausar / reanudar
create or replace function public.pausar_alerta(p_alerta uuid, p_pausar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alertas_expedientes
  set estado = case when p_pausar then 'pausado' else 'activo' end
  where id = p_alerta and perfil_id = auth.uid();
  if not found then
    raise exception 'Alerta no encontrada';
  end if;
end;
$$;

-- 7d. Al registrar la identidad, reencolar las alertas que fallaron por no tenerla
create or replace function public.reencolar_alertas_sin_identidad()
returns void
language sql
security definer
set search_path = public
as $$
  update public.alertas_expedientes
  set consulta_estado = 'pendiente', consulta_solicitada = now(), prioridad = 0
  where perfil_id = auth.uid()
    and consulta_estado = 'error'
    and ultimo_error like 'Falta%identidad%';
$$;

revoke all on function public.solicitar_revision_alerta(uuid) from public, anon;
revoke all on function public.pausar_alerta(uuid, boolean) from public, anon;
revoke all on function public.reencolar_alertas_sin_identidad() from public, anon;
grant execute on function public.solicitar_revision_alerta(uuid) to authenticated;
grant execute on function public.pausar_alerta(uuid, boolean) to authenticated;
grant execute on function public.reencolar_alertas_sin_identidad() to authenticated;

-- 7e. Notificaciones: el usuario solo puede marcarlas como leidas
revoke update on public.notificaciones from anon, authenticated;
grant update (leida) on public.notificaciones to authenticated;

-- ============================================================
-- Fin de la migracion
-- ============================================================
