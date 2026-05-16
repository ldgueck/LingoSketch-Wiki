import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, X, Info, Clock, RotateCcw } from "lucide-react";
import { Layout } from "../components/Layout";

interface HistoryItem {
  timestamp: string;
  date: string;
  filename: string;
}

export default function WikiEdit() {
  const { name } = useParams<{ name: string }>();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const pageName = name || "";

  useEffect(() => {
    if (!pageName) {
      setLoading(false);
      return;
    }
    
    // Fetch main content
    const fetchContent = fetch(`/api/pages/${pageName}`)
      .then((res) => {
        if (res.status === 404) return { name: pageName, content: "" };
        return res.json();
      })
      .then((data) => {
        setContent(data.content);
      });

    // Fetch history
    const fetchHistory = fetch(`/api/pages/${pageName}/history`)
      .then(res => res.json())
      .then(setHistory);

    Promise.all([fetchContent, fetchHistory])
      .finally(() => setLoading(false))
      .catch(console.error);
  }, [pageName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${pageName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Save failed");
      navigate(`/view/${pageName}`);
    } catch (error) {
      console.error(error);
      alert("Failed to save page. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const loadHistoryVersion = async (timestamp: string) => {
    try {
      const res = await fetch(`/api/pages/${pageName}/history/${timestamp}`);
      if (!res.ok) throw new Error("Failed to fetch version");
      const data = await res.json();
      if (window.confirm("Load this version into the editor? Current unsaved changes will be lost.")) {
        setContent(data.content);
        setShowHistory(false);
      }
    } catch (error) {
      console.error(error);
      alert("Error loading version.");
    }
  };

  if (loading) return <Layout>Loading editor...</Layout>;

  return (
    <Layout pageTitle={`Editing ${pageName}`}>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <div className="flex bg-blue-50 p-4 rounded-2xl border border-blue-100 gap-3 items-start">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Wiki Syntax Quick Reference</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Use <code>[[PageName]]</code> to link to another page.</li>
                  <li>Use <code>[[Label|PageName]]</code> for custom link text.</li>
                  <li>Standard Markdown is supported for headings, lists, and emphasis.</li>
                </ul>
              </div>
            </div>

            <textarea
              className="w-full h-[500px] p-6 bg-slate-50 border-2 border-slate-200 rounded-3xl font-mono text-sm leading-snug focus:border-blue-500 focus:ring-0 transition-colors outline-none resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write something for ${pageName}...`}
              autoFocus
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 font-bold disabled:opacity-50"
              >
                <Save size={20} /> {saving ? "Saving..." : "Save Changes"}
              </button>
              
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl transition-all font-bold ${
                  showHistory 
                    ? "bg-slate-200 text-slate-800" 
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Clock size={20} /> History {history.length > 0 && `(${history.length})`}
              </button>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-bold"
              >
                <X size={20} /> Cancel
              </button>
            </div>
          </form>
        </div>

        {showHistory && (
          <aside className="w-full lg:w-80 bg-slate-50 rounded-3xl p-6 border border-slate-200 h-fit lg:sticky lg:top-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <RotateCcw size={16} /> Revision History
            </h3>
            
            {history.length === 0 ? (
              <p className="text-slate-400 text-sm italic">No past versions found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((item) => (
                  <button
                    key={item.timestamp}
                    onClick={() => loadHistoryVersion(item.timestamp)}
                    className="group bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-300 transition-all text-left shadow-sm hover:shadow-md"
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                    <div className="text-slate-700 font-medium text-sm">
                      {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="mt-2 text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Clock size={12} /> Load Version
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </Layout>
  );
}
