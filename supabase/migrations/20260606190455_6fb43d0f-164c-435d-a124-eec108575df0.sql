
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Spaces
CREATE TABLE public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '📘',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spaces viewable by authenticated" ON public.spaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create spaces" ON public.spaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated update spaces" ON public.spaces FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Creator deletes space" ON public.spaces FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER spaces_touch BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pages
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  position INT NOT NULL DEFAULT 0,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pages_space_idx ON public.pages(space_id);
CREATE INDEX pages_parent_idx ON public.pages(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pages viewable by authenticated" ON public.pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create pages" ON public.pages FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authenticated edit pages" ON public.pages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Author deletes page" ON public.pages FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE TRIGGER pages_touch BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Page versions
CREATE TABLE public.page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX page_versions_page_idx ON public.page_versions(page_id, created_at DESC);
GRANT SELECT, INSERT ON public.page_versions TO authenticated;
GRANT ALL ON public.page_versions TO service_role;
ALTER TABLE public.page_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Versions viewable by authenticated" ON public.page_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert versions" ON public.page_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = edited_by);

-- Snapshot version on update
CREATE OR REPLACE FUNCTION public.snapshot_page_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.content::text IS DISTINCT FROM NEW.content::text) THEN
    INSERT INTO public.page_versions (page_id, title, content, edited_by)
    VALUES (OLD.id, OLD.title, OLD.content, OLD.last_edited_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER pages_version_snapshot BEFORE UPDATE ON public.pages
FOR EACH ROW EXECUTE FUNCTION public.snapshot_page_version();

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_page_idx ON public.comments(page_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by authenticated" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author edits comment" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author deletes comment" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);
