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
    // We encode parameters into the alt text, separated by |
    return `![${trimmed}${paramStr}](/images/${encodeURIComponent(cleaned)})`;
  });

  // 2. Handle [[WikiLink]] -> [WikiLink](/view/WikiLink)
  // We need to transform [[Page]] into [Page](/view/Page) so ReactMarkdown can handle it
  processedContent = processedContent.replace(wikiLinkRegex, (match, display, page) => {
    const label = display || page;
    const pageTrimmed = page.trim();
    
    // Check if it's an image file
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pageTrimmed)) {
      const cleaned = cleanFilename(pageTrimmed);
      return `[${label}](/images/${encodeURIComponent(cleaned)})`;
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
