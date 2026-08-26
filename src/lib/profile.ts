import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  display_name: string;
  role: "user" | "admin";
  place_name: string;
  place_address: string;
  plan: "trial" | "active" | "expired";
  price_cents: number;
  expires_at: string | null;
  blocked: boolean;
  created_at: string;
  last_login_at: string | null;
  last_timezone: string | null;
};

export type Payment = {
  id: string;
  user_id: string;
  amount_cents: number;
  reference_month: string;
  paid_at: string;
  note: string;
};

export async function fetchProfile(
  sb: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return null;
  return (data as Profile) ?? null;
}

// Registra o último acesso (uma vez por sessão)
export async function touchLogin(sb: SupabaseClient, userId: string): Promise<void> {
  try {
    await sb
      .from("profiles")
      .update({
        last_login_at: new Date().toISOString(),
        last_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      })
      .eq("id", userId);
  } catch {
    /* silencioso */
  }
}

// Assinatura em dia? (admins sempre liberados; sem perfil = liberado no modo demo)
export function isSubscriptionDenied(p: Profile | null): boolean {
  if (!p) return false;
  if (p.role === "admin") return false;
  if (p.blocked) return true;
  if (p.plan === "expired") return true;
  if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return true;
  return false;
}
