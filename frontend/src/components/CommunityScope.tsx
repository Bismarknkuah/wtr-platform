"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Select } from "@/components/ui";

/**
 * Community scope. Every staff member is locked to their own community; platform staff have no
 * community at all (they never see tenant data), so `community` is empty for them and tenant
 * pages are hidden from their navigation. Kept as a hook so pages have one place to ask
 * "which community am I in?".
 */
export function useCommunityScope() {
  const { user, isPlatform } = useAuth();
  const [community, setCommunityState] = useState<string>("");
  useEffect(() => {
    if (isPlatform) setCommunityState(localStorage.getItem("wtr_community") || "");
  }, [isPlatform]);
  const setCommunity = (v: string) => {
    setCommunityState(v);
    localStorage.setItem("wtr_community", v);
  };
  return { community: isPlatform ? community : String(user?.community || ""), setCommunity, isPlatform };
}

export function CommunityPicker({ value, onChange, allowAll }: { value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    api("/api/communities/", { params: { page_size: 200 } })
      .then((d) => setList(d.results || d))
      .catch(() => {});
  }, []);
  return (
    <Select value={value} onChange={(e: any) => onChange(e.target.value)} className="!w-auto min-w-[220px]">
      <option value="">{allowAll ? "All communities" : "Select a community…"}</option>
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} · {c.code}
        </option>
      ))}
    </Select>
  );
}
