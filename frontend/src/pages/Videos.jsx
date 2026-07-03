import { useEffect, useState, useRef } from "react";
import { api, fileUrl } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Upload, Trash2, Check, X } from "lucide-react";

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadScene, setUploadScene] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [vs, sc] = await Promise.all([api.get("/videos"), api.get("/scenes")]);
      setVideos(vs.data); setScenes(sc.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const review = async (v, approved) => {
    await api.patch(`/videos/${v.id}`, { approved });
    setVideos((all) => all.map((x) => x.id === v.id ? { ...x, approved } : x));
  };

  const del = async (id) => {
    if (!window.confirm("Delete this video?")) return;
    await api.delete(`/videos/${id}`);
    setVideos((all) => all.filter((v) => v.id !== id));
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadScene) { alert("Pick a scene first"); return; }
    const fd = new FormData();
    fd.append("scene_id", uploadScene);
    fd.append("file", file);
    await api.post("/videos/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    if (fileRef.current) fileRef.current.value = "";
    await load();
  };

  return (
    <div className="stagger-in" data-testid="videos-page">
      <PageHeader
        title="Video Review"
        subtitle="Playback each clip, approve or reject before rendering"
        right={<>
          <select value={uploadScene} onChange={(e) => setUploadScene(e.target.value)} className="input w-56" data-testid="videos-upload-scene-select">
            <option value="">Attach to scene…</option>
            {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.scene_number ?? "?"}</option>)}
          </select>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2" data-testid="videos-upload-btn">
            <Upload size={14} /> Upload
          </button>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={upload} data-testid="videos-file-input" />
          <button onClick={load} className="btn-ghost" data-testid="videos-refresh-btn"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </>}
      />

      {videos.length === 0 ? (
        <div className="card p-16 text-center" style={{ color: "var(--text-muted)" }} data-testid="videos-empty">
          No videos yet. Generate from selected images on the Images page.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {videos.map((v) => (
            <div key={v.id} className="card overflow-hidden" data-testid={`video-card-${v.id}`}>
              <video src={fileUrl("videos", v.filename)} controls className="w-full aspect-video bg-black" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="badge">{v.source}</span>
                  {v.approved === true && <span className="badge badge-success">approved</span>}
                  {v.approved === false && <span className="badge badge-error">rejected</span>}
                  {v.approved == null && <span className="badge badge-warning">unreviewed</span>}
                </div>
                <div className="text-xs mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{v.prompt || "—"}</div>
                <div className="flex gap-2">
                  <button onClick={() => review(v, true)} className="btn-secondary flex items-center gap-1 flex-1 justify-center" data-testid={`video-approve-btn-${v.id}`}>
                    <Check size={13} /> Approve
                  </button>
                  <button onClick={() => review(v, false)} className="btn-secondary flex items-center gap-1 flex-1 justify-center" data-testid={`video-reject-btn-${v.id}`}>
                    <X size={13} /> Reject
                  </button>
                  <button onClick={() => del(v.id)} className="btn-ghost" data-testid={`video-delete-btn-${v.id}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
