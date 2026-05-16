import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search as SearchIcon, ChevronRight } from "lucide-react";
import { Layout } from "../components/Layout";

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pages")
      .then((res) => res.json())
      .then((pages: string[]) => {
        const filtered = pages.filter(p => 
          p.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered);
        setLoading(false);
      });
  }, [query]);

  return (
    <Layout pageTitle={`Search: ${query}`}>
      {loading ? (
        <p>Searching...</p>
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-slate-500 mb-4 font-medium">Found {results.length} matches for "{query}"</p>
          {results.map((p) => (
            <Link
              key={p}
              to={`/view/${p}`}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-slate-100 group"
            >
               <span className="font-semibold text-slate-700 capitalize">{p.replace(/_/g, " ")}</span>
               <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-all" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
            <SearchIcon size={32} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">No results found</h3>
          <p className="text-slate-500">Try a different search term or create a [[new page]].</p>
        </div>
      )}
    </Layout>
  );
}
