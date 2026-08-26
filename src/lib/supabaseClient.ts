import { createClient } from "@supabase/supabase-js";

// Carrega as variáveis de ambiente do Vite/TanStack Start
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Cria o cliente Supabase se estiver configurado, caso contrário retorna null
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
        detectSessionInUrl: typeof window !== "undefined",
      },
    })
  : null;
