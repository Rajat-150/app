import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { ExternalLink, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

const NOVNC_URL = process.env.REACT_APP_NOVNC_URL || "";

export default function BrowserLogin() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const { data } = await api.get("/dashboard/stats");
      setStatus(data);
    } finally { setChecking(false); }
  };
  useEffect(() => { check(); }, []);

  const novncSrc = NOVNC_URL
    || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:6080/vnc.html?autoconnect=1&resize=scale` : "");

  return (
    <div className="stagger-in" data-testid="browser-login-page">
      <PageHeader
        title="Browser Login"
        subtitle="One-time login to Google Flow inside the worker container. Cookies persist forever."
        right={<button onClick={check} className="btn-secondary flex items-center gap-2" data-testid="browser-check-btn">
          <RefreshCw size={14} className={checking ? "animate-spin" : ""} /> Recheck
        </button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="card p-5 lg:col-span-1" data-testid="browser-worker-status-card">
          <div className="flex items-center gap-2 mb-3">
            {status?.playwright_available
              ? <ShieldCheck size={18} style={{ color: "var(--success)" }} />
              : <ShieldAlert size={18} style={{ color: "var(--warning)" }} />}
            <span className="font-display text-base">Worker</span>
          </div>
          <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            {status?.playwright_available ? "Reachable at http://worker:8002" : "Not running. Start it with:"}
          </div>
          {!status?.playwright_available && (
            <div className="terminal text-[11px] p-3 mb-3">docker compose --profile automation up -d worker</div>
          )}
          <a href={novncSrc} target="_blank" rel="noreferrer" className="btn-primary w-full flex items-center justify-center gap-2" data-testid="browser-open-novnc-btn">
            <ExternalLink size={14} /> Open noVNC desktop
          </a>
        </div>

        <div className="card p-5 lg:col-span-3" data-testid="browser-instructions-card">
          <h3 className="font-display text-lg mb-3">One-time login steps</h3>
          <ol className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            <li><span className="font-mono badge mr-2">01</span> Start the worker: <span className="font-mono">docker compose --profile automation up -d worker</span></li>
            <li><span className="font-mono badge mr-2">02</span> Click <span className="font-mono">Open noVNC desktop</span> → a full Linux desktop appears in a new tab</li>
            <li><span className="font-mono badge mr-2">03</span> Right-click the desktop → open a terminal → type <span className="font-mono">google-chrome</span> → Enter</li>
            <li><span className="font-mono badge mr-2">04</span> In that Chrome window, go to <span className="font-mono">labs.google/fx/tools/flow</span> and sign in with your Google account</li>
            <li><span className="font-mono badge mr-2">05</span> Install the <a href="https://chromewebstore.google.com/detail/veo-automation-auto-veo-n/fnmijgmnjpealnnadjpjilaanhhambeb" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--accent)" }}>VEO Automation extension</a> — sign in with your paid account inside the extension popup</li>
            <li><span className="font-mono badge mr-2">06</span> In the extension → Settings tab → set <span className="font-mono">Save to folder</span> = <span className="font-mono">sceneStudio</span> and turn ON <span className="font-mono">Auto Download</span></li>
            <li><span className="font-mono badge mr-2">07</span> Close Chrome. Session + extension are now persisted in <span className="font-mono">/data/playwright-profile</span></li>
            <li><span className="font-mono badge mr-2">08</span> Chrome downloads are pre-configured to save to <span className="font-mono">/data/downloads</span>, which the Scene Studio watcher monitors — every image the extension generates will auto-appear on the VEO Batches + Images pages.</li>
          </ol>
        </div>
      </div>

      <div className="card p-0 overflow-hidden" data-testid="novnc-iframe-card">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border-default)" }}>
          <div className="font-display text-base">Embedded noVNC preview</div>
          <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {novncSrc || "no url configured"}
          </div>
        </div>
        {novncSrc ? (
          <iframe title="noVNC" src={novncSrc} className="w-full" style={{ height: "70vh", border: 0, background: "#000" }} data-testid="novnc-iframe" />
        ) : (
          <div className="p-10 text-center" style={{ color: "var(--text-muted)" }}>Configure REACT_APP_NOVNC_URL or expose port 6080 on your VPS.</div>
        )}
      </div>
    </div>
  );
}
