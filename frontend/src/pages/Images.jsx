import { useEffect, useState, useRef } from "react";
import { api, fileUrl } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Upload, Trash2, Video as VideoIcon, ExternalLink } from "lucide-react";

export default function Images() {
  const [images, setImages] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadScene, setUploadScene] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [imgs, scs] = await Promise.all([api.get("/images"), api.get("/scenes")]);
      setImages(imgs.data); setScenes(scs.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleSelect = async (img) => {
    await api.patch(`/images/${img.id}`, { selected: !img.selected });
    setImages((all) => all.map((i) => i.id === img.id ? { ...i, selected: !i.selected } : i));
  };

  const del = async (id) => {
    if (!window.confirm("Delete this image?")) return;
    await api.delete(`/images/${id}`);
    setImages((all) => all.filter((i) => i.id !== id));
  };

  const generateSelected = async () => {
    const res = await api.post("/videos/generate-selected");
    alert(`${res.data.queued} video jobs queued`);
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadScene) { alert("Pick a scene first"); return; }
    const fd = new FormData();
    fd.append("scene_id", uploadScene);
    fd.append("file", file);
    await api.post("/images/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    if (fileRef.current) fileRef.current.value = "";
    await load();
  };

  const selectedCount = images.filter((i) => i.selected).length;

  return (
    <div className="stagger-in" data-testid="images-page">
      <PageHeader
        title="Image Gallery"
        subtitle="Review generated images and select those to send for video generation"
        right={<>
          <select value={uploadScene} onChange={(e) => setUploadScene(e.target.value)} className="input w-56" data-testid="images-upload-scene-select">
            <option value="">Attach to scene…</option>
            {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.scene_number ?? "?"} — {(s.image_prompt || "").slice(0, 40)}</option>)}
          </select>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2" data-testid="images-upload-btn">
            <Upload size={14} /> Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} data-testid="images-file-input" />
          <button onClick={load} className="btn-ghost" data-testid="images-refresh-btn"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
          <button onClick={generateSelected} className="btn-primary flex items-center gap-2" disabled={selectedCount === 0} data-testid="images-generate-selected-btn">
            <VideoIcon size={14} /> Generate Videos ({selectedCount})
          </button>
        </>}
      />

      {images.length === 0 ? (
        <div className="card p-16 text-center" style={{ color: "var(--text-muted)" }} data-testid="images-empty">
          No images yet. Generate from the Scenes page, or upload one manually.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img) => (
            <div key={img.id} className={"card overflow-hidden group relative " + (img.selected ? "ring-2" : "")} style={img.selected ? { boxShadow: "0 0 0 2px var(--accent)" } : {}} data-testid={`image-card-${img.id}`}>
              <div className="relative aspect-square bg-black cursor-pointer" onClick={() => setPreview(img)}>
                <img src={fileUrl("images", img.filename)} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={img.selected}
                    onChange={() => toggleSelect(img)}
                    className="checkbox-lg"
                    data-testid={`image-select-checkbox-${img.id}`}
                  />
                </div>
                <div className="absolute top-2 right-2">
                  <span className="badge">{img.source}</span>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{img.prompt || "—"}</div>
                <div className="flex gap-1">
                  <button onClick={() => setPreview(img)} className="btn-ghost p-1" data-testid={`image-preview-btn-${img.id}`}><ExternalLink size={13} /></button>
                  <button onClick={() => del(img.id)} className="btn-ghost p-1" data-testid={`image-delete-btn-${img.id}`}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setPreview(null)} data-testid="image-preview-modal">
          <img src={fileUrl("images", preview.filename)} className="max-w-full max-h-full rounded-lg" alt="" />
        </div>
      )}
    </div>
  );
}
