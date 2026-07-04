import { NavLink } from "react-router-dom";
import { LayoutDashboard, Film, Image as ImageIcon, Video, Terminal, Settings, Activity, Zap, Monitor } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/scenes", label: "Scenes", icon: Film, testId: "nav-scenes" },
  { to: "/images", label: "Images", icon: ImageIcon, testId: "nav-images" },
  { to: "/videos", label: "Videos", icon: Video, testId: "nav-videos" },
  { to: "/render", label: "Render", icon: Zap, testId: "nav-render" },
  { to: "/browser", label: "Browser Login", icon: Monitor, testId: "nav-browser" },
  { to: "/jobs", label: "Jobs", icon: Activity, testId: "nav-jobs" },
  { to: "/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 fixed top-0 left-0 h-screen border-r bg-[#0A0A0A] z-10" style={{ borderColor: "var(--border-default)" }} data-testid="app-sidebar">
      <div className="px-5 py-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#FF3B30,#FF5045)" }}>
            <Terminal size={16} strokeWidth={1.75} color="white" />
          </div>
          <div>
            <div className="font-display text-[15px] font-medium">Scene Studio</div>
            <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>vps control panel</div>
          </div>
        </div>
      </div>
      <nav className="px-3 py-4 flex flex-col gap-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            data-testid={it.testId}
            className={({ isActive }) => "sidebar-item" + (isActive ? " active" : "")}
          >
            <it.icon size={16} strokeWidth={1.5} className="sidebar-icon" />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="absolute bottom-4 left-0 right-0 px-5">
        <div className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <span className="pulse-dot"></span> local · vps mode
        </div>
      </div>
    </aside>
  );
}
