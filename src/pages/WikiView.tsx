import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Edit2, Trash2, Home, ArrowLeft, Type, Link as LinkIcon } from "lucide-react";
import { Layout } from "../components/Layout";
import { WikiRenderer } from "../components/WikiRenderer";

export default function WikiView() {
  const { name } = useParams<{ name: string }>();
  const [page, setPage] = useState<{ name: string; content: string } | null>(null);
  const [backlinks, setBacklinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const pageName = name || "HomePage";

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pages/${pageName}`)
      .then((res) => {
        if (res.status === 404) return { name: pageName, content: "# Page Not Found\n\nThis page doesn't exist yet. Would you like to [[edit]] it?" };
        if (!res.ok) throw new Error("Failed to load page");
        return res.json();
      })
      .then((data) => {
        setPage(data);
      })
      .catch((err) => {
        console.error(err);
        setPage({ name: pageName, content: "# Error Loading Page\n\nThe server failed to provide the page content. Please try refreshing." });
      })
      .finally(() => {
        setLoading(false);
      });

    fetch(`/api/backlinks/${pageName}`)
      .then((res) => res.json())
      .then(setBacklinks)
      .catch(console.error);
  }, [pageName]);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${pageName}?`)) {
      await fetch(`/api/pages/${pageName}`, { method: "DELETE" });
      navigate("/");
    }
  };

  const handleRename = async () => {
    const newName = window.prompt(`Enter new name for ${pageName}:`, pageName);
    if (newName && newName !== pageName) {
      try {
        const res = await fetch(`/api/pages/${pageName}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newName }),
        });
        const data = await res.json();
        if (res.ok) {
          navigate(`/view/${data.newName}`);
        } else {
          alert(data.error || "Rename failed");
        }
      } catch (error) {
        console.error("Rename error:", error);
        alert("An error occurred during rename");
      }
    }
  };

  if (loading) return <Layout><div className="animate-pulse flex space-y-4 flex-col"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-5/6"></div></div></Layout>;

  return (
    <Layout pageTitle={page?.name}>
      <div className="mb-6 flex gap-2 border-b border-slate-100 pb-4">
        <Link 
          to={`/edit/${pageName}`} 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 font-semibold text-sm"
        >
          <Edit2 size={16} /> Edit Page
        </Link>
        <button 
          onClick={handleRename}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm"
        >
          <Type size={16} /> Rename
        </button>
        <button 
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm"
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
      
      <WikiRenderer content={page?.content || ""} />

      {backlinks.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <LinkIcon size={14} /> Backlinks
          </h3>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((link) => (
              <Link
                key={link}
                to={`/view/${link}`}
                className="px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-all border border-slate-100"
              >
                {link}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
