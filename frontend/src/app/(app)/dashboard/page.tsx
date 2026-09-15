"use client";
/** Role router: sends each user to the dashboard file for their role. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DASHBOARD_BY_ROLE } from "@/lib/nav";
export default function DashboardRouter() {
  const { user } = useAuth();
  const r = useRouter();
  useEffect(() => {
    if (user) r.replace(DASHBOARD_BY_ROLE[user.role] || "/dashboard/community");
  }, [user, r]);
  return null;
}
