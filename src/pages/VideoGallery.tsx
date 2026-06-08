import React, { useState, useEffect, useRef } from "react";
import { Layout } from "../components/Layout";
import { Upload, Trash2, Video, Copy, Check, Play, Pause, X, Film, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WikiVideo {
  name: string;
  url: string;
}

export default function VideoGallery() {
  const [videoFiles, setVideoFiles] = useState<WikiVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Theater Modal / Active Player State
  const [previewVideo, setPreviewVideo] = useState<WikiVideo | null>(null);

  const fetchVideoFiles = async () => {
    try {
      const res = await fetch("/api/videos", { credentials: "include" });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setVideoFiles(data);
        setLoading(false);
      } else {
        const text = await res.text();
        if (text.includes("doctype html") && text.includes("Cookie check")) {
          console.warn("[VIDEO] Platform cookie check hit.");
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch video files:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideoFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const allowedExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const hasValidExt = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!hasValidExt) {
          alert(`File "${file.name}" is not a recognized video format.`);
          continue;
        }

        console.log(`[VIDEO] Uploading file ${i + 1}/${files.length}: ${file.name}`);

        const formData = new FormData();
        formData.append("video", file, file.name);

        const res = await fetch("/api/upload-video", {
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
          console.error("[VIDEO] Server returned non-JSON response:", text);
          throw new Error("Server error: Received HTML instead of JSON.");
        }

        if (!res.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }

        console.log(`[VIDEO] Success for ${file.name}`);
      }

      await fetchVideoFiles();
    } catch (error) {
      console.error("Video upload failed:", error);
      alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = ""; // Reset input value
    }
  };

  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = async (name: string) => {
    setDeletingName(name);
    setConfirmDelete(null);
    try {
      console.log(`[VIDEO] Starting delete for: ${name}`);
      const res = await fetch(`/api/videos/${encodeURIComponent(name)}`, {
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

      console.log(`[VIDEO] Delete successful: ${name}`);
      setVideoFiles(prev => prev.filter((item) => item.name !== name));
      
      // Close preview if we are deleting the active video
      if (previewVideo && previewVideo.name === name) {
        setPreviewVideo(null);
      }
    } catch (error) {
      console.error("[VIDEO] Delete failed:", error);
      alert(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeletingName(null);
    }
  };

  const copyToClipboard = (filename: string, isEmbed = false) => {
    const wikiSyntax = isEmbed ? `![[${filename}]]` : `[[${filename}]]`;
    navigator.clipboard.writeText(wikiSyntax);
    setCopiedId(`${filename}-${isEmbed ? 'embed' : 'link'}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getExtensionBadgeColor = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "mp4": return "bg-rose-100 text-rose-800";
      case "webm": return "bg-pink-100 text-pink-800";
      case "ogg": return "bg-purple-100 text-purple-800";
      case "mov": return "bg-amber-100 text-amber-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <Layout pageTitle="Video Gallery">
      <div className="flex flex-col gap-8">
        {/* Upload Zone */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
            <div className="p-4 bg-rose-50 text-rose-600 rounded-full">
              <Film size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Upload Video Clips</h2>
              <p className="text-slate-500 text-sm mt-1 font-sans">
                Upload MP4, WebM, OGG, MOV, or MKV recordings. Link them inside your wiki pages
                via <code>{"[[video_filename.mp4]]"}</code> or embed them instantly using <code>{"![[video_filename.mp4]]"}</code>!
              </p>
            </div>
            <label className="relative cursor-pointer bg-rose-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 disabled:opacity-50">
              {uploading ? "Uploading..." : "Select video file"}
              <input
                type="file"
                className="hidden"
                accept="video/*"
                onChange={handleUpload}
                disabled={uploading}
                multiple
              />
            </label>
          </div>
        </section>

        {/* Video Library Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
              <Video size={20} className="text-rose-600" />
              Your Video Library ({videoFiles.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
            </div>
          ) : videoFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {videoFiles.map((video) => {
                  const extension = video.name.slice(video.name.lastIndexOf(".") + 1).toUpperCase();
                  const isCurrentActivePreview = previewVideo?.url === video.url;

                  return (
                    <motion.div
                      key={video.name}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`group relative bg-white border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-md ${
                        isCurrentActivePreview ? "border-rose-500 ring-4 ring-rose-50" : "border-slate-200"
                      }`}
                    >
                      {/* Video Simulated Thumbnail / Hero player trigger */}
                      <div className="relative w-full aspect-video bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-100 group">
                        {/* Direct Video preview on hover or subtle play icon */}
                        <video 
                          src={video.url} 
                          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" 
                          muted 
                          playsInline 
                        />
                        <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/50 transition-colors" />
                        
                        <button
                          onClick={() => setPreviewVideo(video)}
                          className="relative z-10 w-12 h-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-rose-600 group-hover:text-white transition-all duration-300"
                        >
                          <Play size={20} className="ml-0.5" />
                        </button>

                        <span className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold z-10 ${getExtensionBadgeColor(video.name)}`}>
                          {extension}
                        </span>
                      </div>

                      {/* Content details and copy/delete triggers */}
                      <div className="p-4 flex flex-col flex-1 justify-between">
                        <div className="mb-3">
                          <p className="text-sm font-bold text-slate-800 truncate" title={video.name}>
                            {video.name}
                          </p>
                        </div>

                        {/* Functional actions: Tag copy and delete buttons */}
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex gap-2">
                            {/* Copy Wiki embedded tag button */}
                            <button
                              onClick={() => copyToClipboard(video.name, true)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-100 hover:border-rose-600 rounded-xl text-[11px] font-bold transition-all text-rose-700"
                            >
                              {copiedId === `${video.name}-embed` ? (
                                <>
                                  <Check size={12} className="text-emerald-500 hover:text-white" /> Embedded Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={11} /> Copy Embed Tag
                                </>
                              )}
                            </button>

                            {/* Copy standard wiki link tag button */}
                            <button
                              onClick={() => copyToClipboard(video.name, false)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 hover:bg-slate-800 hover:text-white border border-slate-200 hover:border-slate-800 rounded-xl text-[11px] font-bold transition-all text-slate-700"
                            >
                              {copiedId === `${video.name}-link` ? (
                                <>
                                  <Check size={12} className="text-emerald-500 hover:text-white" /> Link Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={11} /> Copy Link Tag
                                </>
                              )}
                            </button>
                          </div>

                          <div className="flex gap-2">
                            {/* View details / Open inside player triggers */}
                            <button
                              onClick={() => setPreviewVideo(video)}
                              className="flex-1 flex items-center justify-center gap-1 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-medium transition-colors"
                            >
                              <Eye size={12} /> Play Video
                            </button>

                            {confirmDelete === video.name ? (
                              <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 text-center animate-in fade-in zoom-in duration-200 rounded-2xl">
                                 <p className="text-sm font-bold text-white mb-2 leading-tight font-sans">Delete this video clip?</p>
                                 <p className="text-[10px] text-slate-400 mb-3 truncate max-w-full px-4">{video.name}</p>
                                 <div className="flex flex-col w-full gap-2 px-6">
                                   <button
                                     onClick={() => handleDelete(video.name)}
                                     disabled={deletingName === video.name}
                                     className="w-full py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                   >
                                     {deletingName === video.name ? "Deleting..." : "Yes, Delete"}
                                   </button>
                                   <button
                                     onClick={() => setConfirmDelete(null)}
                                     className="w-full py-1.5 bg-white/20 text-white rounded-xl text-xs font-bold hover:bg-white/30 transition-colors"
                                   >
                                     Cancel
                                   </button>
                                 </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(video.name)}
                                disabled={deletingName === video.name}
                                className="p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-100 rounded-xl text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Delete Video"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-sans">No video files uploaded yet. Add video recordings with the button above to populate your database!</p>
            </div>
          )}
        </section>
      </div>

      {/* Embedded Theater Preview Modal Dialog */}
      <AnimatePresence>
        {previewVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full border border-slate-200 shadow-2xl relative flex flex-col"
            >
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="flex items-center gap-2">
                  <Film size={18} className="text-rose-600" />
                  <h3 className="font-bold text-slate-800 text-sm truncate max-w-md font-sans">
                    Theater: {previewVideo.name}
                  </h3>
                </span>
                
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-950 aspect-video flex items-center justify-center p-1">
                <video
                  src={previewVideo.url}
                  controls
                  autoPlay
                  className="w-full h-full max-h-[70vh] rounded-lg"
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 font-sans">
                <button
                  onClick={() => copyToClipboard(previewVideo.name, true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Copy size={13} /> Copy Wiki Embed Tag
                </button>
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Close Theater
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
