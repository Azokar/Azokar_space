-- 1) Las funciones de disparador no deben poder llamarse desde la API (/rest/v1/rpc/...).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) Las fotos de perfil siguen viéndose por su URL pública (el bucket es público), pero ya no se puede
--    listar el bucket completo: antes cualquiera podía enumerar los archivos y, con ellos, los ids de usuario.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Users read their own avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
