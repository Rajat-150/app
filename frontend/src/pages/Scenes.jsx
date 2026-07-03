import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";

const statusBadgeClass = (s) => {
  if (s === "pending") return "badge";
  if (s === "image_generated") return "badge badge-warning";
  if (s === "video_generated") return "badge badge-accent";
  if (s === "complete") return "badge badge-success";
  return "badge";
};

export default function Scenes() {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [genBusy, setGenBusy] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/scenes");
      setScenes(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/scenes/sync-airtable");
      await load();
      alert(`Synced ${res.data.synced} scenes from Airtable (${res.data.airtable_configured ? "live" : "demo data"})`);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "unknown error";
      alert("Airtable sync failed:\n\n" + msg + "\n\nCheck backend logs and verify AIRTABLE_* variables in your .env file. Field names must match your Airtable column names exactly (case-sensitive).");
    } finally { setSyncing(false); }
  };

  const generateImage = async (sceneId) => {
    setGenBusy((b) => ({ ...b, [sceneId]: true }));
    try {
      await api.post("/images/generate", { scene_id: sceneId });
      await load();
    } finally {
      setTimeout(() => setGenBusy((b) => ({ ...b, [sceneId]: false })), 800);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this scene and its assets?")) return;
    await api.delete(`/scenes/${id}`);
    await load();
  };

  return (
    <div className="stagger-in" data-testid="scenes-page">
      <PageHeader
        title="Scenes"
        subtitle="Prompts sourced from Airtable — one row per scene"
        right={<>
          <button onClick={load} className="btn-secondary flex items-center gap-2" data-testid="scenes-refresh-btn">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Reload
          </button>
          <button onClick={sync} className="btn-primary flex items-center gap-2" data-testid="scenes-sync-airtable-btn">
            <Sparkles size={14} /> {syncing ? "Syncing…" : "Sync Airtable"}
          </button>
        </>}
      />

      <div className="card overflow-hidden" data-testid="scenes-table-card">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>#</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Image Prompt</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Video Prompt</th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Status</th>
              <th className="text-right px-4 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scenes.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }} data-testid="scenes-empty">
                No scenes yet. Click <span className="font-mono">Sync Airtable</span> to pull them in.
              </td></tr>
            )}
            {scenes.map((s) => (
              <tr key={s.id} className="hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid var(--border-subtle)" }} data-testid={`scene-row-${s.scene_number ?? s.id}`}>
                <td className="px-4 py-4 font-mono" style={{ color: "var(--text-secondary)" }}>{s.scene_number ?? "—"}</td>
                <td className="px-4 py-4 max-w-md">
                  <div className="line-clamp-2" style={{ color: "var(--text-primary)" }}>{s.image_prompt || "—"}</div>
                </td>
                <td className="px-4 py-4 max-w-md">
                  <div className="line-clamp-2" style={{ color: "var(--text-secondary)" }}>{s.video_prompt || "—"}</div>
                </td>
                <td className="px-4 py-4"><span className={statusBadgeClass(s.status)}>{s.status.replace("_"," ")}</span></td>
                <td className="px-4 py-4 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => generateImage(s.id)}
                      className="btn-secondary flex items-center gap-1"
                      data-testid={`scene-generate-image-btn-${s.scene_number ?? s.id}`}
                      disabled={genBusy[s.id]}
                    >
                      <Wand2 size={13} /> {genBusy[s.id] ? "Queued…" : "Generate Image"}
                    </button>
                    <button onClick={() => del(s.id)} className="btn-ghost" data-testid={`scene-delete-btn-${s.scene_number ?? s.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
