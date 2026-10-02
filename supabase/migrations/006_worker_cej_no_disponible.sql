-- ============================================================
-- Nuevo estado del worker: 'cej_no_disponible'.
-- El worker lo publica en worker_estado cuando el CEJ responde "Error de conexion"
-- (portal caido para todos) y se pausa hasta que vuelva. La pagina, como con
-- 'verificacion_navegador', lo toma como "servicio no disponible" y avisa al usuario
-- que su consulta se hara cuando vuelva.
--
-- Sin esta migracion el worker publica 'verificacion_navegador' con un mensaje que
-- explica la caida. Es seguro volver a ejecutarlo.
-- ============================================================

-- Borra el check actual de `estado` sea cual sea su nombre (el de 004 no tenia nombre)
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.worker_estado'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table public.worker_estado drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.worker_estado
  add constraint worker_estado_estado_check
  check (estado in ('activo', 'verificacion_navegador', 'cej_no_disponible'));
