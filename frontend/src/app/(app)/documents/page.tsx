"use client";
/** Documents — upload a file or link an external one (Drive/S3 recommended on Railway's ephemeral disk). */
import { useState } from "react";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Checkbox, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { LookupSelect } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { DOC_CATEGORY } from "@/lib/options";
import { datetime, title } from "@/lib/format";
export default function DocumentsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ category: "OTHER" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState<() => void>(() => () => {});
  const save = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      if (file) fd.append("file", file);
      await api("/api/documents/", { form: fd });
      push("Document saved");
      setOpen(false);
      setFile(null);
      reload();
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ResourcePage
        endpoint="/api/documents/"
        title="Documents"
        subtitle="Agreements, connection forms, installation and quality reports, notices, policies."
        ordering="-created_at"
        deletePerm="MANAGE_DOCUMENTS"
        filters={[{ name: "category", label: "Category", options: DOC_CATEGORY }]}
        headerActions={(h) => {
          setReload(() => h.reload);
          return can("MANAGE_DOCUMENTS") ? (
            <Button
              onClick={() => {
                setF({ category: "OTHER", community: h.community });
                setOpen(true);
              }}
            >
              Add document
            </Button>
          ) : null;
        }}
        columns={[
          {
            key: "title",
            label: "Document",
            render: (r) => (
              <div>
                <a href={r.url || r.external_url} target="_blank" rel="noreferrer" className="font-semibold text-river">
                  {r.title}
                </a>
                <div className="text-xs text-slate">{r.description}</div>
              </div>
            ),
          },
          { key: "category", label: "Category", render: (r) => <Badge value={r.category} /> },
          { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "—" },
          {
            key: "uploaded_by_name",
            label: "By",
            render: (r) => (
              <div>
                {r.uploaded_by_name}
                <div className="text-xs text-slate">{datetime(r.created_at)}</div>
              </div>
            ),
          },
          { key: "is_public_to_customer", label: "Visible to customer", render: (r) => (r.is_public_to_customer ? "Yes" : "No") },
        ]}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Add document">
        <form className="space-y-3" onSubmit={save}>
          <Field label="Title *">
            <Input required value={f.title || ""} onChange={(e: any) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>
                {DOC_CATEGORY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer (optional)">
              <LookupSelect
                f={{
                  name: "customer",
                  label: "",
                  type: "lookup",
                  lookup: { endpoint: "/api/customers/", labelKey: (r: any) => `${r.household_name} · ${r.customer_id}` },
                }}
                value={f.customer}
                onChange={(v) => setF({ ...f, customer: v })}
                community={f.community || ""}
              />
            </Field>
          </div>
          <Field label="Upload file">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          </Field>
          <Field
            label="…or external link"
            hint="Google Drive / S3 / Cloudinary link — recommended for production, since Railway's disk is not permanent"
          >
            <Input type="url" value={f.external_url || ""} onChange={(e: any) => setF({ ...f, external_url: e.target.value })} />
          </Field>
          <Field label="Description">
            <Input value={f.description || ""} onChange={(e: any) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Checkbox
            label="Visible to the customer in their portal"
            checked={!!f.is_public_to_customer}
            onChange={(e: any) => setF({ ...f, is_public_to_customer: e.target.checked })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
