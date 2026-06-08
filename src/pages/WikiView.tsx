import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Edit2, Trash2, Home, ArrowLeft, Type, Link as LinkIcon, Download, X, AlertTriangle, FileText, Code } from "lucide-react";
import { Layout } from "../components/Layout";
import { WikiRenderer } from "../components/WikiRenderer";

function renderMarkdownToBasicHTML(markdown: string, pageName: string): string {
  let html = markdown
    // Escape HTML a bit
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-50 p-4 rounded-xl font-mono text-sm overflow-x-auto border border-slate-100 my-4"><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600">$1</code>');

  // Headers (H1 - H6)
  html = html.replace(/^\s*###### (.*$)/gim, '<h6 class="text-sm font-bold text-slate-900 mt-4 mb-2">$1</h6>');
  html = html.replace(/^\s*##### (.*$)/gim, '<h5 class="text-base font-bold text-slate-900 mt-5 mb-2">$1</h5>');
  html = html.replace(/^\s*#### (.*$)/gim, '<h4 class="text-lg font-bold text-slate-900 mt-6 mb-2">$1</h4>');
  html = html.replace(/^\s*### (.*$)/gim, '<h3 class="text-xl font-bold text-slate-900 mt-8 mb-3">$1</h3>');
  html = html.replace(/^\s*## (.*$)/gim, '<h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 pb-2 border-b border-slate-100">$1</h2>');
  html = html.replace(/^\s*# (.*$)/gim, '<h1 class="text-3xl font-extrabold text-slate-900 mt-12 mb-6">$1</h1>');

  // Images ![[Filename]] or ![[Filename|caption]]
  html = html.replace(/!\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (match, filename, caption) => {
    const cleanName = filename.trim();
    if (cleanName.toLowerCase().endsWith(".pdf")) {
      let height = "600px";
      if (caption) {
        const num = parseInt(caption);
        if (!isNaN(num)) height = `${num}px`;
      }
      return `<div class="my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
        <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-sans font-semibold">
          <span class="flex items-center gap-1.5 truncate">
            <span class="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold">PDF</span> ${cleanName}
          </span>
          <a href="/pdfs/${encodeURIComponent(cleanName)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium">Open in New Tab</a>
        </div>
        <iframe src="/pdfs/${encodeURIComponent(cleanName)}" title="${cleanName}" style="width: 100%; height: ${height};" class="bg-white border-0" />
      </div>`;
    }
    const allowedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
    if (allowedAudioExts.some(ext => cleanName.toLowerCase().endsWith(ext))) {
      return `<div class="my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
        <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span class="flex items-center gap-1.5 truncate">
            <span class="px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded text-[10px] font-bold">AUDIO</span> ${cleanName}
          </span>
          <a href="/audio/${encodeURIComponent(cleanName)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium">Download / Open</a>
        </div>
        <div class="p-4 bg-white flex flex-col items-center justify-center">
          <audio src="/audio/${encodeURIComponent(cleanName)}" controls class="w-full max-w-xl"></audio>
          ${caption ? `<div class="text-xs text-slate-400 mt-2 font-medium">${caption}</div>` : ""}
        </div>
      </div>`;
    }
    const allowedVideoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
    if (allowedVideoExts.some(ext => cleanName.toLowerCase().endsWith(ext))) {
      let width = "100%";
      if (caption) {
        const num = parseInt(caption);
        if (!isNaN(num)) width = `${num}px`;
      }
      return `<div class="my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
        <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span class="flex items-center gap-1.5 truncate">
            <span class="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">VIDEO</span> ${cleanName}
          </span>
          <a href="/videos/${encodeURIComponent(cleanName)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium">Download / Open</a>
        </div>
        <div class="p-4 bg-white flex flex-col items-center justify-center">
          <video src="/videos/${encodeURIComponent(cleanName)}" controls style="width: ${width}; max-height: 480px;" class="rounded-xl border border-slate-200 shadow-sm"></video>
          ${caption && isNaN(parseInt(caption)) ? `<div class="text-xs text-slate-400 mt-2 font-medium">${caption}</div>` : ""}
        </div>
      </div>`;
    }
    return `<figure class="my-6"><img src="/images/${filename}" alt="${caption || filename}" class="rounded-2xl max-h-96 mx-auto object-cover border border-slate-150" />${caption ? `<figcaption class="text-center text-xs text-slate-400 mt-2 font-medium">${caption}</figcaption>` : ''}</figure>`;
  });

  // Links [[Page]] or [[Label|Page]]
  html = html.replace(/\[\[(?:([^|\]\n]+)\|)?([^\]\n]+)\]\]/g, (match, label, target) => {
    const cleanTarget = (target || "").trim().replace(/ /g, "_");
    const cleanLabel = (label || target || "").trim().replace(/_/g, " ");
    
    if (cleanTarget.toLowerCase().endsWith(".pdf")) {
      return `<a href="/pdfs/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-medium">${cleanLabel}</a>`;
    }
    const allowedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
    if (allowedAudioExts.some(ext => cleanTarget.toLowerCase().endsWith(ext))) {
      return `<a href="/audio/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-teal-600 hover:text-teal-850 underline font-medium">🎵 ${cleanLabel}</a>`;
    }
    const allowedVideoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
    if (allowedVideoExts.some(ext => cleanTarget.toLowerCase().endsWith(ext))) {
      return `<a href="/videos/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-rose-600 hover:text-rose-800 underline font-medium">🎥 ${cleanLabel}</a>`;
    }
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(cleanTarget)) {
      return `<a href="/images/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-medium">${cleanLabel}</a>`;
    }
    return `<a href="/view/${cleanTarget}" class="text-blue-600 hover:text-blue-800 underline font-medium">${cleanLabel}</a>`;
  });

  // Blockquotes
  html = html.replace(/^\s*>\s+(.*$)/gim, '<blockquote class="border-l-4 border-slate-300 pl-4 py-1 italic text-slate-600 my-4">$1</blockquote>');

  // Unordered list items
  html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-700 py-0.5">$1</li>');

  // Ordered list items
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-slate-700 py-0.5">$1</li>');

  // Replace double linebreaks with paragraphs, except around block-level elements
  const lines = html.split('\n');
  let insideList = false;
  let parsedContent = '';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const isBlock = line.startsWith('<h') || line.startsWith('<pre') || line.startsWith('<blockquote') || line.startsWith('<li') || line.startsWith('<figure') || line.startsWith('</li') || line.startsWith('</ul') || line.startsWith('</ol');
    
    if (line.startsWith('<li')) {
      if (!insideList) {
        parsedContent += '<ul class="my-4">';
        insideList = true;
      }
    } else if (insideList && !line.startsWith('<li')) {
      parsedContent += '</ul>';
      insideList = false;
    }

    if (isBlock) {
      parsedContent += line;
    } else {
      parsedContent += `<p class="leading-relaxed text-slate-700 my-4">${line}</p>`;
    }
  }
  
  if (insideList) {
    parsedContent += '</ul>';
  }

  return parsedContent;
}

export default function WikiView() {
  const { name } = useParams<{ name: string }>();
  const [page, setPage] = useState<{ name: string; content: string } | null>(null);
  const [backlinks, setBacklinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Dialog & Modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  const pageName = name || "HomePage";

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pages/${pageName}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) return { name: pageName, content: "# Page Not Found\n\nThis page doesn't exist yet. Would you like to [[edit]] it?" };
        if (!res.ok) throw new Error("Failed to load page");
        return res.json();
      })
      .then((data) => {
        setPage(data);
        setRenameValue(data.name.replace(/_/g, " "));
      })
      .catch((err) => {
        console.error(err);
        setPage({ name: pageName, content: "# Error Loading Page\n\nThe server failed to provide the page content. Please try refreshing." });
      })
      .finally(() => {
        setLoading(false);
      });

    fetch(`/api/backlinks/${pageName}`, { credentials: "include" })
      .then((res) => res.json())
      .then(setBacklinks)
      .catch(console.error);
  }, [pageName]);

  const handleDelete = async () => {
    setIsDeleteOpen(false);
    await fetch(`/api/pages/${pageName}`, { method: "DELETE", credentials: "include" });
    navigate("/");
  };

  const exportAsHTML = () => {
    if (!page) return;
    const cleanName = page.name.replace(/_/g, " ");
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cleanName}</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Inter', sans-serif;
      }
      code {
        font-family: 'JetBrains Mono', monospace;
      }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen py-10 px-4 sm:px-6">
    <div class="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm">
        <header class="border-b border-slate-100 pb-6 mb-8">
            <span class="text-xs font-bold uppercase tracking-wider text-blue-600">Exported Wiki Page</span>
            <h1 class="text-3xl font-extrabold text-slate-900 mt-1">${cleanName}</h1>
        </header>
        <article class="prose prose-slate max-w-none">
            ${renderMarkdownToBasicHTML(page.content, page.name)}
        </article>
        <footer class="border-t border-slate-100 mt-12 pt-6 text-xs text-slate-400 text-center">
            Generated from Lingosketch Wiki on ${new Date().toLocaleDateString()}
        </footer>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${page.name}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportOpen(false);
  };

  const exportAsMarkdown = () => {
    if (!page) return;
    const blob = new Blob([page.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${page.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportOpen(false);
  };

  const exportAsBackupZIP = () => {
    window.location.href = `/api/export?format=zip&startPage=${encodeURIComponent(pageName)}`;
    setIsExportOpen(false);
  };

  const exportAsHTMLBranchZIP = () => {
    window.location.href = `/api/export?format=html&startPage=${encodeURIComponent(pageName)}`;
    setIsExportOpen(false);
  };

  const handleRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRenameError("");
    
    const newNameClean = renameValue.trim();
    if (!newNameClean) {
      setRenameError("Page name cannot be empty");
      return;
    }
    
    if (newNameClean === pageName.replace(/_/g, " ")) {
      setIsRenameOpen(false);
      return;
    }

    try {
      const res = await fetch(`/api/pages/${pageName}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: newNameClean }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setIsRenameOpen(false);
        navigate(`/view/${data.newName}`);
      } else {
        setRenameError(data.error || "Rename failed");
      }
    } catch (error) {
      console.error("Rename error:", error);
      setRenameError("An error occurred during rename");
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
          onClick={() => {
            setRenameValue(page?.name.replace(/_/g, " ") || pageName.replace(/_/g, " "));
            setRenameError("");
            setIsRenameOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm"
        >
          <Type size={16} /> Rename
        </button>
        <button 
          onClick={() => setIsExportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all font-semibold text-sm"
        >
          <Download size={16} /> Export Page
        </button>
        <button 
          onClick={() => setIsDeleteOpen(true)}
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

      {/* Export Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Export Branch</h3>
                <p className="text-xs text-slate-500 mt-1">Select your preferred format to export the active branch starting from <strong className="text-slate-700">{pageName.replace(/_/g, " ")}</strong>.</p>
              </div>
              <button 
                onClick={() => setIsExportOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={exportAsHTMLBranchZIP}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 text-left hover:border-blue-500 hover:bg-blue-50/40 transition-all group"
              >
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Code size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Zipped HTML Branch (.zip)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Generates a folder containing all reachable pages as styled HTML files and exports them packed. Images referenced in the branch are included offline!</p>
                </div>
              </button>

              <button
                onClick={exportAsBackupZIP}
                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 text-left hover:border-green-500 hover:bg-green-50/40 transition-all group"
              >
                <div className="p-3 bg-green-100 text-green-600 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-all">
                  <Download size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Wiki Branch Backup ZIP (.zip)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Exports a raw JSON database slice, page histories, and only the images referenced in the active branch starting from this page.</p>
                </div>
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsExportOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {isRenameOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleRename}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Rename Page</h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating this page's name will also migrate internal <code>[[WikiLinks]]</code> tracking references across other pages automatically.
            </p>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="New page name"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                autoFocus
              />
              {renameError && (
                <p className="text-xs text-red-500 font-semibold">{renameError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRenameOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-200"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col items-center text-center">
            <div className="p-3 bg-red-100 text-red-600 rounded-full mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Page</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete <strong className="text-slate-800">{pageName.replace(/_/g, " ")}</strong>? This action cannot be undone.
            </p>

            <div className="flex gap-3 w-full justify-end">
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-red-200 flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
