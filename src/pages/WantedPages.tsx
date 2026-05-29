import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileQuestion, ChevronRight, CornerDownRight, Plus } from "lucide-react";
import { Layout } from "../components/Layout";

interface WantedPage {
  name: string;
  sources: string[];
}

export default function WantedPages() {
  const [pages, setPages] = useState<WantedPage[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/wanted", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load wanted pages");
        return res.json();
      })
      .then((data) => {
        setPages(data);
      })
      .catch((err) => {
        console.error("Wanted pages load failed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredPages = pages.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Layout pageTitle="Wanted Pages">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-slate-500 mb-4 bg-amber-50 border border-amber-200/60 text-amber-800 rounded-xl p-4">
            These are links to pages that don't exist yet, but are referenced inside other wiki pages. You can click any of them to create the page.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Filter wanted pages..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Loading wanted pages calculation...
          </div>
        ) : (
          <div className="flex flex-col border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
            {filteredPages.length > 0 ? (
              filteredPages.map((p, index) => (
                <div
                  key={p.name}
                  className={`p-4 flex flex-col gap-2 ${
                    index !== filteredPages.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      to={`/view/${p.name}`}
                      className="flex items-center gap-2 group text-amber-700 hover:text-amber-900 font-semibold text-sm transition-colors"
                    >
                      <FileQuestion size={16} className="text-amber-500" />
                      <span className="group-hover:underline">{p.name.replace(/_/g, " ")}</span>
                      <Plus size={14} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    </Link>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      referenced {p.sources.length} {p.sources.length === 1 ? "time" : "times"}
                    </span>
                  </div>
                  
                  {p.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-slate-500">
                      <CornerDownRight size={12} className="text-slate-400 inline" />
                      <span className="font-medium text-slate-400">Referenced in:</span>
                      {p.sources.map((src, i) => (
                        <React.Fragment key={src}>
                          <Link
                            to={`/view/${src}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {src.replace(/_/g, " ")}
                          </Link>
                          {i < p.sources.length - 1 && <span className="text-slate-300">•</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 text-sm italic">
                No wanted pages found. Your wiki links are fully consistent!
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
