import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CalendarPlus,
  CircleCheck,
  CircleDollarSign,
  Copy,
  Database,
  Lock,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchProfile, type Payment, type Profile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel Admin — ELL MUSIC" }],
  }),
  component: AdminPage,
});

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function PlanBadge({ p }: { p: Profile }) {
  const expired =
    p.plan === "expired" || (p.expires_at && new Date(p.expires_at).getTime() < Date.now());
  const cls = p.blocked
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : expired
      ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
      : p.plan === "active"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-sky-500/10 text-sky-300 border-sky-500/30";
  const label = p.blocked ? "Bloqueado" : expired ? "Expirado" : p.plan === "active" ? "Ativo" : "Trial";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{label}</span>
  );
}

function SetupNotice() {
  const sqlText =
    "update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'SEU_EMAIL');";
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-3xl glass p-6 border border-border/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database className="size-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold">Configurar o Painel Admin</h1>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>
            Crie um projeto gratuito em{" "}
            <span className="text-primary">supabase.com</span> (Database → copie a URL e a anon key)
          </li>
          <li>
            Preencha <code className="text-foreground">VITE_SUPABASE_URL</code> e{" "}
            <code className="text-foreground">VITE_SUPABASE_ANON_KEY</code> no arquivo{" "}
            <code className="text-foreground">.env</code>
          </li>
          <li>
            Abra o SQL Editor do Supabase e execute o arquivo{" "}
            <code className="text-foreground">supabase/admin-setup.sql</code> deste projeto
          </li>
          <li>Cadastre seu usuário pelo app e rode o comando abaixo para virar admin:</li>
        </ol>
        <div className="flex items-center gap-2 rounded-xl bg-accent/40 p-3">
          <code className="text-[10px] sm:text-xs text-foreground flex-1 break-all">{sqlText}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(sqlText);
              toast.success("Comando copiado");
            }}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-primary pt-2">
          ← Voltar ao app
        </Link>
      </div>
    </div>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [tab, setTab] = useState<"users" | "payments">("users");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
      setAuthReady(true);
    });
  }, []);

  const meQuery = useQuery({
    queryKey: ["admin-me", user?.id],
    queryFn: () => fetchProfile(supabase!, user!.id),
    enabled: !!user && isSupabaseConfigured,
  });

  const isAdmin = meQuery.data?.role === "admin";

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("payments")
        .select("*")
        .order("paid_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Payment[];
    },
    enabled: isAdmin,
  });

  const users = usersQuery.data ?? [];
  const stats = useMemo(() => {
    const now = Date.now();
    const active = users.filter(
      (u) =>
        !u.blocked &&
        u.plan !== "expired" &&
        (!u.expires_at || new Date(u.expires_at).getTime() > now),
    );
    const revenueCents = active.reduce((s, u) => s + u.price_cents, 0);
    return {
      total: users.length,
      active: active.length,
      blocked: users.filter((u) => u.blocked).length,
      revenueCents,
    };
  }, [users]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const updateProfile = async (id: string, patch: Partial<Profile>, okMsg?: string) => {
    const { error } = await supabase!.from("profiles").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (okMsg) toast.success(okMsg);
    refresh();
  };

  const addDays = async (u: Profile, days: number) => {
    const base = u.expires_at && new Date(u.expires_at).getTime() > Date.now()
      ? new Date(u.expires_at)
      : new Date();
    base.setDate(base.getDate() + days);
    await updateProfile(u.id, { plan: "active", expires_at: base.toISOString() }, `+${days} dias para ${u.display_name || u.place_name}`);
  };

  const registerPayment = async (u: Profile) => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { error } = await supabase!.from("payments").insert({
      user_id: u.id,
      amount_cents: u.price_cents,
      reference_month: month,
      note: "",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const base = u.expires_at && new Date(u.expires_at).getTime() > Date.now()
      ? new Date(u.expires_at)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    base.setDate(base.getDate() + 30);
    await updateProfile(
      u.id,
      { plan: "active", blocked: false, expires_at: base.toISOString() },
      `Pagamento de ${brl(u.price_cents)} registrado`,
    );
  };

  // ---------- Estados de bloqueio ----------
  if (!isSupabaseConfigured) return <SetupNotice />;
  if (!authReady) {
    return <div className="min-h-[100dvh] bg-background" />;
  }
  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground font-sans flex items-center justify-center p-4">
        <div className="max-w-sm w-full rounded-3xl glass p-6 border border-border/30 text-center space-y-4">
          <Lock className="size-8 text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Entre com uma conta de admin no app.</p>
          <Link to="/">
            <Button className="rounded-full bg-primary text-primary-foreground text-xs shadow-glow">
              Ir para o login
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  if (meQuery.isLoading) {
    return <div className="min-h-[100dvh] bg-background" />;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground font-sans flex items-center justify-center p-4">
        <div className="max-w-sm w-full rounded-3xl glass p-6 border border-border/30 text-center space-y-4">
          <ShieldCheck className="size-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
          <Link to="/" className="text-xs text-primary hover:underline">
            ← Voltar ao app
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Painel ----------
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <header className="sticky top-0 z-40 bg-player-gradient border-b border-border/30 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-full hover:bg-accent/50 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h1 className="text-base font-bold">Painel Admin</h1>
          </div>
        </div>
        <div className="flex rounded-full glass border border-border/30 p-1 text-xs font-semibold">
          <button
            onClick={() => setTab("users")}
            className={`px-3 py-1.5 rounded-full transition-all ${tab === "users" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
          >
            Usuários
          </button>
          <button
            onClick={() => setTab("payments")}
            className={`px-3 py-1.5 rounded-full transition-all ${tab === "payments" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
          >
            Pagamentos
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Usuários", value: String(stats.total) },
            { icon: CircleCheck, label: "Assinaturas ativas", value: String(stats.active) },
            { icon: Ban, label: "Bloqueados", value: String(stats.blocked) },
            { icon: CircleDollarSign, label: "Receita/mês", value: brl(stats.revenueCents) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl glass p-4 border border-border/30">
              <Icon className="size-4 text-primary mb-2" />
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>

        {tab === "users" && (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="rounded-2xl glass p-4 border border-border/30 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm truncate">
                        {u.display_name || "(sem nome)"}
                      </p>
                      <PlanBadge p={u} />
                      {u.role === "admin" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {u.id === user.id ? "você · " : ""}
                      criado em {dateLabel(u.created_at)}
                      {u.last_login_at ? ` · último acesso ${dateLabel(u.last_login_at)}` : ""}
                      {u.last_timezone ? ` · ${u.last_timezone}` : ""}
                    </p>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    Vence: <span className="text-foreground">{dateLabel(u.expires_at)}</span> ·{" "}
                    {brl(u.price_cents)}
                  </p>
                </div>

                {/* Local / estabelecimento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      defaultValue={u.place_name}
                      placeholder="Nome do local (ex.: Bar do João)"
                      className="pl-9 text-xs bg-accent/40 border-border/30"
                      onBlur={(e) => {
                        if (e.target.value !== u.place_name)
                          void updateProfile(u.id, { place_name: e.target.value }, "Local atualizado");
                      }}
                    />
                  </div>
                  <Input
                    defaultValue={u.place_address}
                    placeholder="Endereço do local"
                    className="text-xs bg-accent/40 border-border/30"
                    onBlur={(e) => {
                      if (e.target.value !== u.place_address)
                        void updateProfile(u.id, { place_address: e.target.value }, "Endereço atualizado");
                    }}
                  />
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void addDays(u, 30)}
                    variant="outline"
                    className="h-7 px-3 text-[11px] rounded-full border-border/30 glass hover:bg-accent/50"
                  >
                    <CalendarPlus className="size-3 mr-1" /> +30 dias
                  </Button>
                  <Button
                    onClick={() =>
                      void updateProfile(u.id, { plan: "active", expires_at: null, blocked: false }, "Assinatura ativada sem prazo")
                    }
                    variant="outline"
                    className="h-7 px-3 text-[11px] rounded-full border-primary/30 text-primary hover:bg-primary/10"
                  >
                    Liberar sem prazo
                  </Button>
                  <Button
                    onClick={() =>
                      void updateProfile(u.id, { plan: "expired" }, "Assinatura revogada")
                    }
                    variant="outline"
                    className="h-7 px-3 text-[11px] rounded-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                  >
                    Revogar acesso
                  </Button>
                  <Button
                    onClick={() =>
                      void updateProfile(
                        u.id,
                        { blocked: !u.blocked },
                        u.blocked ? "Usuário desbloqueado" : "Usuário bloqueado",
                      )
                    }
                    variant="outline"
                    className={`h-7 px-3 text-[11px] rounded-full ${
                      u.blocked
                        ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        : "border-destructive/30 text-destructive hover:bg-destructive/10"
                    }`}
                  >
                    <Ban className="size-3 mr-1" />
                    {u.blocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Button
                    onClick={() => void registerPayment(u)}
                    variant="outline"
                    className="h-7 px-3 text-[11px] rounded-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CircleDollarSign className="size-3 mr-1" /> Receber {brl(u.price_cents)}
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                Nenhum usuário cadastrado ainda.
              </p>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="rounded-2xl glass border border-border/30 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left px-4 py-3 font-semibold">Data</th>
                  <th className="text-left px-4 py-3 font-semibold">Usuário</th>
                  <th className="text-left px-4 py-3 font-semibold">Ref.</th>
                  <th className="text-right px-4 py-3 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(paymentsQuery.data ?? []).map((pay) => {
                  const u = users.find((x) => x.id === pay.user_id);
                  return (
                    <tr key={pay.id} className="border-b border-border/20 last:border-0">
                      <td className="px-4 py-2.5">{new Date(pay.paid_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2.5 truncate max-w-[180px]">
                        {u?.display_name || u?.place_name || pay.user_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(pay.reference_month + "T12:00:00").toLocaleDateString("pt-BR", {
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                        {brl(pay.amount_cents)}
                      </td>
                    </tr>
                  );
                })}
                {(paymentsQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-10">
                      Nenhum pagamento registrado ainda. Use "Receber" na aba Usuários.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
