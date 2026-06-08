import React, { useState, useEffect, useRef } from "react";
import { Layout } from "../components/Layout";
import { Upload, Trash2, Volume2, Copy, Check, Play, Pause, Music, Disc } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WikiAudio {
  name: string;
  url: string;
}

export default function AudioGallery() {
  const [audioFiles, setAudioFiles] = useState<WikiAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio Playback State
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const fetchAudioFiles = async () => {
    try {
      const res = await fetch("/api/audio", { credentials: "include" });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setAudioFiles(data);
        setLoading(false);
      } else {
        const text = await res.text();
        if (text.includes("doctype html") && text.includes("Cookie check")) {
          console.warn("[AUDIO] Plattform cookie check hit.");
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch audio files:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudioFiles();
    
    // Clean up audio player on unmount
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const allowedExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const hasValidExt = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!hasValidExt) {
          alert(`File "${file.name}" is not a recognized audio file.`);
          continue;
        }

        console.log(`[AUDIO] Uploading file ${i + 1}/${files.length}: ${file.name}`);

        const formData = new FormData();
        formData.append("audio", file, file.name);

        const res = await fetch("/api/upload-audio", {
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
          console.error("[AUDIO] Server returned non-JSON response:", text);
          throw new Error("Server error: Received HTML instead of JSON.");
        }

        if (!res.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }

        console.log(`[AUDIO] Success for ${file.name}`);
      }

      await fetchAudioFiles();
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
      console.log(`[AUDIO] Starting delete for: ${name}`);
      const res = await fetch(`/api/audio/${encodeURIComponent(name)}`, {
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

      console.log(`[AUDIO] Delete successful: ${name}`);
      setAudioFiles(prev => prev.filter((item) => item.name !== name));
      
      // Stop media if we delete the active playing track
      const matching = audioFiles.find(a => a.name === name);
      if (matching && activeUrl === matching.url) {
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        setActiveUrl(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("[AUDIO] Delete failed:", error);
      alert(error instanceof Error ? error.message : "Delete failed. Please try again.");
    } finally {
      setDeletingName(null);
    }
  };

  const copyToClipboard = (filename: string) => {
    const wikiSyntax = `[[${filename}]]`;
    navigator.clipboard.writeText(wikiSyntax);
    setCopiedId(filename);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePlay = (url: string) => {
    if (activeUrl === url) {
      if (isPlaying) {
        audioPlayerRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setActiveUrl(url);
      setIsPlaying(true);
      
      // Instantly start new audio element
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.play().catch(e => {
        console.error("Playback failed:", e);
        setIsPlaying(false);
      });
      
      // Listen for ending to reset state
      audio.onended = () => {
        setIsPlaying(false);
        setActiveUrl(null);
      };
    }
  };

  const getExtensionBadgeColor = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "mp3": return "bg-emerald-100 text-emerald-800";
      case "wav": return "bg-sky-100 text-sky-800";
      case "ogg": return "bg-indigo-100 text-indigo-800";
      case "m4a": return "bg-fuchsia-100 text-fuchsia-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <Layout pageTitle="Audio Gallery">
      <div className="flex flex-col gap-8">
        {/* Upload Zone */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center max-w-md mx-auto">
            <div className="p-4 bg-teal-50 text-teal-600 rounded-full">
              <Upload size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Upload Soundtracks & Voice</h2>
              <p className="text-slate-500 text-sm mt-1 font-sans">
                Upload MP3, WAV, OGG, AAC or M4A audio clips. You can reference them
                instinctively in any page via <code>[[filename.mp3]]</code> or auto-embed them using <code>![[filename.mp3]]</code>!
              </p>
            </div>
            <label className="relative cursor-pointer bg-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 disabled:opacity-50">
              {uploading ? "Uploading..." : "Select Audio"}
              <input
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={handleUpload}
                disabled={uploading}
                multiple
              />
            </label>
          </div>
        </section>

        {/* Audio Tracks Listing */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
              <Volume2 size={20} className="text-teal-600 animate-pulse" />
              Your Audio Library ({audioFiles.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : audioFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {audioFiles.map((audio) => {
                  const isActive = activeUrl === audio.url;
                  const isTrackPlaying = isActive && isPlaying;
                  const extension = audio.name.slice(audio.name.lastIndexOf(".") + 1).toUpperCase();

                  return (
                    <motion.div
                      key={audio.name}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`group relative bg-white border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between p-5 shadow-sm hover:shadow-md ${
                        isActive ? "border-teal-500 ring-4 ring-teal-50" : "border-slate-200"
                      }`}
                    >
                      {/* Top Track Header */}
                      <div className="flex items-start gap-4">
                        {/* Play Control Square */}
                        <button
                          onClick={() => togglePlay(audio.url)}
                          className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all relative shrink-0 shadow-sm ${
                            isActive
                              ? "bg-teal-600 text-white"
                              : "bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600"
                          }`}
                        >
                          {isTrackPlaying ? (
                            <div className="flex items-end gap-1 h-5">
                              <span className="w-1 bg-white animate-[bounce_0.8s_infinite] h-full rounded" />
                              <span className="w-1 bg-white animate-[bounce_0.8s_infinite_0.15s] h-3/4 rounded" />
                              <span className="w-1 bg-white animate-[bounce_0.8s_infinite_0.3s] h-4/5 rounded" />
                            </div>
                          ) : (
                            <Play size={22} className="ml-0.5" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getExtensionBadgeColor(audio.name)}`}>
                              {extension}
                            </span>
                            {isTrackPlaying && (
                              <span className="text-[10px] text-teal-600 font-bold flex items-center gap-1">
                                <Disc size={10} className="animate-spin" /> Playing
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-800 truncate" title={audio.name}>
                            {audio.name}
                          </p>
                        </div>
                      </div>

                      {/* Waveform Graphic or Animation during Play */}
                      <div className="h-10 my-4 bg-slate-50/50 rounded-lg flex items-center justify-center gap-1 px-3 border border-slate-100 overflow-hidden">
                        {isTrackPlaying ? (
                          <div className="flex items-center gap-1 w-full justify-around px-8 h-6">
                            {[...Array(16)].map((_, idx) => (
                              <span
                                key={idx}
                                className="w-0.5 bg-teal-500/80 rounded"
                                style={{
                                  height: `${Math.floor(Math.random() * 80) + 20}%`,
                                  animation: `bounce 1s ease-in-out infinite ${idx * 0.05}s`
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 w-full justify-around px-10 h-6 opacity-30">
                            {[...Array(16)].map((_, idx) => (
                              <span
                                key={idx}
                                className="w-0.5 bg-slate-400 rounded"
                                style={{
                                  height: `${Math.sin(idx / 2) * 35 + 40}%`
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom Copy / Delete Panel */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(audio.name)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-teal-600 hover:text-white border border-slate-200 hover:border-teal-600 rounded-xl text-xs font-bold transition-all shadow-sm text-slate-700"
                        >
                          {copiedId === audio.name ? (
                            <>
                              <Check size={14} className="text-emerald-500 hover:text-white" /> Link Copied
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copy Wiki Tag
                            </>
                          )}
                        </button>
                        
                        {confirmDelete === audio.name ? (
                          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 text-center animate-in fade-in zoom-in duration-200 rounded-2xl">
                             <p className="text-sm font-bold text-white mb-2 leading-tight font-sans">Delete this audio?</p>
                             <p className="text-[10px] text-slate-400 mb-3 truncate max-w-full px-4">{audio.name}</p>
                             <div className="flex flex-col w-full gap-2 px-6">
                               <button
                                 onClick={() => handleDelete(audio.name)}
                                 disabled={deletingName === audio.name}
                                 className="w-full py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                               >
                                 {deletingName === audio.name ? "Deleting..." : "Yes, Delete"}
                               </button>
                               <button
                                 onClick={() => setConfirmDelete(null)}
                                 className="w-full py-2 bg-white/20 text-white rounded-xl text-xs font-bold hover:bg-white/30 transition-colors"
                               >
                                 Cancel
                               </button>
                             </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(audio.name)}
                            disabled={deletingName === audio.name}
                            className="p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-100 rounded-xl text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 shadow-sm"
                            title="Delete Sound"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center p-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-sans">No soundtrack files uploaded yet. Upload your first clip to get started!</p>
            </div>
          )}
        </section>
      </div>

      {/* Global CSS Style override for custom waveforms */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.3); }
        }
      `}</style>
    </Layout>
  );
}
