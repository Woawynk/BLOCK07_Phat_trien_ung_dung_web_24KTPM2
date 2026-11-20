-- RBAC for the BLOCK07 restaurant project. Run in Supabase SQL Editor.
-- The profiles.role column already exists; this only validates its allowed values.
-- Review existing roles first: SELECT role, count(*) FROM public.profiles GROUP BY role;
-- If you have other custom roles, adjust the constraint before running.

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_rbac_role_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_rbac_role_check
      CHECK (role IN ('manager', 'editor', 'deleter', 'user'));
  END IF;
END $$;

-- Assign roles after users have signed up. Substitute verified email addresses.
-- UPDATE public.profiles SET role = 'manager' WHERE email = 'owner@example.com';
-- UPDATE public.profiles SET role = 'editor' WHERE email = 'editor@example.com';
-- UPDATE public.profiles SET role = 'deleter' WHERE email = 'deleter@example.com';

-- Never expose a public endpoint allowing users to update their own role.
