require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || serviceKey;

// Service Role Client (đầy đủ quyền — dùng cho backend server)
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Anon Client (dùng cho signInWithPassword phía user)
const supabaseAnon = createClient(supabaseUrl, anonKey);

module.exports = { supabase, supabaseAnon };
