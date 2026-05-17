// supabase.js - Initializes Supabase client for database interactions

const SUPABASE_URL = "https://bdekqnwwwnhtoobgvbwb.supabase.co";
const SUPABASE_ANON = "sb_publishable_qP7ziw4I47GyRIo5t-I05g_9rtfn3eA";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);
