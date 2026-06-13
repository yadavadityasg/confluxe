
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============ SPACE MEMBERS ============
CREATE TABLE public.space_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(space_id, user_id)
);
GRANT SELECT ON public.space_members TO authenticated;
GRANT ALL ON public.space_members TO service_role;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.space_role(_user_id uuid, _space_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.space_members WHERE user_id = _user_id AND space_id = _space_id
$$;

CREATE OR REPLACE FUNCTION public.can_view_space(_user_id uuid, _space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.space_members WHERE user_id = _user_id AND space_id = _space_id)
$$;

CREATE OR REPLACE FUNCTION public.can_edit_space(_user_id uuid, _space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.space_members
                 WHERE user_id = _user_id AND space_id = _space_id AND role IN ('editor','admin'))
$$;

CREATE OR REPLACE FUNCTION public.can_admin_space(_user_id uuid, _space_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.space_members
                 WHERE user_id = _user_id AND space_id = _space_id AND role = 'admin')
$$;

CREATE POLICY "Members see space_members" ON public.space_members FOR SELECT TO authenticated
  USING (public.can_view_space(auth.uid(), space_id));

-- ============ REPLACE SPACES RLS ============
DROP POLICY IF EXISTS "Spaces viewable by authenticated" ON public.spaces;
DROP POLICY IF EXISTS "Authenticated create spaces" ON public.spaces;
DROP POLICY IF EXISTS "Authenticated update spaces" ON public.spaces;
DROP POLICY IF EXISTS "Creator deletes space" ON public.spaces;

CREATE POLICY "View spaces" ON public.spaces FOR SELECT TO authenticated
  USING (public.can_view_space(auth.uid(), id));
CREATE POLICY "Admins create spaces" ON public.spaces FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Admins update spaces" ON public.spaces FOR UPDATE TO authenticated
  USING (public.can_admin_space(auth.uid(), id))
  WITH CHECK (public.can_admin_space(auth.uid(), id));
CREATE POLICY "Admins delete spaces" ON public.spaces FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============ REPLACE PAGES RLS ============
DROP POLICY IF EXISTS "Pages viewable by authenticated" ON public.pages;
DROP POLICY IF EXISTS "Authenticated create pages" ON public.pages;
DROP POLICY IF EXISTS "Authenticated edit pages" ON public.pages;
DROP POLICY IF EXISTS "Author deletes page" ON public.pages;

CREATE POLICY "View pages" ON public.pages FOR SELECT TO authenticated
  USING (public.can_view_space(auth.uid(), space_id));
CREATE POLICY "Editors create pages" ON public.pages FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_space(auth.uid(), space_id) AND auth.uid() = author_id);
CREATE POLICY "Editors edit pages" ON public.pages FOR UPDATE TO authenticated
  USING (public.can_edit_space(auth.uid(), space_id))
  WITH CHECK (public.can_edit_space(auth.uid(), space_id));
CREATE POLICY "Admins delete pages" ON public.pages FOR DELETE TO authenticated
  USING (public.can_admin_space(auth.uid(), space_id));

-- ============ COMMENTS RLS ============
DROP POLICY IF EXISTS "Comments viewable by authenticated" ON public.comments;
DROP POLICY IF EXISTS "Authenticated create comments" ON public.comments;

CREATE POLICY "View comments" ON public.comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pages p WHERE p.id = page_id AND public.can_view_space(auth.uid(), p.space_id)));
CREATE POLICY "Members create comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id
              AND EXISTS (SELECT 1 FROM public.pages p WHERE p.id = page_id AND public.can_view_space(auth.uid(), p.space_id)));

-- ============ AUTO-ADD CREATOR AS SPACE ADMIN ============
CREATE OR REPLACE FUNCTION public.add_creator_as_space_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.space_members (space_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_add_creator_space_admin ON public.spaces;
CREATE TRIGGER trg_add_creator_space_admin
  AFTER INSERT ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_space_admin();

-- ============ BOOTSTRAP ADMIN HELPER ============
-- Returns true if an admin already exists; used by the public setup page to gate itself.
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;
