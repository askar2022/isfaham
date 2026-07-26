-- These SECURITY DEFINER functions are invoked only by database triggers.
-- Prevent API roles from calling them directly.
revoke all on function public.handle_new_teacher()
  from public, anon, authenticated;

revoke all on function public.sync_teacher_admin_access()
  from public, anon, authenticated;
