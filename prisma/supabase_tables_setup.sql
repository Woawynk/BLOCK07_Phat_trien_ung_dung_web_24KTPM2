-- ==============================================================================
-- TẠO BẢNG DỮ LIỆU CHO DỰ ÁN RESTAURANT MENU
-- Chạy trong Supabase Dashboard > SQL Editor > New Query > Paste & Run
-- ==============================================================================

-- 1. Bảng Đầu bếp (Chefs)
CREATE TABLE IF NOT EXISTS public.chefs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Nguyên liệu (Ingredients)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Món ăn (Dishes)
CREATE TABLE IF NOT EXISTS public.dishes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INT NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  chef_id INT REFERENCES public.chefs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng trung gian nhiều-nhiều Món ăn <-> Nguyên liệu
CREATE TABLE IF NOT EXISTS public.dish_ingredients (
  dish_id INT NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  PRIMARY KEY (dish_id, ingredient_id)
);

-- 5. Bảng Hồ sơ người dùng (Profiles) cho Auth
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  dob DATE,
  role TEXT DEFAULT 'user',
  failed_login_attempts INT DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  unlock_token TEXT UNIQUE,
  unlock_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tạo Index tăng tốc tra cứu
CREATE INDEX IF NOT EXISTS idx_dishes_chef_id ON public.dishes(chef_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish ON public.dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient ON public.dish_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_unlock_token ON public.profiles(unlock_token);

-- 7. Bật Row Level Security cho profiles (bảo mật dữ liệu người dùng)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role toàn quyền profiles"
ON public.profiles FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 8. Seed dữ liệu mẫu (Tùy chọn)
INSERT INTO public.chefs (name, specialty) VALUES
  ('Nguyễn Văn Bếp', 'Phở & Bún'),
  ('Trần Thị Nấu', 'Cơm & Xào'),
  ('Lê Minh Chef', 'Hải Sản')
ON CONFLICT DO NOTHING;

INSERT INTO public.ingredients (name, unit) VALUES
  ('Thịt bò', 'kg'),
  ('Bún tươi', 'kg'),
  ('Rau sống', 'bó'),
  ('Hành lá', 'bó'),
  ('Nước mắm', 'lít'),
  ('Tôm sú', 'kg'),
  ('Cơm trắng', 'phần')
ON CONFLICT DO NOTHING;

INSERT INTO public.dishes (name, description, price, category, image_url, available, chef_id) VALUES
  ('Phở Bò Hà Nội', 'Phở bò truyền thống Hà Nội với nước dùng đậm đà', 55000, 'Món nước', NULL, TRUE, 1),
  ('Cơm Tấm Sườn Bì', 'Cơm tấm sườn nướng kèm bì và trứng ốp la', 45000, 'Cơm', NULL, TRUE, 2),
  ('Bún Chả Hà Nội', 'Bún chả nướng than hoa thơm lừng', 50000, 'Món nước', NULL, TRUE, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.dish_ingredients (dish_id, ingredient_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5),
  (2, 7), (2, 5),
  (3, 2), (3, 3), (3, 4), (3, 5)
ON CONFLICT DO NOTHING;
