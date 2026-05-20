// supabase.js - Initializes Supabase client for database interactions

const SUPABASE_URL = "https://dycoodprngjtzculnzwo.supabase.co";
const SUPABASE_ANON = "sb_publishable_X6dRRdO5fzd3rnz4oRS8Tg_eQwmEy5J";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);
