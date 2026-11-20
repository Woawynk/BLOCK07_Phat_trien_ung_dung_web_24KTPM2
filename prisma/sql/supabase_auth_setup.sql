-- ==============================================================================
-- FILE SQL THIẾT LẬP BẢNG PROFILES & RLS TRÊN SUPABASE CHO DỰ ÁN RESTAURANT MENU
-- Sao chép toàn bộ nội dung file này và chạy trong Supabase: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Tạo bảng profiles lưu thông tin bổ sung và theo dõi khóa tài khoản khi sai 5 lần
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- 2. Bật Row Level Security (RLS) bảo vệ dữ liệu
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cho phép người dùng xem hồ sơ của mình
CREATE POLICY "Cho phép người dùng đọc thông tin cá nhân"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Cho phép backend service role toàn quyền đọc ghi
CREATE POLICY "Service Role toàn quyền quản lý profiles"
ON public.profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Tạo index tăng tốc tra cứu theo username và email
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_unlock_token ON public.profiles(unlock_token);
