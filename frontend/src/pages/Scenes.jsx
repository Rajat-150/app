import React, { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Sparkles, Trash2, Wand2, ExternalLink, Copy, Upload, X, Search, ChevronRight, CheckSquare, Square } from "lucide-react";

const GOOGLE_FLOW_URL = "https://labs.google/fx/tools/flow";

// Copy that works even on http:// (Clipboard API needs HTTPS)
const safeCopy = (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text || "").catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch { fallbackCopy(text); }
};
const fallbackCopy = (text) => {
  const ta = document.createElement("textarea");
  ta.value = text || "";
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (_e) { /* noop */ }
  document.body.removeChild(ta);
};

const statusBadge = (s) => ({
  pending: "badge",
  image_generated: "badge badge-warning",
  video_generated: "badge badge-accent",
  complete: "badge badge-success",
}[s] || "badge");

export default function Scenes() {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [genScene, setGenScene] = useState(null);
  const [selected, setSelected] = useState({});  // {sceneId: true}

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
      alert(`Synced ${res.data.synced} scenes from Airtable`);
    } catch (e) {
      alert("Airtable sync failed:\n\n" + (e?.response?.data?.detail || e?.message));
    } finally { setSyncing(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this scene?")) return;
    await api.delete(`/scenes/${id}`);
    await load();
  };

  const filtered = useMemo(() => {
    return scenes.filter((s) => {
      if (statusFilter !== "all") {
        const st = (s.airtable_status || "").toLowerCase();
        if (statusFilter === "pending" && st && !st.includes("pending")) return false;
        if (statusFilter === "image" && !st.includes("image")) return false;
        if (statusFilter === "video" && !st.includes("video")) return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        (s.scene_number || "").toLowerCase().includes(q) ||
        (s.scene_id || "").toLowerCase().includes(q) ||
        (s.line_text || "").toLowerCase().includes(q) ||
        (s.story_name || "").toLowerCase().includes(q)
      );
    });
  }, [scenes, query, statusFilter]);

  const counts = useMemo(() => {
    let pending = 0, imageGen = 0, videoGen = 0;
    scenes.forEach((s) => {
      const st = (s.airtable_status || "").toLowerCase();
      if (st.includes("video")) videoGen++;
      else if (st.includes("image")) imageGen++;
      else pending++;
    });
    return { total: scenes.length, pending, imageGen, videoGen };
  }, [scenes]);

  // Selection helpers
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected[s.id]);

  const toggleOne = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const next = { ...selected };
      filtered.forEach((s) => delete next[s.id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach((s) => { next[s.id] = true; });
      setSelected(next);
    }
  };
  const clearSelection = () => setSelected({});

  // Bulk generate — opens ONE Google Flow tab then serially prompts you to paste + upload for each.
  // For a fully hands-off flow we'd need Playwright with cookies — see phase 2 in the docs.
  const bulkGenerate = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    if (!window.confirm(`Queue ${ids.length} scenes for image generation? Each job goes to the backend queue and will fall back to manual upload if the automated Playwright login isn't configured yet.`)) return;
    setBulkBusy(true);
    try {
      const res = await api.post("/images/generate-bulk", { scene_ids: ids });
      alert(`${res.data.queued} scenes queued. Check the Jobs page for progress.`);
      clearSelection();
      await load();
    } catch (e) {
      alert("Bulk generate failed: " + (e?.response?.data?.detail || e?.message));
    } finally { setBulkBusy(false); }
  };

  // Group rows by story_name for rendering (preserves Airtable order via sort_index which backend returns)
  const grouped = useMemo(() => {
    const groups = [];
    let currentStory = null;
    filtered.forEach((s) => {
      if (s.story_name !== currentStory) {
        groups.push({ story: s.story_name || "(no story)", scenes: [s] });
        currentStory = s.story_name;
      } else {
        groups[groups.length - 1].scenes.push(s);
      }
    });
    return groups;
  }, [filtered]);

  return (
    <div className="stagger-in" data-testid="scenes-page">
      <PageHeader
        title="Scenes"
        subtitle={`${counts.total} total · ${counts.pending} pending · ${counts.imageGen} image ready · ${counts.videoGen} video ready`}
        right={<>
          <button onClick={toggleAllFiltered} className="btn-secondary flex items-center gap-2" data-testid="scenes-select-all-btn">
            {allFilteredSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
          <button onClick={load} className="btn-secondary flex items-center gap-2" data-testid="scenes-refresh-btn">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Reload
          </button>
          <button onClick={sync} className="btn-primary flex items-center gap-2" data-testid="scenes-sync-airtable-btn">
            <Sparkles size={14} /> {syncing ? "Syncing…" : "Sync Airtable"}
          </button>
        </>}
      />

      {/* Filter + selection bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shot ID, scene, line, story…" className="input pl-9" data-testid="scenes-search-input" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {[
            { k: "all", label: "All" },
            { k: "pending", label: "Pending" },
            { k: "image", label: "Image ready" },
            { k: "video", label: "Video ready" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setStatusFilter(f.k)}
              className={"px-3 py-1.5 rounded-md border transition-colors " + (statusFilter === f.k ? "bg-white/10" : "hover:bg-white/5")}
              style={{ borderColor: "var(--border-default)" }}
              data-testid={`scenes-filter-${f.k}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="mb-3 p-3 rounded-md flex items-center justify-between" style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.25)" }} data-testid="scenes-selection-bar">
          <div className="text-sm">
            <span className="font-mono">{selectedCount}</span> scene{selectedCount === 1 ? "" : "s"} selected
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearSelection} className="btn-ghost" data-testid="scenes-selection-clear-btn">Clear</button>
            <button onClick={bulkGenerate} disabled={bulkBusy} className="btn-primary flex items-center gap-2" data-testid="scenes-bulk-generate-btn">
              <Wand2 size={14} /> {bulkBusy ? "Queueing…" : `Bulk Generate (${selectedCount})`}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden" data-testid="scenes-table-card">
        <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "var(--bg-surface)", zIndex: 1 }}>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="checkbox-lg" style={{ width: 16, height: 16 }} data-testid="scenes-header-select-all-checkbox" />
                </th>
                <th className="w-8"></th>
                <th className="text-left px-2 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Scene</th>
                <th className="text-left px-3 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Shot ID</th>
                <th className="text-left px-3 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Line</th>
                <th className="text-left px-3 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Dur</th>
                <th className="text-left px-3 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Airtable</th>
                <th className="text-left px-3 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Local</th>
                <th className="text-right px-3 py-3 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 && (
                <tr><td colSpan="9" className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }} data-testid="scenes-empty">
                  {scenes.length === 0 ? <>No scenes yet. Click <span className="font-mono">Sync Airtable</span>.</> : "No scenes match the filter."}
                </td></tr>
              )}
              {grouped.map((group) => (
                <React.Fragment key={group.story}>
                  <tr>
                    <td colSpan="9" className="px-4 pt-6 pb-2" style={{ background: "var(--bg-canvas)" }}>
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-base" style={{ color: "var(--accent)" }}>{group.story}</span>
                        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                          {group.scenes.length} shots
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.scenes.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr className={"hover:bg-white/5 transition-colors " + (selected[s.id] ? "bg-white/[0.03]" : "")} style={{ borderBottom: "1px solid var(--border-subtle)" }} data-testid={`scene-row-${s.scene_number || s.id}`}>
                        <td className="px-3">
                          <input
                            type="checkbox"
                            checked={!!selected[s.id]}
                            onChange={() => toggleOne(s.id)}
                            className="checkbox-lg"
                            style={{ width: 16, height: 16 }}
                            data-testid={`scene-checkbox-${s.scene_number || s.id}`}
                          />
                        </td>
                        <td className="px-2">
                          <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="btn-ghost p-1" data-testid={`scene-expand-${s.scene_number || s.id}`}>
                            <ChevronRight size={14} className={"transition-transform " + (expandedId === s.id ? "rotate-90" : "")} />
                          </button>
                        </td>
                        <td className="px-2 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{s.scene_id || "—"}</td>
                        <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{s.scene_number || "—"}</td>
                        <td className="px-3 py-3 max-w-lg">
                          <div className="line-clamp-1" style={{ color: "var(--text-primary)" }}>{s.line_text || <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{s.duration_sec ? `${s.duration_sec}s` : "—"}</td>
                        <td className="px-3 py-3"><span className="badge">{s.airtable_status || "—"}</span></td>
                        <td className="px-3 py-3"><span className={statusBadge(s.status)}>{s.status.replace(/_/g, " ")}</span></td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => setGenScene(s)}
                              className="btn-secondary flex items-center gap-1"
                              data-testid={`scene-generate-image-btn-${s.scene_number || s.id}`}
                            >
                              <Wand2 size={13} /> Generate
                            </button>
                            <button onClick={() => del(s.id)} className="btn-ghost" data-testid={`scene-delete-btn-${s.scene_number || s.id}`}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === s.id && (
                        <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-subtle)" }}>
                          <td colSpan="9" className="px-6 py-4 space-y-3">
                            <PromptBlock label="Image prompt" text={s.image_prompt} />
                            <PromptBlock label="Video prompt" text={s.video_prompt} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {genScene && (
        <GenerateImageModal scene={genScene} onClose={() => setGenScene(null)} onDone={() => { setGenScene(null); load(); }} />
      )}
    </div>
  );
}

// Need explicit React import for React.Fragment in tables (already imported above)

const PromptBlock = ({ label, text }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</span>
      <button onClick={() => safeCopy(text)} className="btn-ghost text-[10px] font-mono uppercase tracking-widest flex items-center gap-1">
        <Copy size={11} /> copy
      </button>
    </div>
    <div className="text-xs leading-relaxed p-3 rounded" style={{ background: "var(--bg-canvas)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
      {text || <span style={{ color: "var(--text-muted)" }}>(empty)</span>}
    </div>
  </div>
);

function GenerateImageModal({ scene, onClose, onDone }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // CRITICAL: open the tab FIRST (synchronous, still in user-gesture context),
  // then copy — otherwise popup blocker fires on http:// (Clipboard API rejects and consumes the gesture).
  const copyAndOpen = () => {
    const win = window.open(GOOGLE_FLOW_URL, "_blank", "noopener,noreferrer");
    if (!win) {
      alert("Popup blocked. Please allow pop-ups for this site (click the address-bar shield/icon), then try again.");
    }
    safeCopy(scene.image_prompt || "");
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("scene_id", scene.id);
      fd.append("file", file);
      await api.post("/images/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      alert("Image saved for " + scene.scene_number);
      onDone();
    } catch (e) {
      alert("Upload failed: " + (e?.response?.data?.detail || e?.message));
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onClose} data-testid="generate-image-modal">
      <div className="card p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-lg">Generate image for {scene.scene_number}</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Opens Google Flow in a new tab and copies the prompt. Paste → generate → download → upload back.</p>
          </div>
          <button onClick={onClose} className="btn-ghost" data-testid="generate-modal-close-btn"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <PromptBlock label="Image prompt" text={scene.image_prompt} />

          <div className="flex items-center gap-3">
            <button onClick={copyAndOpen} className="btn-primary flex items-center gap-2" data-testid="generate-open-flow-btn">
              <ExternalLink size={14} /> Copy prompt & open Google Flow
            </button>
            <button onClick={() => safeCopy(scene.image_prompt)} className="btn-secondary flex items-center gap-2" data-testid="generate-copy-only-btn">
              <Copy size={14} /> Copy only
            </button>
          </div>

          <div className="pt-4 border-t" style={{ borderColor: "var(--border-default)" }}>
            <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Step 2 — upload the image back</div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-secondary flex items-center gap-2 w-full justify-center py-3"
              data-testid="generate-upload-btn"
            >
              <Upload size={14} /> {uploading ? "Uploading…" : "Upload generated image"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} data-testid="generate-file-input" />
          </div>
        </div>
      </div>
    </div>
  );
}
