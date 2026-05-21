import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ChevronRight } from "lucide-react";
import { Layout } from "../components/Layout";

export default function WikiIndex() {
  const [pages, setPages] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/pages", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load index");
        return res.json();
      })
      .then((data) => {
        setPages(data.sort((a: string, b: string) => a.localeCompare(b)));
      })
      .catch(err => {
        console.error("Index load failed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredPages = pages.filter(p => 
    p.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Layout pageTitle="Wiki Index">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Filter pages..."
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="flex flex-col border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
          {filteredPages.length > 0 ? (
            filteredPages.map((p, index) => (
              <Link
                key={p}
                to={`/view/${p}`}
                className={`flex items-center gap-3 px-4 py-1.5 hover:bg-blue-50 transition-colors group ${
                  index !== filteredPages.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <FileText size={12} className="text-slate-400 group-hover:text-blue-500" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
                  {p}
                </span>
              </Link>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm italic">
              No pages match your filter
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
