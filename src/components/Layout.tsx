import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Book, Plus, Home, List, Trash2, Upload, Image, HelpCircle, LogOut, FileQuestion, Unlink, FileText, Volume2, Video } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "./AuthProvider";

interface LayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  onSearch?: (query: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, pageTitle, onSearch }) => {
  const [pages, setPages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    fetch("/api/pages")
      .then((res) => res.json())
      .then((data) => setPages(data))
      .catch(console.error);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Header */}
      <header className="bg-[#04395e] text-white p-4 shadow-xl z-20">
         <Link to="/" className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">LyngoSketch WIKI</h1>
         </Link>
      </header>

      {/* Container */}
      <div className="flex flex-col md:flex-row flex-1">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-[#04395e] text-white border-r border-blue-950 p-6 flex flex-col gap-8 shadow-xl relative z-10">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
            <input
              type="text"
              placeholder="Search pages..."
              className="w-full pl-10 pr-4 py-2 bg-blue-900/30 border border-blue-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 transition-all outline-none text-white placeholder:text-blue-300/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <nav className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-2 px-1 opacity-60">Navigation</p>
            <NavLink to="/view/HomePage" icon={<Home size={18} />} label="Home" />
            <NavLink to="/index" icon={<List size={18} />} label="All Pages" />
            <NavLink to="/wanted" icon={<FileQuestion size={18} />} label="Wanted" />
            <NavLink to="/orphaned" icon={<Unlink size={18} />} label="Orphaned" />
            <NavLink to="/images" icon={<Image size={18} />} label="Image Gallery" />
            <NavLink to="/pdfs" icon={<FileText size={18} />} label="PDF Gallery" />
            <NavLink to="/audio" icon={<Volume2 size={18} />} label="Audio Gallery" />
            <NavLink to="/videos" icon={<Video size={18} />} label="Video Gallery" />
            <NavLink to="/new" icon={<Plus size={18} />} label="New Page" />
            <NavLink to="/import" icon={<Upload size={18} />} label="Data" />
            <NavLink to="/view/Help" icon={<HelpCircle size={18} />} label="Help" />
          </nav>

          <div className="mt-auto border-t border-blue-800/50 pt-6 flex flex-col gap-4">
             <button 
               onClick={handleLogout}
               className="flex items-center gap-3 px-3 py-2 rounded-xl text-blue-300 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium text-sm group text-left"
             >
               <LogOut size={18} />
               Sign Out
             </button>
             <div>
               <p className="text-xs text-blue-300 opacity-60">© 2026 LyngoSketch</p>
             </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-12 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageTitle || "content"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {pageTitle && (
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 capitalize">
                    {pageTitle.replace(/_/g, " ")}
                  </h2>
                  <div className="flex gap-2">
                    {/* Additional Actions could go here */}
                  </div>
                </header>
              )}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-10 border border-slate-100 min-h-[60vh]">
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const NavLink = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-3 py-2 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white transition-all font-medium text-sm group"
  >
    <span className="text-blue-300 group-hover:text-blue-100 transition-colors">
      {icon}
    </span>
    {label}
  </Link>
);
