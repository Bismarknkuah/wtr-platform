"use client";
/** Infrastructure assets & network tree (boreholes, pumps, tanks, pipelines…). */
import { useState } from "react";
import ResourcePage from "@/components/ResourcePage";
import { Badge, Button, Modal, Card } from "@/components/ui";
import { ASSET_STATUS, ASSET_TYPE } from "@/lib/options";
import { date, title } from "@/lib/format";

function Tree({ nodes, depth = 0 }: { nodes: any[]; depth?: number }) {
  return (
    <ul className={depth ? "ml-4 border-l border-line pl-3" : ""}>
      {nodes.map((n) => (
        <li key={n.id} className="py-1 text-sm">
          <span className="font-semibold">{n.name}</span>{" "}
          <span className="text-xs text-slate">
            {n.asset_id} · {title(n.type)}
          </span>{" "}
          <Badge value={n.status} className="ml-1" />
          {n.children?.length > 0 && <Tree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
export default function InfrastructurePage() {
  const [tree, setTree] = useState<any[] | null>(null);
  return (
    <>
      <ResourcePage
        endpoint="/api/assets/"
        title="Assets & network"
        subtitle="Every physical component, its upstream parent, and when it is next due for maintenance."
        createPerm="MANAGE_INFRASTRUCTURE"
        editPerm="MANAGE_INFRASTRUCTURE"
        createLabel="Add asset"
        filters={[
          { name: "asset_type", label: "Type", options: ASSET_TYPE },
          { name: "status", label: "Status", options: ASSET_STATUS },
        ]}
        headerActions={(h) => (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                setTree(await h.api("/api/assets/network/", { params: h.community ? { community: h.community } : {} }));
              } catch (e: any) {
                h.toast(e.message, "bad");
              }
            }}
          >
            Network map
          </Button>
        )}
        columns={[
          {
            key: "name",
            label: "Asset",
            render: (r) => (
              <div>
                <b>{r.name}</b>
                <div className="text-xs text-slate">
                  {r.asset_id} · {title(r.asset_type)}
                  {r.capacity ? ` · ${r.capacity}` : ""}
                </div>
              </div>
            ),
          },
          { key: "parent_name", label: "Upstream", render: (r) => r.parent_name || "—" },
          { key: "installed_on", label: "Installed", render: (r) => date(r.installed_on) },
          {
            key: "next_maintenance",
            label: "Next maintenance",
            render: (r) => (
              <span
                className={
                  r.maintenance_due_in_days != null && r.maintenance_due_in_days < 0
                    ? "font-bold text-bad"
                    : r.maintenance_due_in_days != null && r.maintenance_due_in_days <= 14
                      ? "font-bold text-warn"
                      : ""
                }
              >
                {date(r.next_maintenance)}
                {r.maintenance_due_in_days != null && (
                  <span className="ml-1 text-xs">
                    ({r.maintenance_due_in_days < 0 ? `${-r.maintenance_due_in_days}d overdue` : `${r.maintenance_due_in_days}d`})
                  </span>
                )}
              </span>
            ),
          },
          { key: "latitude", label: "GPS", render: (r) => (r.latitude ? `${r.latitude}, ${r.longitude}` : "—") },
          { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
        ]}
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "asset_type", label: "Type", type: "select", options: ASSET_TYPE, required: true },
          {
            name: "parent",
            label: "Upstream asset",
            type: "lookup",
            lookup: { endpoint: "/api/assets/", labelKey: (r: any) => `${r.name} (${r.asset_id})` },
          },
          { name: "status", label: "Status", type: "select", options: ASSET_STATUS, defaultValue: "OPERATIONAL" },
          { name: "capacity", label: "Capacity", hint: "50 m³, 5 kW, 3 L/s…" },
          { name: "manufacturer", label: "Manufacturer" },
          { name: "serial_number", label: "Serial number" },
          { name: "installed_on", label: "Installed on", type: "date" },
          { name: "warranty_expiry", label: "Warranty expiry", type: "date" },
          { name: "maintenance_interval_days", label: "Maintenance interval (days)", type: "number", defaultValue: 90 },
          { name: "next_maintenance", label: "Next maintenance", type: "date" },
          { name: "latitude", label: "Latitude", type: "number", step: "0.000001" },
          { name: "longitude", label: "Longitude", type: "number", step: "0.000001" },
          { name: "notes", label: "Notes", type: "textarea", span: 2 },
        ]}
      />
      <Modal open={!!tree} onClose={() => setTree(null)} title="Network hierarchy" wide>
        {tree && (tree.length ? <Tree nodes={tree} /> : <div className="text-sm text-slate">No assets yet.</div>)}
        <p className="mt-4 text-xs text-slate">Phase 2: GIS map view (PostGIS + Leaflet) using the coordinates already captured here.</p>
      </Modal>
    </>
  );
}
