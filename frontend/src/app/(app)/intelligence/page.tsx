"use client";
/** Water intelligence — natural-language questions answered from live data (rule-based; optional Claude narration when ANTHROPIC_API_KEY is set on the server). */
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCommunityScope, CommunityPicker } from "@/components/CommunityScope";
import { Button, Card, Input, PageHeader, Table, Checkbox } from "@/components/ui";
const SUGGEST = [
  "Which communities have the highest water losses?",
  "Which households have abnormal consumption?",
  "Which pumps are likely to fail soon?",
  "Why did revenue decline this month?",
  "Which customers have the highest outstanding bills?",
  "Predict next month's water demand",
];
export default function IntelligencePage() {
  const { isPlatform } = useAuth();
  const { community, setCommunity } = useCommunityScope();
  const [q, setQ] = useState("");
  const [narrate, setNarrate] = useState(true);
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ask = async (question: string) => {
    setQ(question);
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      setRes(await api("/api/analytics/intelligence/", { body: { question, narrate, ...(isPlatform && community ? { community } : {}) } }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const cols = res?.data?.length
    ? Object.keys(res.data[0]).map((k) => ({
        key: k,
        label: k.replace(/_/g, " "),
        render: (r: any) =>
          Array.isArray(r[k]) ? r[k].join(", ") : typeof r[k] === "object" && r[k] ? JSON.stringify(r[k]) : String(r[k] ?? "—"),
      }))
    : [];
  return (
    <div>
      <PageHeader
        title="Water intelligence"
        subtitle="Ask questions in plain English. Answers come from your live meter, billing and infrastructure data."
        actions={isPlatform ? <CommunityPicker value={community} onChange={setCommunity} allowAll /> : undefined}
      />
      <Card className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) ask(q);
          }}
          className="flex gap-2"
        >
          <Input value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="e.g. Which households have abnormal consumption?" />
          <Button type="submit" loading={busy}>
            <Sparkles className="h-4 w-4" />
            Ask
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGEST.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-wash">
              {s}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Checkbox
            label="Add an AI-written insight (needs ANTHROPIC_API_KEY on the server)"
            checked={narrate}
            onChange={(e: any) => setNarrate(e.target.checked)}
          />
        </div>
      </Card>
      {err && <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
      {res && (
        <Card title="Answer">
          <p className="text-base font-semibold">{res.answer}</p>
          {res.narrative && <p className="mt-2 rounded-md bg-river-soft p-3 text-sm">{res.narrative}</p>}
          {res.data?.length > 0 && (
            <div className="mt-4">
              <Table rows={res.data.map((r: any, i: number) => ({ id: i, ...r }))} columns={cols} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
