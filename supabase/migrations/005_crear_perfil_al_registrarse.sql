-- ============================================================
-- Crear el perfil automaticamente al registrarse un usuario.
-- app/auth/registro/page.tsx ya no inserta en `perfiles`: espera a que lo haga
-- este trigger (el insert desde el navegador chocaba con RLS).
-- Ejecutar este script completo en: Supabase > SQL Editor
-- Es seguro volver a ejecutarlo.
--
-- Si en el proyecto YA existe otro trigger sobre auth.users que crea perfiles
-- (p. ej. creado a mano en el panel), este script NO crea un segundo: solo avisa.
-- En ese caso conviene copiar aqui la definicion real para que quede en el repo.
-- ============================================================

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mismos valores que insertaba el registro antes (plan gratuito, 30 creditos)
  insert into public.perfiles (id, email, nombre, plan_id, creditos, consultas_usadas)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nombre', ''),
    'd04d64e3-252e-4f59-bda4-fdf62fb83775',
    30,
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
declare
  existente text;
begin
  select t.tgname into existente
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.users'::regclass
    and not t.tgisinternal
    and t.tgname <> 'on_auth_user_created_perfil'
    and p.prosrc ilike '%perfiles%'
  limit 1;

  if existente is not null then
    raise notice 'Ya existe el trigger "%" que crea perfiles: no se crea otro.', existente;
    drop trigger if exists on_auth_user_created_perfil on auth.users;
  else
    drop trigger if exists on_auth_user_created_perfil on auth.users;
    create trigger on_auth_user_created_perfil
      after insert on auth.users
      for each row execute function public.crear_perfil_nuevo_usuario();
    raise notice 'Trigger on_auth_user_created_perfil creado.';
  end if;
end;
$$;

-- ============================================================
-- Fin de la migracion
-- ============================================================
