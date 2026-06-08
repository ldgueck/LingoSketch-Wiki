import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { Upload, Trash2, FileText, Copy, Check, Eye, X, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WikiPdf {
  name: string;
  url: string;
}

export default function PdfGallery() {
  const [pdfs, setPdfs] = useState<WikiPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<WikiPdf | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchPdfs = async () => {
    try {
      const res = await fetch("/api/pdfs", { credentials: "include" });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setPdfs(data);
        setLoading(false);
      } else {
        const text = await res.text();
        if (text.includes("doctype html") && text.includes("Cookie check")) {
          console.warn("[PDFS] Hit platform cookie check. User interaction might be needed.");
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch PDFs:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          alert(`File "${file.name}" is not a PDF.`);
          continue;
        }
        
        console.log(`[PDFS] Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        const formData = new FormData();
        formData.append("pdf", file, file.name);

        const res = await fetch("/api/upload-pdf", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        const contentType = res.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const text = await res.text();
          console.error("[PDFS] Server returned non-JSON response:", text);
          throw new Error("Server error: Received HTML instead of JSON.");
        }
        
        if (!res.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }
        
        console.log(`[PDFS] Success for ${file.name}`);
      }
      
      await fetchPdfs();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = async (name: string) => {
    setDeletingName(name);
    setConfirmDelete(null);
    try {
      console.log(`[PDFS] Starting delete for: ${name}`);
      const res = await fetch(`/api/pdfs/${encodeURIComponent(name)}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Delete failed");
        }
      } else if (!res.ok) {
        throw new Error("Delete failed with non-JSON response");
      }
      
      console.log(`[PDFS] Delete successful: ${name}`);
      setPdfs(prev => prev.filter((pdf) => pdf.name !== name));
      if (selectedPdf && selectedPdf.name === name) {
        setSelectedPdf(null);
      }
    } catch (error) {
      console.error("[PDFS] Delete failed:", error);
      alert(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeletingName(null);
    }
  };

  const copyToClipboard = (url: string, filename: string) => {
    const wikiSyntax = `[[${filename}]]`;
    navigator.clipboard.writeText(wikiSyntax);
    setCopiedId(filename);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Layout pageTitle="PDF Gallery">
      <div className="flex flex-col gap-8">
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
            <div className="p-4 bg-red-50 text-red-600 rounded-full">
              <Upload size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Upload PDF Documents</h2>
              <p className="text-slate-500 text-sm mt-1">
                Upload PDF documents to your wiki's <code>/pdfs</code> folder. 
                Original filenames are preserved.
              </p>
            </div>
            <label className="relative cursor-pointer bg-red-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50">
              {uploading ? "Uploading..." : "Select PDFs"}
              <input
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={handleUpload}
                disabled={uploading}
                multiple
              />
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-red-500" />
              Your PDF Documents ({pdfs.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : pdfs.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {pdfs.map((pdf) => (
                  <motion.div
                    key={pdf.name}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div 
                      onClick={() => setSelectedPdf(pdf)}
                      className="aspect-square bg-slate-50 flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-100/80 transition-colors group/view gap-3 relative"
                    >
                      <div className="p-4 bg-red-50 text-red-500 rounded-xl group-hover/view:scale-110 transition-transform">
                        <FileText size={40} />
                      </div>
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/view:opacity-100 transition-opacity flex items-center justify-center rounded-t-xl">
                        <span className="bg-white/90 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                          <Eye size={14} /> Open Full Screen
                        </span>
                      </div>
                    </div>

                    <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                      <p className="text-xs font-medium text-slate-700 truncate mb-2" title={pdf.name}>
                        {pdf.name}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(pdf.url, pdf.name)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-red-600 hover:text-white border border-slate-200 hover:border-red-600 rounded-lg text-xs font-semibold transition-all shadow-sm"
                        >
                          {copiedId === pdf.name ? (
                            <>
                              <Check size={14} /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={14} /> Copy Link
                            </>
                          )}
                        </button>
                        {confirmDelete === pdf.name ? (
                          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 text-center animate-in fade-in zoom-in duration-200">
                             <p className="text-sm font-bold text-white mb-3 leading-tight font-sans">Delete this PDF?</p>
                             <div className="flex flex-col w-full gap-2 px-2">
                               <button
                                 onClick={() => handleDelete(pdf.name)}
                                 disabled={deletingName === pdf.name}
                                 className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                               >
                                 {deletingName === pdf.name ? "Deleting..." : "Yes, Delete"}
                               </button>
                               <button
                                 onClick={() => setConfirmDelete(null)}
                                 className="w-full py-2 bg-white/20 text-white rounded-lg text-xs font-bold hover:bg-white/30 transition-colors"
                               >
                                 Cancel
                               </button>
                             </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(pdf.name)}
                            disabled={deletingName === pdf.name}
                            className="p-1.5 bg-white hover:bg-red-500 hover:text-white border border-slate-200 hover:border-red-500 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50 shadow-sm"
                          >
                            {deletingName === pdf.name ? (
                              <div className="h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-sans">No PDFs uploaded yet. Upload your first PDF to get started!</p>
            </div>
          )}
        </section>
      </div>

      {/* PDF View Modal Overlay */}
      <AnimatePresence>
        {selectedPdf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 z-50 font-sans"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className={`bg-white rounded-2xl shadow-2xl flex flex-col transition-all overflow-hidden ${
                isFullscreen ? "w-screen h-screen m-0 rounded-none" : "w-full max-w-5xl h-[85vh]"
              }`}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                    <FileText size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800 truncate" title={selectedPdf.name}>
                    {selectedPdf.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all"
                    title={isFullscreen ? "Minimize Viewer" : "Full Viewport"}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPdf(null);
                      setIsFullscreen(false);
                    }}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* PDF Container */}
              <div className="flex-1 bg-slate-800 p-2 md:p-4 flex items-center justify-center">
                <iframe
                  src={selectedPdf.url}
                  className="w-full h-full rounded-lg border-0 shadow-lg bg-white"
                  title={selectedPdf.name}
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span>Rendering natively via browser capability</span>
                <button
                  onClick={() => copyToClipboard(selectedPdf.url, selectedPdf.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-600 hover:text-white border border-slate-200 hover:border-red-600 font-medium rounded-lg transition-colors shadow-sm text-slate-700"
                >
                  <Copy size={12} /> {copiedId === selectedPdf.name ? "Copied Link!" : "Copy Wiki Link"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
