import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw } from "lucide-react";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const load = async () => {
    const { data } = await api.get("/jobs");
    setJobs(data);
  };
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []);

  return (
    <div className="stagger-in" data-testid="jobs-page">
      <PageHeader title="Jobs" subtitle="Automation queue: image & video generation tasks"
        right={<button onClick={load} className="btn-secondary flex items-center gap-2" data-testid="jobs-refresh-btn"><RefreshCw size={14} /> Reload</button>}
      />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>ID</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Kind</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Status</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Prompt</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan="5" className="p-12 text-center" style={{ color: "var(--text-muted)" }} data-testid="jobs-empty">No jobs yet.</td></tr>}
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-white/5" style={{ borderBottom: "1px solid var(--border-subtle)" }} data-testid={`job-row-${j.id.slice(0,8)}`}>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{j.id.slice(0, 8)}</td>
                <td className="px-4 py-3"><span className="badge">{j.kind}</span></td>
                <td className="px-4 py-3">
                  <span className={"badge " + (j.status === "done" ? "badge-success" : j.status === "failed" ? "badge-error" : j.status === "pending_manual" ? "badge-warning" : "")}>
                    {j.status}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-lg"><div className="line-clamp-1 text-xs" style={{ color: "var(--text-secondary)" }}>{j.prompt}</div>
                  {j.error && <div className="line-clamp-1 text-xs mt-1" style={{ color: "#f87171" }}>{j.error}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{new Date(j.updated_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
