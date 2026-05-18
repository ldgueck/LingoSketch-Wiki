import express from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import multer from "multer";

import * as archiver from 'archiver';
import unzipper from "unzipper";

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "wiki_storage.json");
const IMAGES_DIR = path.join(process.cwd(), "public", "images");
const VERSIONS_DIR = path.join(process.cwd(), "versions");

// Password set in environment
const APP_PASSWORD = process.env.APP_PASSWORD || "lingo";
const AUTH_COOKIE_NAME = "wiki_auth";

// Helper for folder/file names that are safe but preserve original characters as much as possible
function toSafeFilename(name: string) {
  // Replace only truly problematic filesystem characters, keep spaces and most symbols
  return name.replace(/[<>:"/\\|?*]/g, '_');
}

// Ensure directories exist
if (!existsSync(IMAGES_DIR)) {
  mkdirSync(IMAGES_DIR, { recursive: true });
}
if (!existsSync(VERSIONS_DIR)) {
  mkdirSync(VERSIONS_DIR, { recursive: true });
}

// Configure multer with memory storage to prevent ANY automatic disk writing
const imageUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Separate instance for restore just in case
const restoreUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

async function startServer() {
  const app = express();
  app.use(cookieParser());
  const jsonParser = express.json({ limit: "50mb" });
  app.use(express.text({ limit: "50mb" })); // Also allow raw text just in case

  // Authentication Middleware
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip auth for login api and health check
    if (req.path === "/api/login" || req.path === "/api/auth-status" || req.path === "/api/health") {
      return next();
    }

    // Check cookie
    const authCookie = req.cookies[AUTH_COOKIE_NAME];
    if (authCookie === APP_PASSWORD) {
      return next();
    }

    // If API request, return 401
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Otherwise (for static files or vite) next() and let the frontend handle the redirect if it sees a 401 from API later
    // or we could redirect here, but Vite middleware handles SPA routing.
    next();
  };

  // Serve images from public/images
  app.use("/images", express.static(IMAGES_DIR));
  // Backward compatibility redirect for /uploads
  app.use("/uploads", express.static(IMAGES_DIR));

  // Auth endpoints
  app.post("/api/login", jsonParser, (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
      res.cookie(AUTH_COOKIE_NAME, APP_PASSWORD, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      return res.json({ success: true });
    }
    res.status(401).json({ error: "Invalid password" });
  });

  app.get("/api/auth-status", (req, res) => {
    const authCookie = req.cookies[AUTH_COOKIE_NAME];
    res.json({ isAuthenticated: authCookie === APP_PASSWORD });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.json({ success: true });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Apply auth middleware to all subsequent API routes
  app.use("/api", authMiddleware);

  // API Routes
  app.get("/api/export", async (req, res) => {
    try {
      console.log("[EXPORT] Starting export...");
      const archive = new (archiver as any).ZipArchive({
        zlib: { level: 9 }
      });

      res.attachment("lingosketch-backup.zip");

      archive.on("error", (err) => {
        console.error("[EXPORT] Archiver error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to generate backup", details: err.message });
        }
      });

      // Keep connection alive
      res.on("close", () => {
        console.log("[EXPORT] Response closed");
      });

      archive.pipe(res);
      
      // Add wiki_storage.json
      if (existsSync(DATA_FILE)) {
        console.log(`[EXPORT] Adding ${DATA_FILE}`);
        archive.file(DATA_FILE, { name: "wiki_storage.json" });
      }

      // Add images directory
      if (existsSync(IMAGES_DIR)) {
        console.log(`[EXPORT] Adding images directory: ${IMAGES_DIR}`);
        archive.directory(IMAGES_DIR, "images");
      }

      // Add versions directory
      if (existsSync(VERSIONS_DIR)) {
        console.log(`[EXPORT] Adding versions directory: ${VERSIONS_DIR}`);
        archive.directory(VERSIONS_DIR, "versions");
      }

      await archive.finalize();
      console.log("[EXPORT] Export finalized and sent");
    } catch (error) {
      console.error("[EXPORT] Fatal error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to export data", details: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  app.get("/api/pages", async (req, res) => {
    try {
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const pages = JSON.parse(data);
      res.json(Object.keys(pages));
    } catch (error) {
      res.status(500).json({ error: "Failed to read pages" });
    }
  });

  app.post("/api/restore", restoreUpload.single("backup"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No backup file uploaded" });
      }

      // unzipper.Open.buffer handles the memory buffer from multer
      const directory = await unzipper.Open.buffer(req.file.buffer);
      
      for (const file of directory.files) {
        if (file.path === "wiki_storage.json") {
          const content = await file.buffer();
          await fs.writeFile(DATA_FILE, content);
        } else if ((file.path.startsWith("uploads/") || file.path.startsWith("images/")) && !file.path.endsWith("/")) {
          const relativePath = file.path.replace("uploads/", "").replace("images/", "");
          const destPath = path.join(IMAGES_DIR, relativePath);
          const content = await file.buffer();
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.writeFile(destPath, content);
        } else if (file.path.startsWith("versions/") && !file.path.endsWith("/")) {
          const relativePath = file.path.replace("versions/", "");
          const destPath = path.join(VERSIONS_DIR, relativePath);
          const content = await file.buffer();
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.writeFile(destPath, content);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Restore error:", error);
      res.status(500).json({ error: "Failed to restore backup. Ensure it is a valid backup ZIP." });
    }
  });

  app.get("/api/images", async (req, res) => {
    try {
      if (!existsSync(IMAGES_DIR)) {
        return res.json([]);
      }
      const files = await fs.readdir(IMAGES_DIR);
      // Filter for images and sort by modified time to show newest first
      const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
      
      const images = await Promise.all(imageFiles.map(async (img) => {
        const stats = await fs.stat(path.join(IMAGES_DIR, img));
        return {
          name: img,
          url: `/images/${img}`,
          mtime: stats.mtimeMs
        };
      }));

      // Sort by modified time descending
      images.sort((a, b) => b.mtime - a.mtime);
      
      res.json(images.map(({ name, url }) => ({ name, url })));
    } catch (error) {
      console.error("Fetch images error:", error);
      res.status(500).json({ error: "Failed to list images" });
    }
  });

  app.post("/api/upload", imageUpload.single("image"), async (req, res) => {
    try {
      console.log("[UPLOAD] Received single file upload request");
      const file = req.file;
      
      if (!file) {
        console.warn("[UPLOAD] No file found in req.file. Field name should be 'image'.");
        return res.status(400).json({ error: "No file received. Field name must be 'image'." });
      }
      
      // Use path.basename to safely get the filename and clean it
      const rawName = path.basename(file.originalname);
      // Clean filename but preserve spaces and dots to be user-friendly, like Racket OO-Wiki
      const fileName = rawName.replace(/[<>:"/\\|?*]/g, '_');
      const filePath = path.join(IMAGES_DIR, fileName);
      
      console.log(`[UPLOAD] Saving: ${fileName} to ${filePath}`);
      await fs.writeFile(filePath, file.buffer);

      const result = {
        success: true,
        url: `/images/${fileName}`,
        name: fileName
      };

      console.log("[UPLOAD] Success:", result);
      res.json([result]); // Return as array for compatibility with any multiple-upload expectations
    } catch (procErr) {
      console.error("[UPLOAD] Fatal save error:", procErr);
      res.status(500).json({ error: "Internal error saving files" });
    }
  });

  app.delete("/api/images/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const filePath = path.join(IMAGES_DIR, name);
      
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
        return res.json({ success: true });
      }

      // Try with URL decoding fallback
      const decodedName = decodeURIComponent(name);
      const decodedPath = path.join(IMAGES_DIR, decodedName);
      if (decodedName !== name && existsSync(decodedPath)) {
        await fs.unlink(decodedPath);
        return res.json({ success: true });
      }

      // Final fallback: check for encoded spaces (+) 
      const plusDecoded = name.replace(/\+/g, " ");
      const plusPath = path.join(IMAGES_DIR, plusDecoded);
      if (plusDecoded !== name && existsSync(plusPath)) {
        await fs.unlink(plusPath);
        return res.json({ success: true });
      }

      console.warn(`[DELETE] File not found: ${filePath}`);
      return res.status(404).json({ error: "Image not found on server" });
    } catch (error) {
      console.error("[DELETE] Critical error:", error);
      res.status(500).json({ error: "Server error while deleting image" });
    }
  });

  app.post("/api/pages/:name/rename", jsonParser, async (req, res) => {
    try {
      const { name: oldName } = req.params;
      const { newName } = req.body;
      
      if (!newName || oldName === newName) {
        return res.status(400).json({ error: "Invalid new name" });
      }

      const data = await fs.readFile(DATA_FILE, "utf-8");
      const pages = JSON.parse(data);
      
      if (pages[newName] !== undefined) {
        return res.status(400).json({ error: "A page with that name already exists" });
      }

      const content = pages[oldName];
      if (content === undefined) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      pages[newName] = content;
      delete pages[oldName];

      // Move version history folder if it exists
      try {
        const oldSafeName = toSafeFilename(oldName);
        const newSafeName = toSafeFilename(newName);
        const oldVersionsDir = path.join(VERSIONS_DIR, oldSafeName);
        const newVersionsDir = path.join(VERSIONS_DIR, newSafeName);
        
        if (existsSync(oldVersionsDir)) {
          await fs.rename(oldVersionsDir, newVersionsDir);
        }
      } catch (verErr) {
        console.error("Failed to rename version directory:", verErr);
      }

      // Global link update: [[oldName]] -> [[newName]] or [[Label|oldName]] -> [[Label|newName]]
      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedOldName = escapeRegExp(oldName);
      const wikiLinkRegex = new RegExp(`\\[\\[(?:([^|\\]]+)\\|)?(${escapedOldName})\\]\\]`, "g");
      
      Object.keys(pages).forEach(key => {
        if (typeof pages[key] === "string") {
          pages[key] = pages[key].replace(wikiLinkRegex, (match, display, page) => {
            if (display) {
              return `[[${display}|${newName}]]`;
            } else {
              return `[[${newName}]]`;
            }
          });
        }
      });
      
      await fs.writeFile(DATA_FILE, JSON.stringify(pages, null, 2));
      res.json({ success: true, newName });
    } catch (error) {
      console.error("Rename error:", error);
      res.status(500).json({ error: "Failed to rename page" });
    }
  });

  app.get("/api/backlinks/:name", async (req, res) => {
    try {
      const { name: targetName } = req.params;
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const pages = JSON.parse(data);
      
      const normalize = (s: string) => s.toLowerCase().replace(/[\s_]/g, "");
      const normTarget = normalize(targetName);
      
      const backlinks: string[] = [];
      // Regex to find all [[Page]] or [[Label|Page]] links
      const linkRegex = /\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g;

      Object.entries(pages).forEach(([pageName, content]) => {
        if (typeof content !== "string" || pageName === targetName) return;
        
        let match;
        linkRegex.lastIndex = 0; // Reset regex
        while ((match = linkRegex.exec(content)) !== null) {
          const linkedPage = match[1];
          if (normalize(linkedPage) === normTarget) {
            backlinks.push(pageName);
            break; // Avoid duplicates from the same page
          }
        }
      });

      res.json(backlinks.sort());
    } catch (error) {
      console.error("Backlinks error:", error);
      res.status(500).json({ error: "Failed to fetch backlinks" });
    }
  });

  app.get("/api/pages/:name/history", async (req, res) => {
    try {
      const { name } = req.params;
      const safeName = toSafeFilename(name);
      const pageVersionsDir = path.join(VERSIONS_DIR, safeName);
      
      if (!existsSync(pageVersionsDir)) {
        return res.json([]);
      }

      const files = await fs.readdir(pageVersionsDir);
      const historyItems = await Promise.all(
        files
          .filter(f => f.endsWith(".md"))
          .map(async (filename) => {
            const timestamp = filename.replace(".md", "");
            const filePath = path.join(pageVersionsDir, filename);
            const stats = await fs.stat(filePath);
            return {
              timestamp,
              date: stats.mtime,
              filename
            };
          })
      );

      res.json(historyItems.sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (error) {
      console.error("History error:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.get("/api/pages/:name/history/:timestamp", async (req, res) => {
    try {
      const { name, timestamp } = req.params;
      const safeName = toSafeFilename(name);
      const filePath = path.join(VERSIONS_DIR, safeName, `${timestamp}.md`);
      
      if (!existsSync(filePath)) {
        return res.status(404).json({ error: "Version not found" });
      }

      const content = await fs.readFile(filePath, "utf-8");
      res.json({ name, timestamp, content });
    } catch (error) {
      console.error("Version fetch error:", error);
      res.status(500).json({ error: "Failed to fetch version content" });
    }
  });

  app.get("/api/pages/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const pages = JSON.parse(data);
      
      // Try exact match
      let content = pages[name];
      
      // ROBUST LOOKUP: Normalize both searched name and keys to fix broken links
      if (content === undefined) {
        const normalize = (s: string) => s.toLowerCase().replace(/[\s_]/g, "");
        const normSearchName = normalize(name);
        const keys = Object.keys(pages);
        
        const matchKey = keys.find(k => normalize(k) === normSearchName);
        if (matchKey) {
          content = pages[matchKey];
        }
      }

      if (content === undefined) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.json({ name, content });
    } catch (error) {
      res.status(500).json({ error: "Failed to read page" });
    }
  });

  app.post("/api/pages/:name", jsonParser, async (req, res) => {
    try {
      const { name } = req.params;
      const { content } = req.body;
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const pages = JSON.parse(data);
      
      pages[name] = content;
      
      await fs.writeFile(DATA_FILE, JSON.stringify(pages, null, 2));

      // Save version snapshot
      try {
        const safeName = toSafeFilename(name);
        const pageVersionsDir = path.join(VERSIONS_DIR, safeName);
        if (!existsSync(pageVersionsDir)) {
          await fs.mkdir(pageVersionsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filePath = path.join(pageVersionsDir, `${timestamp}.md`);
        await fs.writeFile(filePath, content);
        console.log(`Saved version snapshot for ${name} to ${filePath}`);
      } catch (verErr) {
        console.error("Failed to save version snapshot:", verErr);
        // Don't fail the main save if versioning fails
      }

      res.json({ success: true, name });
    } catch (error) {
      res.status(500).json({ error: "Failed to save page" });
    }
  });

  app.delete("/api/pages/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const pages = JSON.parse(data);
      
      delete pages[name];
      
      await fs.writeFile(DATA_FILE, JSON.stringify(pages, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  app.post("/api/import-lisp", jsonParser, async (req, res) => {
    try {
      const { lispData } = req.body;
      if (!lispData) {
        return res.status(400).json({ error: "No Lisp data provided" });
      }

      console.log(`[IMPORT] Lisp data received. Length: ${lispData.length}`);

      const lex = (str: string): string[] => {
        const tokens: string[] = [];
        let i = 0;
        while (i < str.length) {
          const char = str[i];
          if (/\s/.test(char)) { i++; continue; }
          
          if (char === ';') { // Comment
            while (i < str.length && str[i] !== '\n') { i++; }
            continue;
          }
          
          if (char === '"') { // String
            i++; let s = "";
            while (i < str.length) {
              if (str[i] === "\\") {
                i++;
                if (i < str.length) {
                  const e = str[i];
                  if (e === "n") s += "\n";
                  else if (e === "r") s += "\r";
                  else if (e === "t") s += "\t";
                  else s += e;
                  i++;
                }
              } else if (str[i] === '"') {
                i++; break;
              } else {
                s += str[i];
                i++;
              }
            }
            tokens.push(`"${s}"`);
          } else if ("()[]{}'".includes(char)) {
            tokens.push(char);
            i++;
          } else { // Symbol or number or Dot
            let s = "";
            while (i < str.length && !/\s|["()\[\]{}';]/.test(str[i])) {
              s += str[i];
              i++;
            }
            if (s) tokens.push(s);
          }
        }
        return tokens;
      };

      const parse = (tokens: string[]): any => {
        let idx = 0;
        const read = (): any => {
          if (idx >= tokens.length) return undefined;
          const token = tokens[idx++];
          if (token === "(" || token === "[" || token === "{") {
            const list: any[] = [];
            const closing = token === "(" ? ")" : (token === "[" ? "]" : "}");
            while (idx < tokens.length && tokens[idx] !== closing) {
              const item = read();
              if (item !== undefined) list.push(item);
              else break;
            }
            if (idx < tokens.length) idx++;
            return list;
          }
          if (token === "'") {
            const next = read();
            return next !== undefined ? ["quote", next] : undefined;
          }
          if (token && token.startsWith('"')) return token.slice(1, -1);
          return token;
        };
        const result: any[] = [];
        while (idx < tokens.length) {
          const item = read();
          if (item !== undefined) result.push(item);
          else break;
        }
        return result;
      };

      const tokens = lex(lispData);
      console.log(`[IMPORT] Tokens generated: ${tokens.length}`);
      const tree = parse(tokens);
      console.log("[IMPORT] Tree parsed successfully");
      
      const pages: Record<string, string> = {};
      let count = 0;

      const extract = (node: any) => {
        if (!node) return;
        
        if (Array.isArray(node)) {
          // Check if this node itself is a pair: (Title . Content) or (Title Content)
          const skip = ["list", "cons", "page", "define-page", "hash", "hash-set", "quote", "define", "provide"];
          let start = skip.includes(node[0]) ? 1 : 0;
          
          if (node.length >= start + 2) {
            const t = node[start];
            let c = node[start + 1];
            
            // Handle (Title . Content) which parses as [Title, ".", Content]
            if (c === "." && node.length >= start + 3) {
              c = node[start + 2];
            }

            if (typeof t === "string" && typeof c === "string") {
               // Only strings that don't look like symbols
               if (!skip.includes(t) && t.length > 0 && !["(", ")", "[", "]", "{", "}", "'", "."].includes(t)) {
                 if (c.trim().length > 1 || t.length > 1) { // Avoid stray characters
                   pages[t] = c;
                   count++;
                 }
               }
            }
          }
          
          // Recurse
          node.forEach(extract);
        }
      };

      extract(tree);
      console.log(`[IMPORT] Extracted pages: ${count}`);

      // Final fallback if parsing failed or structure is weird
      if (count < 2) {
        console.log("[IMPORT] Low count, running string matcher fallback...");
        // Look for string literals in sequence
        const strings = tokens.filter(t => t.startsWith('"')).map(t => t.slice(1, -1));
        if (strings.length >= 2) {
          for (let i = 0; i < strings.length - 1; i += 2) {
             const t = strings[i];
             const c = strings[i+1];
             if (c.length > 2 && !pages[t]) {
               pages[t] = c;
               count++;
             }
          }
        }
      }

      if (count === 0) {
        console.error("[IMPORT] No pages found. Tree sample:", JSON.stringify(tree).substring(0, 1000));
        return res.status(400).json({ error: "No valid page pairs found. Check your Lisp data format." });
      }

      let existingPages = {};
      try {
        if (existsSync(DATA_FILE)) {
          const data = await fs.readFile(DATA_FILE, "utf-8");
          existingPages = JSON.parse(data);
        }
      } catch (e) {
        console.warn("[IMPORT] Failed to read existing pages:", e);
      }

      const updatedPages = { ...existingPages, ...pages };
      await fs.writeFile(DATA_FILE, JSON.stringify(updatedPages, null, 2));

      console.log(`[IMPORT] Success! Imported ${count} pages.`);
      res.json({ success: true, message: `Imported ${count} pages successfully.` });
    } catch (error) {
      console.error("[IMPORT] Fatal error:", error);
      res.status(500).json({ error: "Failed to parse or save Lisp data." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[GLOBAL ERROR]:", err);
    
    // Multer errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 5MB)" });
    }
    
    if (res.headersSent) {
      return next(err);
    }
    
    res.status(err.status || 500).json({
      error: err.message || "An internal server error occurred"
    });
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
