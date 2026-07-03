import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Film, Image as ImageIcon, Video, CheckCircle2, Zap } from "lucide-react";

const Metric = ({ label, value, icon: Icon, tone }) => (
  <div className="card p-6 flex flex-col gap-3" data-testid={`metric-${label.toLowerCase().replace(/\s+/g,'-')}`}>
    <div className="flex items-center justify-between">
      <span className="badge">{label}</span>
      <Icon size={16} strokeWidth={1.5} style={{ color: tone || "var(--text-muted)" }} />
    </div>
    <div className="font-mono text-4xl" style={{ color: "var(--text-primary)" }}>{value}</div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard/stats");
      setStats(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  return (
    <div className="stagger-in" data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Pipeline overview and system status"
        right={<button onClick={load} className="btn-secondary flex items-center gap-2" data-testid="dashboard-refresh-btn">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric label="Scenes" value={stats?.scenes ?? "—"} icon={Film} tone="#9CA3AF" />
        <Metric label="Images" value={stats?.images ?? "—"} icon={ImageIcon} tone="#0055FF" />
        <Metric label="Videos" value={stats?.videos ?? "—"} icon={Video} tone="#FF3B30" />
        <Metric label="Approved" value={stats?.approved_videos ?? "—"} icon={CheckCircle2} tone="#22C55E" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6" data-testid="system-status-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg">System Status</h3>
            <span className="badge">runtime</span>
          </div>
          <div className="space-y-3 text-sm">
            <StatusRow label="Playwright browser" ok={stats?.playwright_available}
              okText="installed" failText="fallback: manual upload mode" />
            <StatusRow label="Airtable API" ok={stats?.airtable_configured}
              okText="connected" failText="using demo data · configure in Settings" />
            <StatusRow label="Active renders" ok={true} okText={`${stats?.active_renders ?? 0} running`} />
          </div>
        </div>

        <div className="card p-6" data-testid="pipeline-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg">Pipeline</h3>
            <Zap size={16} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          </div>
          <div className="space-y-4">
            <PipelineStep n="01" label="Sync scenes from Airtable" />
            <PipelineStep n="02" label="Generate images via Google Flow" />
            <PipelineStep n="03" label="Review & select images" />
            <PipelineStep n="04" label="Generate videos via Grok" />
            <PipelineStep n="05" label="Review videos & render with Remotion" />
          </div>
        </div>
      </div>
    </div>
  );
}

const StatusRow = ({ label, ok, okText, failText }) => (
  <div className="flex items-center justify-between">
    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
    <span className={"badge " + (ok ? "badge-success" : "badge-warning")}>{ok ? okText : (failText || "unavailable")}</span>
  </div>
);

const PipelineStep = ({ n, label }) => (
  <div className="flex items-center gap-4">
    <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{n}</span>
    <span className="text-sm">{label}</span>
  </div>
);
