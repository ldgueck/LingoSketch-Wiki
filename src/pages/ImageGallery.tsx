import React, { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { Upload, Trash2, Image as ImageIcon, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WikiImage {
  name: string;
  url: string;
}

export default function ImageGallery() {
  const [images, setImages] = useState<WikiImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchImages = async () => {
    try {
      const res = await fetch("/api/images", { credentials: "include" });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setImages(data);
        setLoading(false);
      } else {
        const text = await res.text();
        if (text.includes("doctype html") && text.includes("Cookie check")) {
           // Handle platform cookie intercept
           console.warn("[GALLERY] Hit platform cookie check. User interaction might be needed.");
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      // Loop through files and upload them individually for better reliability
      // and to avoid potential batch upload issues on the server/proxy
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`[GALLERY] Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        const formData = new FormData();
        formData.append("image", file, file.name);

        const res = await fetch("/api/upload", {
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
          console.error("[GALLERY] Server returned non-JSON response:", text);
          
          if (text.includes("doctype html") && text.includes("Cookie check")) {
            throw new Error("Browser session check required. Please try refreshing the page or clicking 'Open in new window' to re-authenticate.");
          }
          
          throw new Error("Server error: Received HTML instead of JSON. This might happen if the session expired or the server is restarting.");
        }
        
        if (!res.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }
        
        console.log(`[GALLERY] Success for ${file.name}`);
      }
      
      await fetchImages();
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
      console.log(`[GALLERY] Starting delete for: ${name}`);
      // Use the raw name in the URL, as encodeURIComponent is handled by the fetch wrapper/browser
      const res = await fetch(`/api/images/${encodeURIComponent(name)}`, {
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
      
      console.log(`[GALLERY] Delete successful: ${name}`);
      setImages(prev => prev.filter((img) => img.name !== name));
    } catch (error) {
      console.error("[GALLERY] Delete failed:", error);
      alert(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeletingName(null);
    }
  };

  const copyToClipboard = (url: string, filename: string) => {
    // Use wiki-style syntax for a better user experience as it's more readable and matches our renderer
    const wikiSyntax = `![[${filename}]]`;
    navigator.clipboard.writeText(wikiSyntax);
    setCopiedId(filename);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Layout pageTitle="Image Gallery">
      <div className="flex flex-col gap-8">
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
              <Upload size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Upload Images</h2>
              <p className="text-slate-500 text-sm mt-1">
                Upload images to your wiki's <code>/images</code> folder. 
                Original filenames are preserved.
              </p>
            </div>
            <label className="relative cursor-pointer bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50">
              {uploading ? "Uploading..." : "Select Images"}
              <input
                type="file"
                className="hidden"
                accept="image/*"
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
              <ImageIcon size={20} className="text-blue-500" />
              Your Images ({images.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : images.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {images.map((img) => (
                  <motion.div
                    key={img.name}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-mono text-slate-400 truncate mb-2" title={img.name}>
                        {img.name}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(img.url, img.name)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          {copiedId === img.name ? (
                            <>
                              <Check size={14} /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={14} /> Copy Markdown
                            </>
                          )}
                        </button>
                        {confirmDelete === img.name ? (
                          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 text-center animate-in fade-in zoom-in duration-200">
                             <p className="text-sm font-bold text-white mb-3 leading-tight">Delete this image?</p>
                             <div className="flex flex-col w-full gap-2 px-2">
                               <button
                                 onClick={() => handleDelete(img.name)}
                                 disabled={deletingName === img.name}
                                 className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                               >
                                 {deletingName === img.name ? "Deleting..." : "Yes, Delete"}
                               </button>
                               <button
                                 onClick={() => setConfirmDelete(null)}
                                 className="w-full py-2 bg-white/20 text-white rounded-lg text-xs font-bold hover:bg-white/30 transition-colors font-semibold"
                               >
                                 Cancel
                               </button>
                             </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(img.name)}
                            disabled={deletingName === img.name}
                            className="p-1.5 bg-slate-100 hover:bg-red-500 hover:text-white rounded-lg text-slate-400 transition-colors disabled:opacity-50"
                          >
                            {deletingName === img.name ? (
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
              <p className="text-slate-400">No images uploaded yet.</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
