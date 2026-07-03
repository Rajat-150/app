import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { ExternalLink, Monitor } from "lucide-react";

const Kv = ({ k, v, mono, testId }) => (
  <div className="flex items-start justify-between py-3 border-b" style={{ borderColor: "var(--border-subtle)" }} data-testid={testId}>
    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{k}</span>
    <span className={"text-sm text-right " + (mono ? "font-mono" : "")} style={{ color: "var(--text-primary)" }}>{v}</span>
  </div>
);

export default function Settings() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.get("/config").then((r) => setConfig(r.data));
  }, []);

  const flow = process.env.REACT_APP_BACKEND_URL || "";

  return (
    <div className="stagger-in" data-testid="settings-page">
      <PageHeader title="Settings" subtitle="Environment configuration — edit .env on your VPS and restart the backend to apply" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6" data-testid="settings-airtable-card">
          <h3 className="font-display text-lg mb-3">Airtable</h3>
          {config && <>
            <Kv k="Status" v={<span className={"badge " + (config.airtable.configured ? "badge-success" : "badge-warning")}>{config.airtable.configured ? "connected" : "using demo data"}</span>} testId="settings-airtable-status" />
            <Kv k="Base ID" v={config.airtable.base_id} mono testId="settings-airtable-base" />
            <Kv k="Table" v={config.airtable.table_name} mono testId="settings-airtable-table" />
          </>}
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            Edit <span className="font-mono">AIRTABLE_API_KEY</span>, <span className="font-mono">AIRTABLE_BASE_ID</span>, <span className="font-mono">AIRTABLE_TABLE_NAME</span> in <span className="font-mono">backend/.env</span>.
          </p>
        </div>

        <div className="card p-6" data-testid="settings-browser-card">
          <h3 className="font-display text-lg mb-3">Browser Automation</h3>
          {config && <>
            <Kv k="Playwright" v={<span className={"badge " + (config.browser.playwright_available ? "badge-success" : "badge-warning")}>{config.browser.playwright_available ? "ready" : "not installed (manual mode)"}</span>} testId="settings-browser-playwright" />
            <Kv k="Profile dir" v={config.browser.profile_dir} mono testId="settings-browser-profile" />
            <Kv k="Google Flow URL" v={<a href={config.browser.google_flow_url} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--accent)" }}>open ↗</a>} testId="settings-browser-flow-url" />
            <Kv k="Grok URL" v={<a href={config.browser.grok_url} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--accent)" }}>open ↗</a>} testId="settings-browser-grok-url" />
          </>}
          <div className="mt-4">
            {config?.browser.novnc_url && (
              <a href={config.browser.novnc_url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2" data-testid="settings-open-novnc-btn">
                <Monitor size={14} /> Open noVNC session <ExternalLink size={12} />
              </a>
            )}
          </div>
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            One-time login: open noVNC on your VPS, log into Google Flow &amp; Grok. Cookies persist in the profile dir.
          </p>
        </div>

        <div className="card p-6" data-testid="settings-storage-card">
          <h3 className="font-display text-lg mb-3">Storage</h3>
          {config && <>
            <Kv k="Images" v={config.storage.images_dir} mono testId="settings-storage-images" />
            <Kv k="Videos" v={config.storage.videos_dir} mono testId="settings-storage-videos" />
          </>}
        </div>

        <div className="card p-6" data-testid="settings-integrations-card">
          <h3 className="font-display text-lg mb-3">Integrations</h3>
          {config && <>
            <Kv k="Remotion project" v={config.remotion.project_dir} mono testId="settings-remotion-dir" />
            <Kv k="n8n base URL" v={config.n8n.base_url} mono testId="settings-n8n-url" />
            <Kv k="n8n webhook endpoint" v={<span className="font-mono text-xs break-all">{flow}/api/webhooks/n8n/scenes</span>} testId="settings-n8n-webhook" />
          </>}
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            Point your n8n HTTP node to the webhook endpoint above. Header: <span className="font-mono">x-webhook-secret</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
