"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Droplets, LogOut, Menu, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { visibleNav } from "@/lib/nav";
import { title } from "@/lib/format";
import { api } from "@/lib/api";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  useEffect(() => {
    if (user)
      api("/api/notifications/mine/")
        .then((d) => setUnread(d.unread || 0))
        .catch(() => {});
  }, [user, path]);
  if (loading || !user)
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate">Loading your workspace…</div>;
  const groups = visibleNav(user);
  const notifHref = user.role === "CUSTOMER" ? "/portal/notifications" : "/notifications";
  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-river">
          <Droplets className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-extrabold text-white">WTR Ghana</div>
          <div className="text-[11px] text-white/60">{user.community_code || "Platform"}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g.title} className="mt-3">
            <div className="px-2 pb-1 text-[11px] font-semibold text-white/40">{g.title}</div>
            {g.items.map((i) => {
              const active = path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href));
              return (
                <Link
                  key={i.href + i.label}
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${active ? "bg-white/15 font-bold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                >
                  <i.icon className="h-4 w-4 shrink-0" />
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="truncate text-sm font-semibold text-white">{user.full_name}</div>
        <div className="truncate text-[11px] text-white/60">
          {user.role_label || title(user.role)}
          {user.community_name ? ` · ${user.community_name}` : ""}
        </div>
        <button onClick={logout} className="mt-2 flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white">
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </nav>
  );
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-64 shrink-0 bg-ink lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 bg-ink">{nav}</div>
          <div className="flex-1 bg-ink/50" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:px-6">
          <button className="rounded p-2 text-ink hover:bg-wash lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-slate lg:block">{user.community_name || "Platform administration"}</div>
          <Link href={notifHref} className="relative rounded p-2 text-ink hover:bg-wash" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-bad px-1.5 text-[10px] font-bold text-white">{unread}</span>
            )}
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
