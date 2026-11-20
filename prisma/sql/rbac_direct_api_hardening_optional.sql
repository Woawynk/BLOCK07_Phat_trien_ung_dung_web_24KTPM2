-- OPTIONAL: execute after reviewing your current RLS policies and client access.
-- Express db.js uses the Supabase service role. It bypasses RLS; guards in Express
-- must remain in place for EVERY privileged route.
-- These statements prevent direct browser API writes by anon/authenticated roles.
-- If your frontend intentionally writes directly via Supabase, adapt first.

ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.dishes, public.chefs, public.ingredients
FROM anon, authenticated;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
-- Also review any existing broad policies or grants on join tables such as
-- public."_DishToIngredient" / public.dish_ingredients (schema varies).
-- Do not expose SUPABASE_SERVICE_ROLE_KEY in frontend JavaScript or Git.
