
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_space(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_space(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_space(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_role(uuid, uuid) TO authenticated;
