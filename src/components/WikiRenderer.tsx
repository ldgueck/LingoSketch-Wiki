import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";

interface WikiRendererProps {
  content: string;
}

export const WikiRenderer: React.FC<WikiRendererProps> = ({ content }) => {
  // Helper to match server-side filename cleaning from server.ts
  const cleanFilename = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');

  const isYoutubeUrl = (url: string) => {
    return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url);
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
  };

  // Regex to find [[WikiLink]] or [[Display|WikiLink]]
  const wikiLinkRegex = /\[\[(?:([^|\]]+)\|)?([^\]]+)\]\]/g;
  // Regex to find ![[Image.png]] or ![[Image.png|params]]
  const imageLinkRegex = /!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;

  let processedContent = content;

  // 1. Handle ![[Image.png|params]] -> <img src="/images/Image.png" title="params" />
  processedContent = processedContent.replace(imageLinkRegex, (match, filename, params) => {
    const trimmed = filename.trim();
    const cleaned = cleanFilename(trimmed);
    const paramStr = params ? `|${params.trim()}` : "";
    
    // Check if it's a YouTube URL
    if (isYoutubeUrl(trimmed)) {
       return `![${trimmed}${paramStr}](${trimmed})`;
    }

    // Check if it's a PDF file to embed as an iframe via custom image renderer
    if (trimmed.toLowerCase().endsWith(".pdf")) {
      return `![${trimmed}${paramStr}](/pdfs/${encodeURIComponent(cleaned)})`;
    }
    
    // Check if it's an audio file
    const allowedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
    if (allowedAudioExts.some(ext => trimmed.toLowerCase().endsWith(ext))) {
      return `![${trimmed}${paramStr}](/audio/${encodeURIComponent(cleaned)})`;
    }

    // Check if it's a video file
    const allowedVideoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
    if (allowedVideoExts.some(ext => trimmed.toLowerCase().endsWith(ext))) {
      return `![${trimmed}${paramStr}](/videos/${encodeURIComponent(cleaned)})`;
    }
    
    // We encode parameters into the alt text, separated by |
    return `![${trimmed}${paramStr}](/images/${encodeURIComponent(cleaned)})`;
  });

  // 2. Handle [[WikiLink]] -> [WikiLink](/view/WikiLink)
  // We need to transform [[Page]] into [Page](/view/Page) so ReactMarkdown can handle it
  processedContent = processedContent.replace(wikiLinkRegex, (match, display, page) => {
    const label = display || page;
    const pageTrimmed = page.trim();

    // Check if it's a YouTube URL
    if (isYoutubeUrl(pageTrimmed)) {
       return `[${label}](${pageTrimmed})`;
    }
    
    // Check if it's an image file
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pageTrimmed)) {
      const cleaned = cleanFilename(pageTrimmed);
      return `[${label}](/images/${encodeURIComponent(cleaned)})`;
    }
    
    // Check if it's a PDF file
    if (/\.(pdf)$/i.test(pageTrimmed)) {
      const cleaned = cleanFilename(pageTrimmed);
      return `[${label}](/pdfs/${encodeURIComponent(cleaned)})`;
    }

    // Check if it's an audio file
    const allowedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
    if (allowedAudioExts.some(ext => pageTrimmed.toLowerCase().endsWith(ext))) {
      const cleaned = cleanFilename(pageTrimmed);
      return `[🎵 ${label}](/audio/${encodeURIComponent(cleaned)})`;
    }

    // Check if it's a video file
    const allowedVideoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
    if (allowedVideoExts.some(ext => pageTrimmed.toLowerCase().endsWith(ext))) {
      const cleaned = cleanFilename(pageTrimmed);
      return `[🎥 ${label}](/videos/${encodeURIComponent(cleaned)})`;
    }
    
    const url = `/view/${pageTrimmed.replace(/ /g, "_")}`;
    return `[${label}](${url})`;
  });

  return (
    <div className="markdown-body">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            const isInternal = props.href?.startsWith("/view/");
            if (isInternal) {
              return <Link to={props.href!} {...props} className="text-blue-600 font-bold hover:underline" />;
            }
            return <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />;
          },
          img: ({ node, ...props }) => {
            const alt = props.alt || "";
            const parts = alt.split("|");
            // First part is filename, subsequent are params
            const params = parts.slice(1);
            
            let width: string | number | undefined = undefined;
            let height: string | number | undefined = undefined;
            let align: "left" | "right" | "center" | undefined = undefined;

            params.forEach(param => {
              const p = param.toLowerCase().trim();
              if (p === "left" || p === "right" || p === "center") {
                align = p;
              } else if (p.includes("x")) {
                const [w, h] = p.split("x");
                if (!isNaN(parseInt(w))) width = parseInt(w);
                if (!isNaN(parseInt(h))) height = parseInt(h);
              } else if (!isNaN(parseInt(p))) {
                width = parseInt(p);
              }
            });

            // Customize behavior for PDF documents
            const isPdf = props.src?.toLowerCase().endsWith(".pdf") || props.src?.includes("/pdfs/") || params.some(p => p.toLowerCase().trim() === "pdf");
            
            if (isPdf) {
              return (
                <span className="block my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                  <span className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-sans font-semibold">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold">PDF</span> {parts[0]}
                    </span>
                    <a href={props.src} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline shrink-0 font-medium">Open in New Tab</a>
                  </span>
                  <iframe
                    src={props.src}
                    title={parts[0]}
                    style={{ width: "100%", height: height ? `${height}px` : "600px" }}
                    className="bg-white border-0"
                  />
                </span>
              );
            }

            // Customize behavior for Audio documents
            const allowedAudioExtensions = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
            const isAudio = props.src?.toLowerCase().match(/\.(mp3|wav|ogg|aac|m4a|flac)$/) || props.src?.includes("/audio/") || params.some(p => p.toLowerCase().trim() === "audio");

            if (isAudio) {
              return (
                <span className="block my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
                  <span className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="px-1.5 py-0.5 bg-teal-100 text-teal-600 rounded text-[10px] font-bold">AUDIO</span> {parts[0]}
                    </span>
                    <a href={props.src} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline shrink-0 font-medium font-sans">Download / Open</a>
                  </span>
                  <span className="p-4 bg-white flex flex-col items-center justify-center">
                    <audio src={props.src} controls className="w-full max-w-xl" />
                  </span>
                </span>
              );
            }

            // Customize behavior for Video documents
            const isVideo = props.src?.toLowerCase().match(/\.(mp4|webm|ogg|mov|mkv|avi|3gp)$/) || props.src?.includes("/videos/") || params.some(p => p.toLowerCase().trim() === "video");
            const isYoutube = props.src && isYoutubeUrl(props.src);

            if (isYoutube) {
              return (
                <span className="block my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
                  <span className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[10px] font-bold">YOUTUBE</span> {parts[0]}
                    </span>
                    <a href={props.src} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline shrink-0 font-medium font-sans">Open in YouTube</a>
                  </span>
                  <span className="p-4 bg-white flex flex-col items-center justify-center">
                    <iframe
                      src={getYoutubeEmbedUrl(props.src!)}
                      title={parts[0]}
                      className="w-full rounded-lg border border-slate-200 bg-black/5 aspect-video"
                      style={{ maxHeight: "480px" }}
                      allowFullScreen
                    />
                  </span>
                </span>
              );
            }

            if (isVideo) {
              return (
                <span className="block my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
                  <span className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[10px] font-bold">VIDEO</span> {parts[0]}
                    </span>
                    <a href={props.src} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline shrink-0 font-medium font-sans">Download / Open</a>
                  </span>
                  <span className="p-4 bg-white flex flex-col items-center justify-center">
                    <video src={props.src} controls className="w-full rounded-lg border border-slate-200 bg-black/5" style={{ maxHeight: "480px" }} />
                  </span>
                </span>
              );
            }

            const style: React.CSSProperties = {
              width: width ? `${width}px` : "auto",
              height: height ? `${height}px` : "auto",
              maxWidth: "100%",
              display: align === "center" ? "block" : "inline-block",
              marginLeft: align === "center" || align === "right" ? "auto" : "0",
              marginRight: align === "center" || align === "left" ? "auto" : "0",
              float: (align === "left" || align === "right") ? align : "none",
              marginBottom: "1rem",
              borderRadius: "0.5rem"
            };

            return (
              <span className={`block overflow-hidden ${align === "center" ? "text-center" : ""}`}>
                <img 
                  {...props} 
                  alt={parts[0]} 
                  style={style}
                  className="shadow-sm border border-slate-200"
                />
              </span>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
