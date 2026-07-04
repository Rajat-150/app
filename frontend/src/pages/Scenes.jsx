import React, { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import { RefreshCw, Sparkles, Trash2, Wand2, ExternalLink, Copy, Upload, X, Search, ChevronRight, CheckSquare, Square, ChevronDown } from "lucide-react";

const GOOGLE_FLOW_URL = "https://labs.google/fx/tools/flow";

const safeCopy = (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text || "").catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
  } catch { fallbackCopy(text); }
};
const fallbackCopy = (text) => {
  const ta = document.createElement("textarea");
  ta.value = text || "";
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (_e) { /* noop */ }
  document.body.removeChild(ta);
};

const statusBadge = (s) => ({
  pending: "badge",
  image_generated: "badge badge-warning",
  video_generated: "badge badge-accent",
  complete: "badge badge-success",
}[s] || "badge");

// natural sort so S02-L10 comes after S02-L02
const naturalCompare = (a, b) => (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });

export default function Scenes() {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [genScene, setGenScene] = useState(null);
  const [selected, setSelected] = useState({});
  const [openGroups, setOpenGroups] = useState({});  // {storyName: true} — collapsed by default

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/scenes"); setScenes(data); }
    finally { setLoading(false); }
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
    await api.delete(`/scenes/${id}`); await load();
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
        (s.scene_key || "").toLowerCase().includes(q) ||
        (s.line_text || "").toLowerCase().includes(q) ||
        (s.story_name || "").toLowerCase().includes(q)
      );
    });
  }, [scenes, query, statusFilter]);

  // Global counts (unfiltered)
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

  // Group by story_name using a Map (preserves first-seen order), then sort each group by shot_id natural.
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((s) => {
      const k = s.story_name || "(no story)";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    const arr = [];
    map.forEach((rows, story) => {
      rows.sort((a, b) => naturalCompare(a.scene_number, b.scene_number));
      arr.push({ story, scenes: rows });
    });
    return arr;
  }, [filtered]);

  // Auto-open the first group when scenes first load (nicer UX than fully collapsed)
  useEffect(() => {
    if (grouped.length > 0 && Object.keys(openGroups).length === 0) {
      setOpenGroups({ [grouped[0].story]: true });
    }
  }, [grouped.length, openGroups, grouped]);

  const toggleGroup = (story) => setOpenGroups((g) => ({ ...g, [story]: !g[story] }));

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
  const toggleGroupSelect = (group) => {
    const allOn = group.scenes.every((s) => selected[s.id]);
    const next = { ...selected };
    group.scenes.forEach((s) => { if (allOn) delete next[s.id]; else next[s.id] = true; });
    setSelected(next);
  };
  const clearSelection = () => setSelected({});

  const bulkGenerate = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    if (!window.confirm(`Queue ${ids.length} scenes for image generation?`)) return;
    setBulkBusy(true);
    try {
      const res = await api.post("/images/generate-bulk", { scene_ids: ids });
      alert(`${res.data.queued} scenes queued. Check the Jobs page.`);
      clearSelection(); await load();
    } catch (e) {
      alert("Bulk generate failed: " + (e?.response?.data?.detail || e?.message));
    } finally { setBulkBusy(false); }
  };

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

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shot ID, scene key, line, story…" className="input pl-9" data-testid="scenes-search-input" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {[
            { k: "all", label: "All" },
            { k: "pending", label: "Pending" },
            { k: "image", label: "Image ready" },
            { k: "video", label: "Video ready" },
          ].map((f) => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={"px-3 py-1.5 rounded-md border transition-colors " + (statusFilter === f.k ? "bg-white/10" : "hover:bg-white/5")}
              style={{ borderColor: "var(--border-default)" }} data-testid={`scenes-filter-${f.k}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="mb-3 p-3 rounded-md flex items-center justify-between" style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.25)" }} data-testid="scenes-selection-bar">
          <div className="text-sm"><span className="font-mono">{selectedCount}</span> scene{selectedCount === 1 ? "" : "s"} selected</div>
          <div className="flex items-center gap-2">
            <button onClick={clearSelection} className="btn-ghost" data-testid="scenes-selection-clear-btn">Clear</button>
            <button onClick={bulkGenerate} disabled={bulkBusy} className="btn-primary flex items-center gap-2" data-testid="scenes-bulk-generate-btn">
              <Wand2 size={14} /> {bulkBusy ? "Queueing…" : `Bulk Generate (${selectedCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Story-grouped collapsible list — bigger scroll area */}
      <div className="space-y-3" data-testid="scenes-groups-list" style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto", paddingRight: 8 }}>
        {grouped.length === 0 && (
          <div className="card p-16 text-center" style={{ color: "var(--text-muted)" }} data-testid="scenes-empty">
            {scenes.length === 0 ? <>No scenes yet. Click <span className="font-mono">Sync Airtable</span>.</> : "No scenes match the filter."}
          </div>
        )}
        {grouped.map((group) => {
          const isOpen = !!openGroups[group.story];
          const groupSelectedCount = group.scenes.filter((s) => selected[s.id]).length;
          return (
            <div key={group.story} className="card overflow-hidden" data-testid={`scenes-group-${group.story}`}>
              <button
                onClick={() => toggleGroup(group.story)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors"
                data-testid={`scenes-group-toggle-${group.story}`}
              >
                <ChevronRight size={16} className={"transition-transform " + (isOpen ? "rotate-90" : "")} style={{ color: "var(--text-secondary)" }} />
                <span className="font-display text-lg" style={{ color: "var(--accent)" }}>{group.story}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {group.scenes.length} shots
                </span>
                {groupSelectedCount > 0 && (
                  <span className="badge badge-accent">{groupSelectedCount} selected</span>
                )}
                <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleGroupSelect(group)}
                    className="btn-ghost text-[10px] font-mono uppercase tracking-widest"
                    data-testid={`scenes-group-select-${group.story}`}
                  >
                    {group.scenes.every((s) => selected[s.id]) ? "Deselect group" : "Select group"}
                  </button>
                </div>
              </button>

              {isOpen && (
                <div className="border-t" style={{ borderColor: "var(--border-default)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-canvas)" }}>
                        <th className="w-10 px-3 py-2"></th>
                        <th className="w-8"></th>
                        <th className="text-left px-2 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Scene</th>
                        <th className="text-left px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Shot ID</th>
                        <th className="text-left px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Scene Key</th>
                        <th className="text-left px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Line</th>
                        <th className="text-left px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Dur</th>
                        <th className="text-left px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Airtable</th>
                        <th className="text-left px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Local</th>
                        <th className="text-right px-3 py-2 font-mono uppercase tracking-widest text-[10px]" style={{ color: "var(--text-muted)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.scenes.map((s) => (
                        <React.Fragment key={s.id}>
                          <tr className={"hover:bg-white/5 transition-colors " + (selected[s.id] ? "bg-white/[0.03]" : "")} style={{ borderBottom: "1px solid var(--border-subtle)" }} data-testid={`scene-row-${s.scene_number || s.id}`}>
                            <td className="px-3">
                              <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleOne(s.id)} className="checkbox-lg" style={{ width: 16, height: 16 }} data-testid={`scene-checkbox-${s.scene_number || s.id}`} />
                            </td>
                            <td className="px-2">
                              <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="btn-ghost p-1" data-testid={`scene-expand-${s.scene_number || s.id}`}>
                                <ChevronDown size={13} className={"transition-transform " + (expandedId === s.id ? "" : "-rotate-90")} />
                              </button>
                            </td>
                            <td className="px-2 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{s.scene_id || "—"}</td>
                            <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{s.scene_number || "—"}</td>
                            <td className="px-3 py-3 font-mono text-[10px] whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{s.scene_key || "—"}</td>
                            <td className="px-3 py-3 max-w-md">
                              <div className="line-clamp-1" style={{ color: "var(--text-primary)" }}>{s.line_text || <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{s.duration_sec ? `${s.duration_sec}s` : "—"}</td>
                            <td className="px-3 py-3"><span className="badge">{s.airtable_status || "—"}</span></td>
                            <td className="px-3 py-3"><span className={statusBadge(s.status)}>{s.status.replace(/_/g, " ")}</span></td>
                            <td className="px-3 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <button onClick={() => setGenScene(s)} className="btn-secondary flex items-center gap-1" data-testid={`scene-generate-image-btn-${s.scene_number || s.id}`}>
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
                              <td colSpan="10" className="px-6 py-4 space-y-3">
                                <PromptBlock label="Image prompt" text={s.image_prompt} />
                                <PromptBlock label="Video prompt" text={s.video_prompt} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {genScene && (
        <GenerateImageModal scene={genScene} onClose={() => setGenScene(null)} onDone={() => { setGenScene(null); load(); }} />
      )}
    </div>
  );
}

const PromptBlock = ({ label, text }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</span>
      <button onClick={() => safeCopy(text)} className="btn-ghost text-[10px] font-mono uppercase tracking-widest flex items-center gap-1">
        <Copy size={11} /> copy
      </button>
    </div>
    <div className="text-xs leading-relaxed p-3 rounded max-h-40 overflow-y-auto" style={{ background: "var(--bg-canvas)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
      {text || <span style={{ color: "var(--text-muted)" }}>(empty)</span>}
    </div>
  </div>
);

// Preset chip group
const ChipGroup = ({ label, options, value, onChange, testId }) => (
  <div>
    <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</div>
    <div className="flex gap-1.5 flex-wrap" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={"px-3 py-1.5 rounded-md text-xs border transition-colors " + (value === o ? "" : "hover:bg-white/5")}
          style={value === o
            ? { background: "var(--accent)", color: "white", borderColor: "var(--accent)" }
            : { borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          data-testid={`${testId}-${o}`}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

function GenerateImageModal({ scene, onClose, onDone }) {
  const [uploading, setUploading] = useState(false);
  const [aspect, setAspect] = useState("16:9");
  const [count, setCount] = useState("1x");
  const [model, setModel] = useState("Nano Banana 2");
  const fileRef = useRef(null);

  const copyAndOpen = () => {
    const win = window.open(GOOGLE_FLOW_URL, "_blank", "noopener,noreferrer");
    if (!win) alert("Popup blocked. Allow pop-ups for this site and try again.");
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
      fd.append("settings", JSON.stringify({ aspect, count, model }));
      const res = await api.post("/images/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      alert("Image saved as " + res.data.filename);
      onDone();
    } catch (e) {
      alert("Upload failed: " + (e?.response?.data?.detail || e?.message));
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onClose} data-testid="generate-image-modal">
      <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-lg">Generate image for {scene.scene_number}</h3>
            <div className="text-[10px] font-mono uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
              Key: <span style={{ color: "var(--accent)" }}>{scene.scene_key || "—"}</span> · saved image will start with this
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" data-testid="generate-modal-close-btn"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <PromptBlock label="Image prompt (auto-copied when opening Flow)" text={scene.image_prompt} />

          <div className="grid grid-cols-2 gap-4">
            <ChipGroup label="Aspect ratio" options={["16:9", "4:3", "1:1", "3:4", "9:16"]} value={aspect} onChange={setAspect} testId="chip-aspect" />
            <ChipGroup label="Count" options={["1x", "x2", "x3", "x4"]} value={count} onChange={setCount} testId="chip-count" />
          </div>
          <ChipGroup label="Model" options={["Nano Banana 2", "Imagen 4", "Veo 3"]} value={model} onChange={setModel} testId="chip-model" />
          <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            ℹ Settings are recorded with the image for reference. Auto-applying them in Google Flow needs Playwright automation on the VPS (phase 2).
          </div>

          <div className="flex items-center gap-3 pt-2">
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
            <div className="text-[10px] font-mono uppercase tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>
              File will be saved as <span className="font-mono">{scene.scene_key || scene.scene_number}_&lt;hash&gt;.ext</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
