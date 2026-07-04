import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Scenes from "@/pages/Scenes";
import Images from "@/pages/Images";
import Videos from "@/pages/Videos";
import Render from "@/pages/Render";
import Jobs from "@/pages/Jobs";
import BrowserLogin from "@/pages/BrowserLogin";
import Settings from "@/pages/Settings";

function App() {
  return (
    <div className="App min-h-screen">
      <div className="grain" />
      <BrowserRouter>
        <Sidebar />
        <main className="pl-64 min-h-screen relative z-[1]">
          <div className="px-10 py-10 max-w-[1600px]">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scenes" element={<Scenes />} />
              <Route path="/images" element={<Images />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/render" element={<Render />} />
              <Route path="/browser" element={<BrowserLogin />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;
