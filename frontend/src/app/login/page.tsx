"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Droplets, ChevronDown, ChevronUp, LogIn } from "lucide-react";
import { auth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Field, Input } from "@/components/ui";
import { DEMO_ACCOUNTS, DemoAccount } from "@/lib/demo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | boolean>(false);
  const [showDemo, setShowDemo] = useState(true);
  const router = useRouter();
  const { refresh } = useAuth();
  const doLogin = async (e: string, p: string, key: string | boolean = true) => {
    setBusy(key);
    setErr("");
    try {
      await auth.login(e.trim(), p);
      await refresh();
      router.replace("/dashboard");
    } catch (ex: any) {
      setErr(
        ex.status === 401
          ? `Email or password is incorrect.${key !== true ? " Run `python manage.py seed_demo` on the backend to create the demo accounts." : ""}`
          : ex.message,
      );
      setBusy(false);
    }
  };
  const submit = (e: any) => {
    e.preventDefault();
    doLogin(email, password);
  };
  const groups = ["Platform", "Community staff", "Household"] as const;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-river">
            <Droplets className="h-6 w-6" />
          </div>
          <span className="text-lg font-extrabold">WTR Ghana</span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight">Every drop metered. Every cedi accounted for.</h1>
          <p className="mt-4 text-white/70">
            Meter → Reading → Consumption → Tariff → Bill → Payment → Receipt → Ledger. One platform for every community water system, with
            each community fully isolated.
          </p>
        </div>
        <div className="text-xs text-white/40">
          Community Water Management Platform ·{" "}
          <Link href="/" className="underline">
            About
          </Link>
        </div>
      </div>
      <div className="flex items-start justify-center overflow-y-auto p-6 lg:items-center">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-river">
                <Droplets className="h-5 w-5 text-white" />
              </div>
              <span className="font-extrabold">WTR Ghana</span>
            </Link>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-2xl font-extrabold">Sign in</h2>
            <Field label="Email">
              <Input type="email" autoComplete="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                required
              />
            </Field>
            {err && <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
            <Button type="submit" size="lg" className="w-full" loading={busy === true}>
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
            <p className="text-xs text-slate">
              Staff accounts are created by your community admin. Households get portal access from the community office.
            </p>
          </form>
          <div className="rounded-lg border border-line bg-white shadow-card">
            <button
              type="button"
              onClick={() => setShowDemo(!showDemo)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span>
                <span className="text-sm font-bold text-ink">Quick access</span>
                <span className="ml-2 text-xs text-slate">one tap into any role</span>
              </span>
              {showDemo ? <ChevronUp className="h-4 w-4 text-slate" /> : <ChevronDown className="h-4 w-4 text-slate" />}
            </button>
            {showDemo && (
              <div className="border-t border-line px-4 pb-4">
                {groups.map((g) => (
                  <div key={g} className="mt-3">
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-light">{g}</div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {DEMO_ACCOUNTS.filter((a) => a.group === g).map((a: DemoAccount) => (
                        <button
                          key={a.email}
                          type="button"
                          disabled={!!busy}
                          onClick={() => {
                            setEmail(a.email);
                            setPassword(a.password);
                            doLogin(a.email, a.password, a.email);
                          }}
                          className={`rounded-md border border-line px-3 py-2 text-left transition hover:border-river hover:bg-river-soft disabled:opacity-50 ${busy === a.email ? "border-river bg-river-soft" : ""}`}
                        >
                          <div className="text-sm font-semibold text-ink">{a.label}</div>
                          <div className="truncate text-[11px] text-slate">{busy === a.email ? "Signing in…" : a.blurb}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="mt-3 text-[11px] text-slate">
                  Demo accounts come from <code>python manage.py seed_demo</code> on the backend. Each button signs you straight in.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
