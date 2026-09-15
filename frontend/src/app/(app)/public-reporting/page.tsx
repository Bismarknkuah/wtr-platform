"use client";
/**
 * Public reporting link & QR code (Water Manager / Community Admin / Support).
 *
 * Generates the community's public link, renders it as a QR code, and offers a printable A4
 * poster ("Scan to report a water problem"). Regenerating the link invalidates every poster
 * printed with the old one.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer, QrCode, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, PageHeader, Spinner, useToast } from "@/components/ui";

export default function PublicReportingPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [png, setPng] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = () =>
    api("/api/public-report-link/")
      .then(setD)
      .catch((e) => push(e.message, "bad"));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!d?.url) return;
    QRCode.toDataURL(d.url, { width: 640, margin: 2, color: { dark: "#10243A", light: "#FFFFFF" } }).then(setPng);
  }, [d?.url]);

  const regenerate = async () => {
    if (!window.confirm("Regenerate the link? Every poster or message with the old link will stop working.")) return;
    setBusy(true);
    try {
      const r = await api("/api/public-report-link/", { method: "POST" });
      setD(r);
      push("New link generated. Print new posters.");
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(d.url);
    push("Link copied");
  };

  const printPoster = () => {
    const w = window.open("", "_blank", "width=800,height=1100");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Report a water problem — ${d.community}</title>
      <style>body{font-family:system-ui,sans-serif;margin:0;padding:40px;text-align:center;color:#10243A}
      h1{font-size:44px;margin:0 0 8px}h2{font-size:22px;font-weight:600;color:#4A5B6B;margin:0 0 30px}
      img{width:420px;height:420px}.url{font-size:20px;margin-top:24px;word-break:break-all;color:#1D6FA5}
      .steps{margin-top:30px;font-size:18px;text-align:left;display:inline-block}.steps li{margin:6px 0}
      .foot{margin-top:40px;font-size:14px;color:#7A8A99}@media print{body{padding:20px}}</style></head><body>
      <h1>Water problem? Scan to report it.</h1><h2>${d.community} community water system</h2>
      <img src="${png}" alt="QR code"/><div class="url">${d.url}</div>
      <ol class="steps"><li>Open your phone camera and point it at the code</li><li>Tap the link that appears</li><li>Choose the problem, the town and describe it — 1 minute</li><li>You get a reference number; the office is notified instantly</li></ol>
      <div class="foot">Leaks · No water · Low pressure · Dirty water · Meter faults · Illegal connections — no account needed.</div>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  if (!d) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Public reporting link & QR code"
        subtitle="Put this on posters, standpipes, the chief's palace, church notice boards — anyone can report a problem in under a minute, no account needed."
        actions={
          <Button variant="secondary" onClick={regenerate} loading={busy}>
            <RefreshCw className="h-4 w-4" />
            Regenerate link
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-3">
            {png ? (
              <img src={png} alt="QR code for public reporting" className="h-64 w-64 rounded-md ring-1 ring-line" />
            ) : (
              <div className="grid h-64 w-64 place-items-center text-slate">
                <QrCode className="h-10 w-10" />
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <a href={png} download={`report-qr-${user?.community_code || "community"}.png`}>
                <Button size="sm" variant="secondary">
                  <Download className="h-4 w-4" />
                  Download PNG
                </Button>
              </a>
              <Button size="sm" variant="secondary" onClick={printPoster}>
                <Printer className="h-4 w-4" />
                Print A4 poster
              </Button>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Public link">
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-wash px-3 py-2 text-sm">{d.url}</code>
              <Button size="sm" variant="secondary" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <a href={d.url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </a>
            </div>
            <p className="mt-2 text-xs text-slate">
              Share it on WhatsApp groups and community radio too. Reports arrive in Service requests marked “Public link / QR”, tagged with
              the town, and the on-duty staff get a notification.
            </p>
          </Card>
          <Card title="What the public sees">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate">
              <li>
                The community name and the problem types: no water, leak, low pressure, dirty water, meter fault, illegal connection, other.
              </li>
              <li>
                A town picker ({d.towns.length} town{d.towns.length === 1 ? "" : "s"} configured under My community → Towns), a landmark
                field and a one-tap “use my location”.
              </li>
              <li>A description, and optionally their name and phone — a known phone number links the report to the water account.</li>
              <li>A reference number on submission. Rate-limited to stop abuse; regenerate the link if it leaks.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
