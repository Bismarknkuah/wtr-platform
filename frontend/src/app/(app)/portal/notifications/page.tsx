"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";
import { datetime } from "@/lib/format";
export default function PortalNotifications() {
  const [d, setD] = useState<any>(null);
  const load = () =>
    api("/api/notifications/mine/")
      .then(setD)
      .catch(() => setD({ results: [], unread: 0 }));
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={d ? `${d.unread} unread` : undefined}
        actions={
          d?.unread > 0 ? (
            <Button
              variant="secondary"
              onClick={async () => {
                await api("/api/notifications/mark_read/", { body: {} });
                load();
              }}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />
      <Card>
        {!d ? (
          <Spinner />
        ) : d.results.length ? (
          <ul className="divide-y divide-line/60">
            {d.results.map((n: any) => (
              <li key={n.id} className={`py-3 ${n.is_read ? "" : "font-semibold"}`}>
                <div className="flex items-center justify-between">
                  <span>
                    {n.title} <Badge value={n.event} className="ml-1" />
                  </span>
                  <span className="text-xs text-slate">{datetime(n.created_at)}</span>
                </div>
                <p className="mt-1 text-sm font-normal text-slate">{n.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center text-sm text-slate">Nothing yet.</div>
        )}
      </Card>
    </div>
  );
}
