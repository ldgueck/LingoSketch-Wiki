import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Info, CheckCircle, AlertCircle, ArrowRight, Download, Archive, Code } from "lucide-react";
import { Layout } from "../components/Layout";

export default function ImportPage() {
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [importingLisp, setImportingLisp] = useState(false);
  const [lispText, setLispText] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const navigate = useNavigate();

  const handleLispImport = async () => {
    if (!lispText.trim()) return;
    setImportingLisp(true);
    setStatus(null);

    try {
      const res = await fetch("/api/import-lisp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lispData: lispText }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        setLispText("");
        setTimeout(() => navigate("/index"), 2000);
      } else {
        setStatus({ type: "error", message: data.error || "Failed to import Lisp data." });
      }
    } catch (error) {
      console.error("Lisp import failed:", error);
      setStatus({ type: "error", message: "A network error occurred." });
    } finally {
      setImportingLisp(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      window.location.href = "/api/export";
      setTimeout(() => setExporting(false), 2000);
    } catch (error) {
      console.error("Export failed:", error);
      setExporting(false);
      alert("Failed to start export download.");
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Are you sure you want to restore from this backup? This will overwrite your current wiki content and images.")) {
      e.target.value = ""; // Reset input
      return;
    }

    setRestoring(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("backup", file);

    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStatus({ type: "success", message: "Backup restored successfully! Refreshing..." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const data = await res.json();
        setStatus({ type: "error", message: data.error || "Failed to restore backup." });
      }
    } catch (error) {
      console.error("Restore failed:", error);
      setStatus({ type: "error", message: "A network error occurred during restore." });
    } finally {
      setRestoring(false);
      e.target.value = ""; // Reset input
    }
  };

  return (
    <Layout pageTitle="Data Management">
      <div className="max-w-3xl flex flex-col gap-12">
        {/* Export Section */}
        <section id="export-section" className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Archive size={40} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-extrabold mb-2">Export Backup</h2>
              <p className="text-blue-100 text-sm leading-relaxed">
                Download a ZIP archive containing all your wiki pages and uploaded images. 
                Keep this for your records or to move your wiki to another instance.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-2xl hover:bg-blue-50 transition-all font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? "Preparing..." : (
                <>
                  <Download size={20} /> Export ZIP
                </>
              )}
            </button>
          </div>
        </section>

        {/* Restore Section */}
        <section id="restore-section" className="bg-slate-50 rounded-3xl p-8 border-2 border-dashed border-slate-200">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="p-4 bg-white rounded-2xl shadow-sm">
              <Upload size={40} className="text-slate-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Restore Backup</h2>
              <p className="text-slate-500 text-sm">
                Upload a previously exported <code>.zip</code> backup to restore all wiki data and images.
              </p>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".zip"
                onChange={handleRestore}
                disabled={restoring}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Select backup ZIP"
              />
              <button
                disabled={restoring}
                className="flex items-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-2xl hover:bg-black transition-all font-bold shadow-lg disabled:opacity-50"
              >
                {restoring ? "Restoring..." : (
                  <>
                    <Upload size={20} /> Select ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Lisp Import Section */}
        <section id="lisp-import-section" className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Code size={32} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Import from Lisp/Racket</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Paste Lisp data (e.g. Racket lists, definitions, or symbols). Supports <code>(list ("Title" "Content") ...)</code>, <code>(define-page Name "Content")</code>, etc.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <textarea
                value={lispText}
                onChange={(e) => setLispText(e.target.value)}
                placeholder='( ("Page Name" "# Content here...") ("Another Page" "## More content") )'
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-slate-700"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info size={14} />
                  <span>Existing pages with the same name will be overwritten.</span>
                </div>
                <button
                  onClick={handleLispImport}
                  disabled={importingLisp || !lispText.trim()}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importingLisp ? "Importing..." : "Process Lisp List"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {status && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 ${
            status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {status.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="font-semibold">{status.message}</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
