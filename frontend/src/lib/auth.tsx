"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./api";

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  community: number | null;
  community_name?: string;
  community_code?: string;
  permissions: string[];
  community_flags?: Record<string, boolean>;
  custom_role?: number | null;
  custom_role_name?: string | null;
  role_label?: string;
  customer_id?: number | null;
};
type Ctx = {
  user: User | null;
  loading: boolean;
  can: (p: string | string[]) => boolean;
  refresh: () => Promise<void>;
  logout: () => void;
  isPlatform: boolean;
};
const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  can: () => false,
  refresh: async () => {},
  logout: () => {},
  isPlatform: false,
});

export const PLATFORM_ROLES = ["PLATFORM_SUPER_ADMIN", "PLATFORM_OPERATIONS_ADMIN"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    const cached = auth.cachedUser();
    if (cached) setUser(cached);
    if (auth.hasToken())
      auth
        .me()
        .then(setUser)
        .catch(() => {
          auth.logout();
          setUser(null);
        })
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const can = (p: string | string[]) => {
    if (!user) return false;
    const list = Array.isArray(p) ? p : [p];
    return list.some((x) => user.permissions?.includes(x));
  };
  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        can,
        isPlatform: !!user && PLATFORM_ROLES.includes(user.role),
        refresh: async () => setUser(await auth.me()),
        logout: () => {
          auth.logout();
          setUser(null);
          router.push("/login");
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
export const useAuth = () => useContext(AuthCtx);
