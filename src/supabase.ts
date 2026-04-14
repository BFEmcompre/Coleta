import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://tyvscodbyfeybqbgxpqa.supabase.co';
const supabaseAnonKey = 'sb_publishable_wvKSyw_Awq2npLksg2XQ-Q_Jischqmm';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);