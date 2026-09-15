/** Thin fetch client: bearer auth, automatic token refresh, JSON errors surfaced as ApiError. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(ApiError.describe(data, status));
    this.status = status;
    this.data = data;
  }
  static describe(data: any, status: number): string {
    if (!data) return `Request failed (${status})`;
    if (typeof data === "string") return data;
    if (data.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    const parts = Object.entries(data).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : v}`,
    );
    return parts.join(" · ") || `Request failed (${status})`;
  }
}

const store = {
  get access() {
    return typeof window === "undefined" ? null : localStorage.getItem("wtr_access");
  },
  get refresh() {
    return typeof window === "undefined" ? null : localStorage.getItem("wtr_refresh");
  },
  set(access: string, refresh?: string) {
    localStorage.setItem("wtr_access", access);
    if (refresh) localStorage.setItem("wtr_refresh", refresh);
  },
  clear() {
    localStorage.removeItem("wtr_access");
    localStorage.removeItem("wtr_refresh");
    localStorage.removeItem("wtr_user");
  },
};

let refreshing: Promise<boolean> | null = null;
async function refreshToken(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const r = store.refresh;
      if (!r) return false;
      const res = await fetch(`${API_URL}/api/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: r }),
      });
      if (!res.ok) {
        store.clear();
        return false;
      }
      const d = await res.json();
      store.set(d.access, d.refresh);
      return true;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; form?: FormData; params?: Record<string, any> } = {},
): Promise<T> {
  const url = new URL(`${API_URL}${path.startsWith("/") ? path : "/" + path}`);
  if (opts.params)
    Object.entries(opts.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  const run = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!opts.form) headers["Content-Type"] = "application/json";
    const t = store.access;
    if (t) headers.Authorization = `Bearer ${t}`;
    return fetch(url.toString(), {
      method: opts.method || (opts.body || opts.form ? "POST" : "GET"),
      headers,
      body: opts.form ? opts.form : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };
  let res = await run();
  if (res.status === 401 && store.refresh && !path.includes("/auth/login")) {
    if (await refreshToken()) res = await run();
    else {
      if (typeof window !== "undefined") window.location.href = "/login";
    }
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const auth = {
  async login(email: string, password: string) {
    const d = await api("/api/auth/login/", { body: { email, password } });
    store.set(d.access, d.refresh);
    localStorage.setItem("wtr_user", JSON.stringify(d.user));
    return d.user;
  },
  logout() {
    store.clear();
  },
  cachedUser(): any | null {
    if (typeof window === "undefined") return null;
    const u = localStorage.getItem("wtr_user");
    return u ? JSON.parse(u) : null;
  },
  async me() {
    const u = await api("/api/auth/me/");
    localStorage.setItem("wtr_user", JSON.stringify(u));
    return u;
  },
  hasToken() {
    return !!store.access;
  },
};
