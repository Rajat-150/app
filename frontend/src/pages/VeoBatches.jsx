import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Download, ExternalLink } from "lucide-react";

export default function VeoBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/veo/batches");
      setBatches(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []);

  const backend = process.env.REACT_APP_BACKEND_URL || "";

  return (
    <div className="stagger-in" data-testid="veo-batches-page">
      <PageHeader
        title="VEO Batches"
        subtitle="Prompt batches exported to the VEO Automation extension — watch images arrive in real time"
        right={<button onClick={load} className="btn-secondary flex items-center gap-2" data-testid="veo-refresh-btn">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Reload
        </button>}
      />

      <div className="card p-5 mb-4" data-testid="veo-instructions-card">
        <h3 className="font-display text-lg mb-3">How it works</h3>
        <ol className="space-y-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li><span className="badge mr-2">01</span> On the Scenes page, select N scenes → click <span className="font-mono">Export to VEO</span></li>
          <li><span className="badge mr-2">02</span> A .txt file downloads to your laptop</li>
          <li><span className="badge mr-2">03</span> Open the noVNC desktop (Browser Login page). Open Chrome → labs.google/fx/tools/flow</li>
          <li><span className="badge mr-2">04</span> Drag the .txt file into the noVNC window OR upload it via VEO Automation</li>
          <li><span className="badge mr-2">05</span> Click extension icon → <span className="font-mono">Text-to-Image</span> mode → Upload the .txt → click Run</li>
          <li><span className="badge mr-2">06</span> Images download into <span className="font-mono">/data/downloads</span> — this page updates automatically</li>
        </ol>
      </div>

      <div className="card overflow-hidden" data-testid="veo-batches-table">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Batch</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Created</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Progress</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Status</th>
              <th className="text-right px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Download</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }} data-testid="veo-empty">
                No batches yet. Export one from the Scenes page.
              </td></tr>
            )}
            {batches.map((b) => {
              const total = b.items?.length || 0;
              const consumed = b.consumed || 0;
              const pct = total ? Math.round((consumed / total) * 100) : 0;
              return (
                <tr key={b.id} style={{ borderBottom: "1px solid var(--border-subtle)" }} data-testid={`veo-batch-row-${b.id.slice(0,8)}`}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-primary)" }}>{b.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{new Date(b.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 w-64">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width 300ms ease" }} />
                      </div>
                      <span className="font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{consumed} / {total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"badge " + (b.status === "complete" ? "badge-success" : "badge-warning")}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`${backend}/api/veo/batches/${b.id}/download`} className="btn-ghost inline-flex items-center gap-1" data-testid={`veo-download-btn-${b.id.slice(0,8)}`}>
                      <Download size={13} /> .txt
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
