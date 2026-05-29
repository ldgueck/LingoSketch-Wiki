import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Unlink, FileText, ChevronRight } from "lucide-react";
import { Layout } from "../components/Layout";

export default function OrphanedPages() {
  const [pages, setPages] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/orphaned", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load orphaned pages");
        return res.json();
      })
      .then((data) => {
        setPages(data);
      })
      .catch((err) => {
        console.error("Orphaned pages load failed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredPages = pages.filter((p) =>
    p.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Layout pageTitle="Orphaned Pages">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-slate-500 mb-4 bg-amber-50 border border-amber-200/60 text-amber-800 rounded-xl p-4">
            These are pages exist in the wiki but are not linked to by any other page. Consider linking to them from your HomePage or relevant articles to help with discovery.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Filter orphaned pages..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Loading orphaned pages calculation...
          </div>
        ) : (
          <div className="flex flex-col border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
            {filteredPages.length > 0 ? (
              filteredPages.map((p, index) => (
                <Link
                  key={p}
                  to={`/view/${p}`}
                  className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group ${
                    index !== filteredPages.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Unlink size={16} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                    <span className="text-sm font-medium text-slate-700 group-hover:text-amber-800 transition-colors">
                      {p.replace(/_/g, " ")}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 text-sm italic">
                No orphaned pages found. All of your wiki pages are fully reachable!
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
