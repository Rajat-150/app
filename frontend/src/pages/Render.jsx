import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { Play, RefreshCw } from "lucide-react";

export default function Render() {
  const [composition, setComposition] = useState("MainVideo");
  const [resolution, setResolution] = useState("1920x1080");
  const [outputName, setOutputName] = useState("");
  const [activeJob, setActiveJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    const { data } = await api.get("/render/jobs");
    setJobs(data);
    if (activeJob) {
      const cur = data.find((j) => j.id === activeJob.id);
      if (cur) setActiveJob(cur);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [activeJob?.id]);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post("/render/start", {
        composition, resolution: resolution || undefined, output_name: outputName || undefined,
      });
      const { data: job } = await api.get(`/render/jobs/${data.job_id}`);
      setActiveJob(job);
    } finally { setStarting(false); }
  };

  return (
    <div className="stagger-in" data-testid="render-page">
      <PageHeader title="Remotion Render" subtitle="Trigger `npx remotion render` on your VPS and watch the logs stream" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 card p-6 space-y-4" data-testid="render-config-card">
          <h3 className="font-display text-lg mb-2">Configuration</h3>

          <div>
            <label className="text-xs font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Composition ID</label>
            <input value={composition} onChange={(e) => setComposition(e.target.value)} className="input" placeholder="MainVideo" data-testid="render-composition-input" />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="input" data-testid="render-resolution-select">
              <option value="1920x1080">1920 × 1080 (FHD)</option>
              <option value="1080x1920">1080 × 1920 (vertical)</option>
              <option value="3840x2160">3840 × 2160 (4K)</option>
              <option value="1280x720">1280 × 720 (HD)</option>
              <option value="">Use composition default</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Output filename</label>
            <input value={outputName} onChange={(e) => setOutputName(e.target.value)} className="input" placeholder="my-video.mp4" data-testid="render-output-input" />
          </div>

          <button onClick={start} disabled={starting} className="btn-primary w-full flex items-center justify-center gap-2 py-3" data-testid="render-start-btn">
            <Play size={14} /> {starting ? "Starting…" : "Start Render"}
          </button>

          <div className="pt-4 border-t" style={{ borderColor: "var(--border-default)" }}>
            <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Recent Jobs</div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {jobs.length === 0 && <div className="text-xs" style={{ color: "var(--text-muted)" }}>No render jobs yet.</div>}
              {jobs.map((j) => (
                <button key={j.id} onClick={() => setActiveJob(j)} className={"w-full text-left px-3 py-2 rounded-md hover:bg-white/5 flex items-center justify-between " + (activeJob?.id === j.id ? "bg-white/5" : "")} data-testid={`render-job-item-${j.id.slice(0,8)}`}>
                  <span className="font-mono text-xs">{j.id.slice(0, 8)}</span>
                  <span className={"badge " + (j.status === "done" ? "badge-success" : j.status === "failed" ? "badge-error" : "badge-warning")}>{j.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 card p-0 flex flex-col" data-testid="render-logs-card">
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
            <div>
              <h3 className="font-display text-lg">Live Logs</h3>
              {activeJob && <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{activeJob.id}</div>}
            </div>
            {activeJob && <span className={"badge " + (activeJob.status === "done" ? "badge-success" : activeJob.status === "failed" ? "badge-error" : "badge-warning")}>{activeJob.status}</span>}
          </div>
          <div className="terminal m-4 min-h-[400px] flex-1" data-testid="render-terminal">
            {!activeJob ? (
              <div style={{ color: "var(--text-muted)" }}>$ awaiting render job…</div>
            ) : activeJob.logs.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>$ starting…</div>
            ) : (
              activeJob.logs.map((l, i) => <div key={i} className={l.includes("ERROR") || l.includes("EXCEPTION") ? "line-error" : ""}>{l}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
