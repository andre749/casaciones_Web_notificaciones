-- ============================================================
-- Crear el perfil automaticamente al registrarse un usuario.
-- app/auth/registro/page.tsx ya no inserta en `perfiles`: espera a que lo haga
-- este trigger (el insert desde el navegador chocaba con RLS).
--
-- Es la definicion que ya existe en produccion (creada desde el panel de Supabase),
-- copiada aqui para que quede en el repo. Ejecutarlo en un proyecto donde ya existe
-- no cambia nada. Es seguro volver a ejecutarlo.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.perfiles (id, email, nombre, plan_id, creditos, consultas_usadas)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    'd04d64e3-252e-4f59-bda4-fdf62fb83775', -- Plan gratis
    30,
    0
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Fin de la migracion
-- ============================================================
