-- Apply ONCE to your own Supabase project using Dashboard > SQL Editor.
-- Existing profiles keep an empty category assignment (deny by default).
-- Run the RBAC patch and migration first. This does not create user accounts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_categories text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Optional verification:
-- SELECT username, role, allowed_categories FROM public.profiles ORDER BY username;
-- SELECT DISTINCT category FROM public.dishes WHERE category IS NOT NULL ORDER BY category;

-- Example assignments: replace usernames and category names with real ones.
-- UPDATE public.profiles SET allowed_categories = ARRAY['Món nước', 'Món chính']::text[]
--   WHERE username = 'testeditor' AND role = 'editor';
-- UPDATE public.profiles SET allowed_categories = ARRAY['Tráng miệng']::text[]
--   WHERE username = 'testdeleter' AND role = 'deleter';
-- Role and category grants must be administered only by trusted operators.
