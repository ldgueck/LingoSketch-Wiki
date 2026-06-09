import express from "express";
import path from "path";
import { existsSync, mkdirSync, createReadStream, createWriteStream, readdirSync, statSync } from "fs";
import { readFile, writeFile, rm, mkdir, cp } from "fs/promises";
import cookieParser from "cookie-parser";
import multer from "multer";
import AdmZip from "adm-zip";
import { loadConfig } from "./config-loader";

// Only production if explicitly set
const isProd = process.env.NODE_ENV === "production";
const configPath = process.argv[2] || './default-config.json';
const config = loadConfig(configPath);

const IMAGES_DIR = config.imagesDir;
const VERSIONS_DIR = config.versionsDir;
const DATA_FILE = config.dataFile;
const TEMP_DIR = config.tempDir;
const PORT = config.port;
const PDFS_DIR = config.pdfsDir;
const AUDIO_DIR = config.audioDir;
const VIDEOS_DIR = config.videosDir;

const upload = multer({ dest: TEMP_DIR });

// Authentication Config
const APP_PASSWORD = process.env.APP_PASSWORD || "password";
const AUTH_COOKIE_NAME = "wiki_auth";

// Parser for older Racket wiki `.rktd` association lists
function parseRktd(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  let index = 0;
  
  function skipWhitespace() {
    while (index < content.length) {
      const char = content[index];
      if (/\s/.test(char)) {
        index++;
      } else if (char === ';') {
        while (index < content.length && content[index] !== '\n' && content[index] !== '\r') {
          index++;
        }
      } else {
        break;
      }
    }
  }
  
  function parseString(): string {
    index++; // skip opening '"'
    let resultStr = "";
    while (index < content.length) {
      const char = content[index];
      if (char === '"') {
        index++; // skip closing '"'
        return resultStr;
      } else if (char === '\\') {
        index++;
        if (index >= content.length) {
          throw new Error("Unexpected end of input in escaped string");
        }
        const escChar = content[index];
        if (escChar === 'n') resultStr += '\n';
        else if (escChar === 'r') resultStr += '\r';
        else if (escChar === 't') resultStr += '\t';
        else if (escChar === '"') resultStr += '"';
        else if (escChar === '\\') resultStr += '\\';
        else resultStr += escChar;
        index++;
      } else {
        resultStr += char;
        index++;
      }
    }
    throw new Error("Unterminated string in S-expression");
  }

  function parseList(): any[] {
    index++; // skip '('
    const list: any[] = [];
    while (true) {
      skipWhitespace();
      if (index >= content.length) {
        throw new Error("Unterminated list in S-expression");
      }
      if (content[index] === ')') {
        index++; // skip ')'
        return list;
      }
      list.push(parseValue());
    }
  }

  function parseValue(): any {
    skipWhitespace();
    if (index >= content.length) {
      throw new Error("Unexpected end of input");
    }
    const char = content[index];
    if (char === '(') {
      return parseList();
    } else if (char === '"') {
      return parseString();
    } else if (char === '.') {
      index++; // skip '.'
      return { type: 'dot' };
    } else {
      let token = "";
      while (index < content.length && !/\s/.test(content[index]) && content[index] !== '(' && content[index] !== ')' && content[index] !== '"') {
        token += content[index];
        index++;
      }
      return { type: 'symbol', value: token };
    }
  }

  skipWhitespace();
  if (content[index] !== '(') {
    throw new Error("Rktd association list must start with '('");
  }
  
  const outerList = parseList();
  
  for (const item of outerList) {
    if (Array.isArray(item) && item.length >= 1) {
      const key = item[0];
      let value = "";
      if (item.length === 2) {
        value = item[1];
      } else if (item.length === 3 && item[1] && item[1].type === 'dot') {
        value = item[2];
      } else if (item.length > 2) {
        value = item[item.length - 1];
      }
      if (typeof key === 'string' && typeof value === 'string') {
        result[key] = value;
      }
    }
  }
  
  return result;
}

function migrateSpacesToUnderscores(data: Record<string, string>): Record<string, string> {
  const migrated: Record<string, string> = {};
  for (const [key, content] of Object.entries(data)) {
    const newKey = key.replace(/ /g, "_");
    
    // Replace all spaces inside [[...]] with '_'
    const migratedContent = content.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
      return `[[${inner.replace(/ /g, "_")}]]`;
    });
    
    migrated[newKey] = migratedContent;
  }
  return migrated;
}

async function startServer() {
  // Ensure directories and files exist
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
  if (!existsSync(VERSIONS_DIR)) mkdirSync(VERSIONS_DIR, { recursive: true });
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
  if (!existsSync(PDFS_DIR)) mkdirSync(PDFS_DIR, { recursive: true });
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
  if (!existsSync(VIDEOS_DIR)) mkdirSync(VIDEOS_DIR, { recursive: true });
  
  if (!existsSync(DATA_FILE)) {
    try {
      await writeFile(DATA_FILE, "{}", "utf-8");
      console.log("[SERVER] Initialized empty wiki_storage.json");
    } catch (err) {
      console.error("[SERVER] Failed to initialize DATA_FILE:", err);
    }
  } else {
    // Perform database space-to-underscore migration
    try {
      const fileData = await readFile(DATA_FILE, "utf-8");
      const parsed = JSON.parse(fileData);
      const migrated = migrateSpacesToUnderscores(parsed);
      
      if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
        await writeFile(DATA_FILE, JSON.stringify(migrated, null, 2), "utf-8");
        console.log("[MIGRATION] Migration completed: All spaces in links [[]] and page titles have been replaced with underscores.");
      } else {
        console.log("[MIGRATION] Database is already migrated & consistent.");
      }
    } catch (err) {
      console.error("[MIGRATION] Failed to run startup space-to-underscore migration:", err);
    }
  }

  const app = express();
  app.set('trust proxy', 1);
  
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ limit: "50mb" }));
  app.use('/images', express.static(IMAGES_DIR));
  app.use('/pdfs', express.static(PDFS_DIR));
  app.use('/audio', express.static(AUDIO_DIR));
  app.use('/videos', express.static(VIDEOS_DIR));

  // Authentication Middleware
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    next();
  };

  // Auth endpoint
  app.post("/api/login", (req, res) => {
    const password = req.body?.password;
    if (!password) return res.status(400).json({ error: "No password provided" });
    if (password === APP_PASSWORD) {
      res.cookie(AUTH_COOKIE_NAME, APP_PASSWORD, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
      });
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  // Minimal Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // Auth Status
  app.get("/api/auth-status", (req, res) => {
    res.json({ isAuthenticated: true });
  });

  // Logout
  app.post("/api/logout", (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.json({ success: true });
  });

  // Pages CRUD
  app.get("/api/pages", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      res.json(Object.keys(data));
    } catch (e) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.get("/api/images", async (req, res) => {
    try {
      const files = await import("fs/promises").then(fs => fs.readdir(IMAGES_DIR));
      res.json(files.map(file => ({ name: file, url: `/images/${file}` })));
    } catch (e) {
      console.error("Failed to list images:", e);
      res.status(500).json({ error: "Failed to list images" });
    }
  });

  app.post("/api/upload", authMiddleware, upload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    try {
      const originalName = req.file.originalname;
      const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const targetPath = path.join(IMAGES_DIR, safeName);
      
      const { rename } = await import("fs/promises");
      await rename(req.file.path, targetPath);
      
      res.json({ success: true, name: safeName, url: `/images/${safeName}` });
    } catch (e: any) {
      console.error("Failed to upload image:", e);
      res.status(500).json({ error: "Failed to upload image: " + e.message });
    }
  });

  app.delete("/api/images/:name", authMiddleware, async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const resolvedPath = path.join(IMAGES_DIR, path.basename(name));
      if (existsSync(resolvedPath)) {
        const { rm } = await import("fs/promises");
        await rm(resolvedPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Image not found" });
      }
    } catch (e: any) {
      console.error("Failed to delete image:", e);
      res.status(500).json({ error: "Failed to delete image: " + e.message });
    }
  });

  app.get("/api/pdfs", async (req, res) => {
    try {
      const files = await import("fs/promises").then(fs => fs.readdir(PDFS_DIR));
      const pdfFiles = files.filter(f => f.toLowerCase().endsWith(".pdf"));
      res.json(pdfFiles.map(file => ({ name: file, url: `/pdfs/${file}` })));
    } catch (e) {
      console.error("Failed to list PDFs:", e);
      res.status(500).json({ error: "Failed to list PDFs" });
    }
  });

  app.post("/api/upload-pdf", authMiddleware, upload.single("pdf"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file provided" });
    }
    try {
      const originalName = req.file.originalname;
      const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      if (!safeName.toLowerCase().endsWith(".pdf")) {
        return res.status(400).json({ error: "File must be a PDF" });
      }
      const targetPath = path.join(PDFS_DIR, safeName);
      
      const { rename } = await import("fs/promises");
      await rename(req.file.path, targetPath);
      
      res.json({ success: true, name: safeName, url: `/pdfs/${safeName}` });
    } catch (e: any) {
      console.error("Failed to upload PDF:", e);
      res.status(500).json({ error: "Failed to upload PDF: " + e.message });
    }
  });

  app.delete("/api/pdfs/:name", authMiddleware, async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const resolvedPath = path.join(PDFS_DIR, path.basename(name));
      if (existsSync(resolvedPath)) {
        const { rm } = await import("fs/promises");
        await rm(resolvedPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "PDF not found" });
      }
    } catch (e: any) {
      console.error("Failed to delete PDF:", e);
      res.status(500).json({ error: "Failed to delete PDF: " + e.message });
    }
  });

  app.get("/api/audio", async (req, res) => {
    try {
      const files = await import("fs/promises").then(fs => fs.readdir(AUDIO_DIR));
      const allowedExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
      const audioFiles = files.filter(f => allowedExts.some(ext => f.toLowerCase().endsWith(ext)));
      res.json(audioFiles.map(file => ({ name: file, url: `/audio/${file}` })));
    } catch (e) {
      console.error("Failed to list audio files:", e);
      res.status(500).json({ error: "Failed to list audio files" });
    }
  });

  app.post("/api/upload-audio", authMiddleware, upload.single("audio"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }
    try {
      const originalName = req.file.originalname;
      const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const allowedExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
      if (!allowedExts.some(ext => safeName.toLowerCase().endsWith(ext))) {
        return res.status(400).json({ error: "File must be an audio file (MP3, WAV, OGG, AAC, M4A, FLAC)" });
      }
      const targetPath = path.join(AUDIO_DIR, safeName);
      
      const { rename } = await import("fs/promises");
      await rename(req.file.path, targetPath);
      
      res.json({ success: true, name: safeName, url: `/audio/${safeName}` });
    } catch (e: any) {
      console.error("Failed to upload audio:", e);
      res.status(500).json({ error: "Failed to upload audio: " + e.message });
    }
  });

  app.delete("/api/audio/:name", authMiddleware, async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const resolvedPath = path.join(AUDIO_DIR, path.basename(name));
      if (existsSync(resolvedPath)) {
        const { rm } = await import("fs/promises");
        await rm(resolvedPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Audio file not found" });
      }
    } catch (e: any) {
      console.error("Failed to delete audio file:", e);
      res.status(500).json({ error: "Failed to delete audio file: " + e.message });
    }
  });

  app.get("/api/videos", async (req, res) => {
    try {
      const files = await import("fs/promises").then(fs => fs.readdir(VIDEOS_DIR));
      const allowedExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
      const videoFiles = files.filter(f => allowedExts.some(ext => f.toLowerCase().endsWith(ext)));
      res.json(videoFiles.map(file => ({ name: file, url: `/videos/${file}` })));
    } catch (e) {
      console.error("Failed to list video files:", e);
      res.status(500).json({ error: "Failed to list video files" });
    }
  });

  app.post("/api/upload-video", authMiddleware, upload.single("video"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }
    try {
      const originalName = req.file.originalname;
      const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const allowedExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
      if (!allowedExts.some(ext => safeName.toLowerCase().endsWith(ext))) {
        return res.status(400).json({ error: "File must be a supported video file (MP4, WebM, OGG, MOV, MKV, AVI, 3GP)" });
      }
      const targetPath = path.join(VIDEOS_DIR, safeName);
      
      const { rename } = await import("fs/promises");
      await rename(req.file.path, targetPath);
      
      res.json({ success: true, name: safeName, url: `/videos/${safeName}` });
    } catch (e: any) {
      console.error("Failed to upload video:", e);
      res.status(500).json({ error: "Failed to upload video: " + e.message });
    }
  });

  app.delete("/api/videos/:name", authMiddleware, async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const resolvedPath = path.join(VIDEOS_DIR, path.basename(name));
      if (existsSync(resolvedPath)) {
        const { rm } = await import("fs/promises");
        await rm(resolvedPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Video file not found" });
      }
    } catch (e: any) {
      console.error("Failed to delete video file:", e);
      res.status(500).json({ error: "Failed to delete video file: " + e.message });
    }
  });

  app.get("/api/pages/:name", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name.replace(/ /g, "_");
      if (!data[name]) return res.status(404).json({ error: "Page not found" });
      res.json({ name, content: data[name] });
    } catch (e) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.post("/api/pages/:name", authMiddleware, async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name.replace(/ /g, "_");
      let { content } = req.body;
      
      if (typeof content === "string") {
        content = content.replace(/\[\[(.*?)\]\]/g, (match, inner) => `[[${inner.replace(/ /g, "_")}]]`);
      }
      
      // 1. Save in the main database
      data[name] = content;
      await writeFile(DATA_FILE, JSON.stringify(data, null, 2));

      // 2. Also save into the history/versions directory
      try {
        const now = new Date();
        const safePageName = name.replace(/[^a-zA-Z0-9-]/g, "_");
        const timestampStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
        const historyFilename = `${safePageName}_${timestampStr}.txt`;
        await writeFile(path.join(VERSIONS_DIR, historyFilename), content, "utf-8");
      } catch (histErr) {
        console.error("[SERVER] Failed to write historical page revision:", histErr);
      }

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to write data" });
    }
  });

  app.post("/api/pages/:name/rename", authMiddleware, async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name.replace(/ /g, "_");
      const { newName } = req.body;
      
      if (!newName) {
        return res.status(400).json({ error: "newName is required" });
      }
      
      if (!data[name]) {
        return res.status(404).json({ error: "Page not found" });
      }

      const cleanNewName = newName.replace(/ /g, "_");

      // Replace the key in the database
      const content = data[name];
      delete data[name];
      data[cleanNewName] = content;

      // Update all references in all pages
      for (const [key, text] of Object.entries(data)) {
        const updatedText = (text as string).replace(/\[\[(?:([^|\]]+)\|)?([^\]]+)\]\]/g, (match, display, pageMatch) => {
          if (pageMatch.trim() === name) {
            return display ? `[[${display}|${cleanNewName}]]` : `[[${cleanNewName}]]`;
          }
          return match;
        });
        data[key] = updatedText;
      }

      await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true, newName: cleanNewName });
    } catch (e: any) {
      console.error("Rename error:", e);
      res.status(500).json({ error: "Failed to rename page and update references" });
    }
  });

  app.get("/api/pages/:name/history", async (req, res) => {
    try {
      const name = req.params.name.replace(/ /g, "_");
      const safePageName = name.replace(/[^a-zA-Z0-9-]/g, "_");
      
      if (!existsSync(VERSIONS_DIR)) {
        return res.json([]);
      }
      
      const files = readdirSync(VERSIONS_DIR);
      const pageHistory = [];
      
      for (const file of files) {
        if (file.startsWith(safePageName + "_") && file.endsWith(".txt")) {
          const rest = file.substring(safePageName.length + 1, file.length - 4);
          if (/^\d+-\d+-\d+_\d+-\d+-\d+$/.test(rest)) {
            const parts = rest.split("_");
            const dateParts = parts[0].split("-");
            const timeParts = parts[1].split("-");
            
            // Format naturally
            const dateStr = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]} ${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
            
            pageHistory.push({
              timestamp: rest,
              date: dateStr,
              filename: file
            });
          }
        }
      }
      
      // Sort descending (latest revisions first)
      pageHistory.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      res.json(pageHistory);
    } catch (e) {
      console.error("Failed to read history:", e);
      res.status(500).json({ error: "Failed to read revision history" });
    }
  });

  app.get("/api/pages/:name/history/:timestamp", async (req, res) => {
    try {
      const name = req.params.name.replace(/ /g, "_");
      const safePageName = name.replace(/[^a-zA-Z0-9-]/g, "_");
      const timestamp = req.params.timestamp;
      const filePath = path.join(VERSIONS_DIR, `${safePageName}_${timestamp}.txt`);
      
      if (existsSync(filePath)) {
        const content = await readFile(filePath, "utf-8");
        res.json({ content });
      } else {
        res.status(404).json({ error: "Revision not found" });
      }
    } catch (e) {
      console.error("Failed to read revision:", e);
      res.status(500).json({ error: "Failed to read specific revision content" });
    }
  });

  app.delete("/api/pages/:name", authMiddleware, async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name.replace(/ /g, "_");
      delete data[name];
      await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete data" });
    }
  });

  app.post("/api/import-lisp", authMiddleware, async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const { lispData } = req.body;
      if (!lispData) return res.status(400).json({ error: "No Lisp data provided" });

      // Extremely simple parser for (("Title" "Content") ...)
      // This will be fragile but should handle the example format.
      const cleaned = lispData.trim().replace(/^\(|\)$/g, '');
      const pages = cleaned.match(/"[^"]*"\s*"[^"]*"/g) || [];
      
      let count = 0;
      for (const page of pages) {
        const match = page.match(/"([^"]*)"\s*"([^"]*)"/);
        if (match) {
          data[match[1]] = match[2];
          count++;
        }
      }
      
      const migrated = migrateSpacesToUnderscores(data);
      await writeFile(DATA_FILE, JSON.stringify(migrated, null, 2));
      res.json({ message: `Successfully imported ${count} pages` });
    } catch (e) {
      console.error("Lisp import error:", e);
      res.status(500).json({ error: "Failed to process Lisp data" });
    }
  });

  app.get("/api/export", async (req, res) => {
    try {
      const format = String(req.query.format || "zip").toLowerCase();
      const rawStartPage = String(req.query.startPage || "HomePage");
      const startPage = rawStartPage.replace(/ /g, "_");

      console.log(`[EXPORT BE] Starting export ZIP creation. Format: ${format}, Start Page: ${startPage}`);
      const zip = new AdmZip();

      // Read database content
      let data: Record<string, string> = {};
      if (existsSync(DATA_FILE)) {
        try {
          data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
        } catch (e) {
          console.error("[EXPORT] Failed to read database for export:", e);
        }
      }

      const getSafePageFilename = (pageName: string): string => {
        return pageName.replace(/:/g, "_").replace(/[\/\\*?"<>|]/g, "_");
      };

      // Traverse all reachable pages recursively starting from startPage (wiki links + md links)
      const getReachablePages = (db: Record<string, string>, root: string): Set<string> => {
        const reached = new Set<string>();
        const queue: string[] = [root];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (reached.has(current)) continue;

          const currentLower = current.toLowerCase();
          const dbKey = Object.keys(db).find(k => k.toLowerCase() === currentLower);
          if (!dbKey) continue;

          reached.add(dbKey);
          const content = db[dbKey];
          if (typeof content !== "string") continue;

          // Simple regex to parse standard wiki links [[Target]] or [[Label|Target]]
          const linkRegex = /\[\[(?:([^|\]\n]+)\|)?([^\]\n]+)\]\]/g;
          let match;
          linkRegex.lastIndex = 0;
          while ((match = linkRegex.exec(content)) !== null) {
            const targetStr = match[2].trim();
            if (!targetStr) continue;

            const cleanTarget = targetStr.replace(/ /g, "_");
            // Skip images from traversing as pages
            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(cleanTarget)) {
              continue;
            }

            const targetLower = cleanTarget.toLowerCase();
            const foundKey = Object.keys(db).find(k => k.toLowerCase() === targetLower);
            if (foundKey && !reached.has(foundKey) && !queue.includes(foundKey)) {
              queue.push(foundKey);
            }
          }

          // Also parse standard markdown links pointing to internal pages: [Label](/view/PageName)
          const mdLinkRegex = /\[[^\]]+\]\(\/view\/([^\s\)]+)\)/gi;
          mdLinkRegex.lastIndex = 0;
          while ((match = mdLinkRegex.exec(content)) !== null) {
            const targetStr = match[1].trim();
            if (!targetStr) continue;

            const cleanTarget = targetStr.replace(/ /g, "_");
            const targetLower = cleanTarget.toLowerCase();
            const foundKey = Object.keys(db).find(k => k.toLowerCase() === targetLower);
            if (foundKey && !reached.has(foundKey) && !queue.includes(foundKey)) {
              queue.push(foundKey);
            }
          }
        }
        return reached;
      };

      const now = new Date();
      const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStamp = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

      if (format === "html") {
        // --- HTML BRANCH EXPORT ---
        const reachableKeys = getReachablePages(data, startPage);
        const reachableList = Array.from(reachableKeys).sort();

        // Fallback if no reachable pages (e.g. empty DB or wrong page name)
        if (reachableList.length === 0) {
          // If the page doesn't exist, we can export whatever pages we have
          const allKeys = Object.keys(data);
          if (allKeys.length > 0) {
            allKeys.forEach(k => reachableKeys.add(k));
            reachableList.push(...allKeys.sort());
          }
        }

        // 2. MD to HTML converter function
        const mdToHtml = (markdown: string, pageName: string, reached: Set<string>, db: Record<string, string>) => {
          const referencedImages = new Set<string>();

          let html = markdown
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          const codeBlocks: string[] = [];
          const inlineCodes: string[] = [];

          // 1. Protect code blocks
          html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            const index = codeBlocks.length;
            codeBlocks.push(code);
            return `\n<!--CODE_BLOCK_${index}-->\n`;
          });

          // 2. Protect inline code
          html = html.replace(/`([^`\n]+)`/g, (match, code) => {
            const index = inlineCodes.length;
            inlineCodes.push(code);
            return `<!--INLINE_CODE_${index}-->`;
          });

          // Headers
          html = html.replace(/^\s*###### (.*$)/gim, '<h6 class="text-sm font-bold text-slate-900 mt-4 mb-2">$1</h6>');
          html = html.replace(/^\s*##### (.*$)/gim, '<h5 class="text-base font-bold text-slate-900 mt-5 mb-2">$1</h5>');
          html = html.replace(/^\s*#### (.*$)/gim, '<h4 class="text-lg font-bold text-slate-900 mt-6 mb-2">$1</h4>');
          html = html.replace(/^\s*### (.*$)/gim, '<h3 class="text-xl font-bold text-slate-900 mt-8 mb-3">$1</h3>');
          html = html.replace(/^\s*## (.*$)/gim, '<h2 class="text-2xl font-bold text-slate-900 mt-10 mb-4 pb-2 border-b border-slate-100">$1</h2>');
          html = html.replace(/^\s*# (.*$)/gim, '<h1 class="text-3xl font-extrabold text-slate-900 mt-12 mb-6">$1</h1>');

          // Standard markdown images: ![alt](/images/filename.gif)
          html = html.replace(/!\[(.*?)\]\(\/?images\/([^\s\)]+)\)/gi, (match, alt, filename) => {
            const cleanFilename = path.basename(filename.trim().replace(/ /g, "_"));
            referencedImages.add(cleanFilename);
            return `<figure class="my-6 text-center"><img src="images/${cleanFilename}" alt="${alt || cleanFilename}" class="rounded-2xl max-h-96 mx-auto object-cover border border-slate-200 shadow-sm" /></figure>`;
          });

           // Images ![[filename.png|params]]
          html = html.replace(/!\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g, (match, filename, caption) => {
            const cleanFilename = filename.trim().replace(/ /g, "_");
            const lowerFilename = cleanFilename.toLowerCase();
            if (lowerFilename.endsWith(".pdf")) {
              let height = "600px";
              if (caption) {
                const num = parseInt(caption);
                if (!isNaN(num)) height = `${num}px`;
              }
              return `<div class="my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-sans font-semibold">
                  <span class="flex items-center gap-1.5 truncate">
                    <span class="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold">PDF</span> ${cleanFilename}
                  </span>
                  <a href="/pdfs/${encodeURIComponent(cleanFilename)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium">Open in New Tab</a>
                </div>
                <iframe src="/pdfs/${encodeURIComponent(cleanFilename)}" title="${cleanFilename}" style="width: 100%; height: ${height};" class="bg-white border-0" />
              </div>`;
            }
            const allowedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
            if (allowedAudioExts.some(ext => lowerFilename.endsWith(ext))) {
              return `<div class="my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
                <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span class="flex items-center gap-1.5 truncate">
                    <span class="px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded text-[10px] font-bold">AUDIO</span> ${cleanFilename}
                  </span>
                  <a href="/audio/${encodeURIComponent(cleanFilename)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium">Download / Open</a>
                </div>
                <div class="p-4 bg-white flex flex-col items-center justify-center">
                  <audio src="/audio/${encodeURIComponent(cleanFilename)}" controls class="w-full max-w-xl"></audio>
                  ${caption ? `<div class="text-xs text-slate-400 mt-2 font-medium">${caption}</div>` : ""}
                </div>
              </div>`;
            }
            const allowedVideoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
            if (allowedVideoExts.some(ext => lowerFilename.endsWith(ext))) {
              let width = "100%";
              if (caption) {
                const num = parseInt(caption);
                if (!isNaN(num)) width = `${num}px`;
              }
              return `<div class="my-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 font-sans">
                <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span class="flex items-center gap-1.5 truncate">
                    <span className="shrink-0" class="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">VIDEO</span> ${cleanFilename}
                  </span>
                  <a href="/videos/${encodeURIComponent(cleanFilename)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-medium">Download / Open</a>
                </div>
                <div class="p-4 bg-white flex flex-col items-center justify-center">
                  <video src="/videos/${encodeURIComponent(cleanFilename)}" controls style="width: ${width}; max-height: 480px;" class="rounded-xl border border-slate-200 shadow-sm"></video>
                  ${caption && isNaN(parseInt(caption)) ? `<div class="text-xs text-slate-400 mt-2 font-medium">${caption}</div>` : ""}
                </div>
              </div>`;
            }
            referencedImages.add(cleanFilename);
            return `<figure class="my-6 text-center"><img src="images/${cleanFilename}" alt="${caption || cleanFilename}" class="rounded-2xl max-h-96 mx-auto object-cover border border-slate-200 shadow-sm" />${caption ? `<figcaption class="text-center text-xs text-slate-400 mt-2 font-medium">${caption}</figcaption>` : ""}</figure>`;
          });

          // Standard markdown links pointing to internal pages: [Label](/view/PageName)
          html = html.replace(/\[([^\]]+)\]\(\/view\/([^\s\)]+)\)/gi, (match, label, pName) => {
            const cleanPageName = pName.trim();
            const pageLower = cleanPageName.toLowerCase();
            const foundKey = Object.keys(db).find(k => k.toLowerCase() === pageLower);
            
            if (foundKey && reached.has(foundKey)) {
              return `<a href="${getSafePageFilename(foundKey)}.html" class="text-blue-600 hover:text-blue-800 underline font-medium transition-colors">${label}</a>`;
            } else if (foundKey) {
              return `<a href="${getSafePageFilename(foundKey)}.html" class="text-slate-500 hover:text-slate-700 underline font-medium opacity-80">${label} (External)</a>`;
            } else {
              return `<span class="text-amber-700 bg-amber-50 px-1 rounded border border-amber-100 font-semibold cursor-help" title="Page is not created yet">${label}?</span>`;
            }
          });

          // Links [[Target]] or [[Label|Target]]
          html = html.replace(/\[\[(?:([^|\]\n]+)\|)?([^\]\n]+)\]\]/g, (match, label, target) => {
            const targetStr = (target || "").trim();
            const cleanTarget = targetStr.replace(/ /g, "_");
            const cleanLabel = (label || targetStr).trim().replace(/_/g, " ");

            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(cleanTarget)) {
              referencedImages.add(cleanTarget);
              return `<img src="images/${cleanTarget}" alt="${cleanLabel}" class="rounded-xl max-h-96 mx-auto object-cover border border-slate-200" />`;
            }

            if (cleanTarget.toLowerCase().endsWith(".pdf")) {
              return `<a href="/pdfs/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-medium transition-colors">${cleanLabel}</a>`;
            }

            const allowedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"];
            if (allowedAudioExts.some(ext => cleanTarget.toLowerCase().endsWith(ext))) {
              return `<a href="/audio/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-teal-600 hover:text-teal-850 underline font-medium transition-colors">🎵 ${cleanLabel}</a>`;
            }

            const allowedVideoExts = [".mp4", ".webm", ".ogg", ".mov", ".mkv", ".avi", ".3gp"];
            if (allowedVideoExts.some(ext => cleanTarget.toLowerCase().endsWith(ext))) {
              return `<a href="/videos/${encodeURIComponent(cleanTarget)}" target="_blank" rel="noopener noreferrer" class="text-rose-600 hover:text-rose-800 underline font-medium transition-colors">🎥 ${cleanLabel}</a>`;
            }

            const targetLower = cleanTarget.toLowerCase();
            const foundKey = Object.keys(db).find(k => k.toLowerCase() === targetLower);

            if (foundKey && reached.has(foundKey)) {
              return `<a href="${getSafePageFilename(foundKey)}.html" class="text-blue-600 hover:text-blue-800 underline font-medium transition-colors">${cleanLabel}</a>`;
            } else if (foundKey) {
              return `<a href="${getSafePageFilename(foundKey)}.html" class="text-slate-500 hover:text-slate-700 underline font-medium opacity-80">${cleanLabel} (External)</a>`;
            } else {
              return `<span class="text-amber-700 bg-amber-50 px-1 rounded border border-amber-100 font-semibold cursor-help" title="Page is not created yet">${cleanLabel}?</span>`;
            }
          });

          // Blockquotes
          html = html.replace(/^\s*>\s+(.*$)/gim, '<blockquote class="border-l-4 border-slate-300 pl-4 py-1 italic text-slate-600 my-4">$1</blockquote>');

          // Unordered lists
          html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-700 py-0.5">$1</li>');

          // Ordered lists
          html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-slate-700 py-0.5">$1</li>');

          // Bold & Italic markdown replacements
          // Bold-italic (***)
          html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
          // Bold (**)
          html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          // Italic (*)
          html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

          // Split by newline to construct proper lists and paragraph blocks
          const txtLines = html.split('\n');
          let insideList = false;
          let parsedContent = '';

          for (let txtLine of txtLines) {
            txtLine = txtLine.trim();
            if (!txtLine) continue;

            const isBlock = txtLine.startsWith('<h') || 
                            txtLine.startsWith('<pre') || 
                            txtLine.startsWith('<blockquote') || 
                            txtLine.startsWith('<li') || 
                            txtLine.startsWith('<figure') || 
                            txtLine.startsWith('</li') || 
                            txtLine.startsWith('</ul') || 
                            txtLine.startsWith('</ol') ||
                            txtLine.startsWith('<!--CODE_BLOCK_');

            if (txtLine.startsWith('<li')) {
              if (!insideList) {
                parsedContent += '<ul class="my-4 space-y-1">';
                insideList = true;
              }
            } else if (insideList && !txtLine.startsWith('<li')) {
              parsedContent += '</ul>';
              insideList = false;
            }

            if (isBlock) {
              parsedContent += txtLine;
            } else {
              parsedContent += `<p class="leading-relaxed text-slate-700 my-4">${txtLine}</p>`;
            }
          }

          if (insideList) {
            parsedContent += '</ul>';
          }

          // Restore the code blocks and inline code
          parsedContent = parsedContent.replace(/<!--CODE_BLOCK_(\d+)-->/g, (match, idxStr) => {
            const idx = parseInt(idxStr, 10);
            const code = codeBlocks[idx] || "";
            return `<pre class="bg-slate-50 p-4 rounded-xl font-mono text-sm overflow-x-auto border border-slate-100 my-4"><code>${code}</code></pre>`;
          });

          parsedContent = parsedContent.replace(/<!--INLINE_CODE_(\d+)-->/g, (match, idxStr) => {
            const idx = parseInt(idxStr, 10);
            const code = inlineCodes[idx] || "";
            return `<code class="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600">${code}</code>`;
          });

          return { html: parsedContent, referencedImages };
        };

        // 3. Wrapper template constructor
        const wrapHtmlTemplate = (title: string, bodyHtml: string, allReachable: string[], currentKey: string) => {
          const cleanTitle = title.replace(/_/g, " ");
          const sidebarItems = allReachable.map(key => {
            const isCurrent = key === currentKey;
            const displayName = key.replace(/_/g, " ");
            const safeKey = getSafePageFilename(key);
            return `<li>
              <a href="${safeKey}.html" class="block px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${isCurrent ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}">
                ${displayName}
              </a>
            </li>`;
          }).join("\n");

          return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cleanTitle} - Decoupled Wiki Offline</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Inter', sans-serif;
      }
      code, pre {
        font-family: 'JetBrains Mono', monospace;
      }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen">
    <div class="flex flex-col md:flex-row min-h-screen">
        <!-- Sidebar Navigation -->
        <aside class="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-6 flex-shrink-0">
            <div class="mb-6 flex items-center gap-2">
                <span class="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
                </span>
                <span class="font-extrabold text-slate-900 text-base tracking-tight">Lingosketch Offline</span>
            </div>
            <div class="mb-4">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Branch Pages</p>
                <nav>
                    <ul class="space-y-1">
                        ${sidebarItems}
                    </ul>
                </nav>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 py-10 px-4 sm:px-8 md:px-12 max-w-4xl">
            <div class="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm">
                <header class="border-b border-slate-100 pb-6 mb-8">
                    <span class="text-xs font-bold uppercase tracking-widest text-blue-600">Exported Wiki Page</span>
                    <h1 class="text-4xl font-extrabold text-slate-900 mt-1 pb-1 tracking-tight">${cleanTitle}</h1>
                </header>
                <article class="prose prose-slate max-w-none">
                    ${bodyHtml}
                </article>
                <footer class="border-t border-slate-100 mt-16 pt-6 text-xs text-slate-400 text-center flex justify-between">
                    <span>Generated from Lingosketch Wiki</span>
                    <span>${new Date().toLocaleDateString()}</span>
                </footer>
            </div>
        </main>
    </div>
</body>
</html>`;
        };

        const allImagesInBranch = new Set<string>();

        // Generate pages
        for (const pageNameKey of reachableList) {
          const content = data[pageNameKey] || "";
          const { html, referencedImages } = mdToHtml(content, pageNameKey, reachableKeys, data);

          referencedImages.forEach(img => allImagesInBranch.add(img));

          const pageHtmlContent = wrapHtmlTemplate(pageNameKey, html, reachableList, pageNameKey);
          
          const safeKey = getSafePageFilename(pageNameKey);
          // Add to zip file
          zip.addFile(`${safeKey}.html`, Buffer.from(pageHtmlContent, "utf-8"));

          // If this is the startPage, let's also create an index.html at root that matches it
          if (pageNameKey.toLowerCase() === startPage.toLowerCase()) {
            zip.addFile("index.html", Buffer.from(pageHtmlContent, "utf-8"));
          }
        }

        // Add a fallback index.html if the start page wasn't found or was empty
        if (reachableList.length > 0 && !reachableList.some(k => k.toLowerCase() === startPage.toLowerCase())) {
          const firstKey = reachableList[0];
          const content = data[firstKey] || "";
          const { html } = mdToHtml(content, firstKey, reachableKeys, data);
          const firstHtml = wrapHtmlTemplate(firstKey, html, reachableList, firstKey);
          zip.addFile("index.html", Buffer.from(firstHtml, "utf-8"));
        }

        // Include referenced images
        for (const imgName of allImagesInBranch) {
          const safeFilename = path.basename(imgName);
          const imgPath = path.join(IMAGES_DIR, safeFilename);
          if (existsSync(imgPath)) {
            zip.addLocalFile(imgPath, "images");
          }
        }

        const safeStartPageName = getSafePageFilename(startPage);
        const filename = `wiki_html_branch_${safeStartPageName}_${dateStamp}_${timeStamp}.zip`;
        const buffer = zip.toBuffer();

        res.set({
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": buffer.length,
        });
        res.send(buffer);
        console.log(`[EXPORT BE] Web ZIP generated with ${reachableList.length} pages and ${allImagesInBranch.size} images. Size:`, buffer.length);

      } else {
        // --- ZIP BACKUP EXPORT (Wiki Branch Backup ZIP) ---
        const reachableKeys = getReachablePages(data, startPage);
        const reachableList = Array.from(reachableKeys).sort();

        let exportData: Record<string, string> = {};

        // If we found reachable pages, filter to keep only those. Otherwise, fallback to full DB
        if (reachableList.length > 0) {
          console.log(`[EXPORT ZIP] Scoped backup to branch of ${reachableList.length} pages.`);
          for (const key of reachableList) {
            if (data[key] !== undefined) {
              exportData[key] = data[key];
            }
          }
        } else {
          console.log(`[EXPORT ZIP] No reachable pages found for startPage: ${startPage}. Exporting full database.`);
          exportData = data;
        }

        // Add the JSON database
        zip.addFile("wiki_storage.json", Buffer.from(JSON.stringify(exportData, null, 2), "utf-8"));

        // Add referenced images only
        const allImagesInBranch = new Set<string>();
        for (const pageNameKey of Object.keys(exportData)) {
          const content = exportData[pageNameKey] || "";
          
          // Match standard Markdown images: ![alt](/images/filename.gif) /images/filename.png
          const mdImageRegex = /!\[.*?\]\(\/?images\/([^\s\)]+)\)/gi;
          let match;
          mdImageRegex.lastIndex = 0;
          while ((match = mdImageRegex.exec(content)) !== null) {
            const cleanFilename = path.basename(match[1].trim().replace(/ /g, "_"));
            allImagesInBranch.add(cleanFilename);
          }

          // Images ![[filename.png|params]]
          const wikiImageRegex = /!\[\[([^|\]\n]+)(?:\|[^\]\n]+)?\]\]/g;
          wikiImageRegex.lastIndex = 0;
          while ((match = wikiImageRegex.exec(content)) !== null) {
            const cleanFilename = match[1].trim().replace(/ /g, "_");
            allImagesInBranch.add(cleanFilename);
          }

          // Links [[Target]] where target is an image file
          const wikiLinkRegex = /\[\[(?:([^|\]\n]+)\|)?([^\]\n]+)\]\]/g;
          wikiLinkRegex.lastIndex = 0;
          while ((match = wikiLinkRegex.exec(content)) !== null) {
            const targetStr = match[2].trim();
            const cleanTarget = targetStr.replace(/ /g, "_");
            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(cleanTarget)) {
              allImagesInBranch.add(cleanTarget);
            }
          }
        }

        if (existsSync(IMAGES_DIR)) {
          if (allImagesInBranch.size > 0) {
            for (const imgName of allImagesInBranch) {
              const safeFilename = path.basename(imgName);
              const imgPath = path.join(IMAGES_DIR, safeFilename);
              if (existsSync(imgPath)) {
                zip.addLocalFile(imgPath, "images");
              }
            }
          } else if (reachableList.length === 0) {
            // Only add entire images directory if exporting full database as fallback
            const files = await import("fs/promises").then(fs => fs.readdir(IMAGES_DIR));
            if (files.length > 0) {
              zip.addLocalFolder(IMAGES_DIR, "images");
            }
          }
        }

        // Add filtered version files
        if (existsSync(VERSIONS_DIR)) {
          const files = await import("fs/promises").then(fs => fs.readdir(VERSIONS_DIR));
          if (files.length > 0) {
            if (reachableList.length > 0) {
              // Copy over ONLY those version files where the page prefix matches a reachable page
              for (const file of files) {
                // Find matching page
                const isMatch = reachableList.some(pageName => {
                  const safeName = pageName.replace(/[^a-zA-Z0-9-]/g, "_");
                  return file.startsWith(`${safeName}_`);
                });
                if (isMatch) {
                  const versionPath = path.join(VERSIONS_DIR, file);
                  zip.addLocalFile(versionPath, "versions");
                }
              }
            } else {
              // If full backup mode, copy entire folder
              zip.addLocalFolder(VERSIONS_DIR, "versions");
            }
          }
        }

        const buffer = zip.toBuffer();
        const safeStartPageName = getSafePageFilename(startPage);
        const filename = reachableList.length > 0 
          ? `wiki_branch_backup_${safeStartPageName}_${dateStamp}_${timeStamp}.zip`
          : `wiki_backup_${dateStamp}_${timeStamp}.zip`;

        res.set({
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": buffer.length,
        });
        res.send(buffer);
        console.log(`[EXPORT BE] Branch Backup ZIP generated successfully. Pages: ${Object.keys(exportData).length}, Images: ${allImagesInBranch.size}. Size:`, buffer.length);
      }
    } catch (e: any) {
      console.error("Export error:", e);
      res.status(500).json({ error: "Failed to generate export file: " + e.message });
    }
  });

  app.post("/api/restore", authMiddleware, upload.single("backup"), async (req, res) => {
    console.log("[RESTORE BE] Request received. authMiddleware completed.");
    if (!req.file) {
      console.error("[RESTORE BE] No file, despite authMiddleware success. Multer might have failed (e.g. invalid form field name). Expected field name: 'backup'");
      return res.status(400).json({ error: "No backup file provided. Ensure form field is named 'backup'" });
    }

    try {
      console.log("[RESTORE BE] Processing backup:", req.file.path, "Size:", req.file.size);
      
      const zip = new AdmZip(req.file.path);
      const entries = zip.getEntries();
      console.log("[RESTORE BE] Found " + entries.length + " entries in ZIP file.");
      
      let wikiStorageEntry: any = null;
      let isRktd = false;
      const imageEntries: any[] = [];
      const versionEntries: any[] = [];

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        
        const normalized = entry.entryName.replace(/\\/g, "/");
        
        // Skip system metadata, OS files, and Mac hidden files
        if (normalized.includes("__MACOSX") || normalized.includes(".DS_Store") || path.basename(normalized).startsWith("._")) {
          continue;
        }

        console.log(`[RESTORE BE] Found entry: ${normalized} (Size: ${entry.header.size})`);

        if (normalized === "wiki_storage.json" || normalized.endsWith("/wiki_storage.json")) {
          wikiStorageEntry = entry;
          isRktd = false;
        } else if (normalized === "wiki_storage.rktd" || normalized.endsWith("/wiki_storage.rktd")) {
          wikiStorageEntry = entry;
          isRktd = true;
        } else if (normalized.includes("/images/") || normalized.startsWith("images/")) {
          imageEntries.push(entry);
        } else if (normalized.includes("/versions/") || normalized.startsWith("versions/") || normalized.includes("/history/") || normalized.startsWith("history/")) {
          versionEntries.push(entry);
        }
      }

      if (!wikiStorageEntry) {
        throw new Error("Could not find a valid database file (wiki_storage.json or wiki_storage.rktd) in the backup archive.");
      }

      console.log("[RESTORE BE] Reading database file:", wikiStorageEntry.entryName, "Format:", isRktd ? "rktd" : "json");
      const dataBuffer = wikiStorageEntry.getData();
      
      let parsedData: Record<string, string>;
      if (isRktd) {
        try {
          parsedData = parseRktd(dataBuffer.toString("utf-8"));
        } catch (rktdErr: any) {
          throw new Error("The 'wiki_storage.rktd' file in the backup contains invalid Racket syntaxes: " + rktdErr.message);
        }
      } else {
        try {
          parsedData = JSON.parse(dataBuffer.toString("utf-8"));
        } catch (jsonErr: any) {
          throw new Error("The 'wiki_storage.json' file in the backup contains invalid JSON data and cannot be parsed.");
        }
      }

      // 1. Restore the wiki database file ONLY after confirming it is valid and migrating spaces to underscores
      const migratedData = migrateSpacesToUnderscores(parsedData);
      await writeFile(DATA_FILE, JSON.stringify(migratedData, null, 2), "utf-8");
      console.log("[RESTORE BE] Restored & migrated wiki database successfully. Pages count:", Object.keys(migratedData).length);

      // 2. Restore images if present
      if (imageEntries.length > 0) {
        await rm(IMAGES_DIR, { recursive: true, force: true });
        await mkdir(IMAGES_DIR, { recursive: true });
        
        for (const entry of imageEntries) {
          const filename = path.basename(entry.entryName);
          if (!filename || filename.startsWith(".")) continue;
          
          const destPath = path.join(IMAGES_DIR, filename);
          await writeFile(destPath, entry.getData());
        }
        console.log(`[RESTORE BE] Restored ${imageEntries.length} images successfully.`);
      } else {
        console.log("[RESTORE BE] No images found in ZIP to restore.");
      }

      // 3. Restore versions/history if present
      if (versionEntries.length > 0) {
        await rm(VERSIONS_DIR, { recursive: true, force: true });
        await mkdir(VERSIONS_DIR, { recursive: true });
        
        for (const entry of versionEntries) {
          const filename = path.basename(entry.entryName);
          if (!filename || filename.startsWith(".")) continue;
          
          const destPath = path.join(VERSIONS_DIR, filename);
          await writeFile(destPath, entry.getData());
        }
        console.log(`[RESTORE BE] Restored ${versionEntries.length} versioned page histories successfully.`);
      } else {
        console.log("[RESTORE BE] No version history found in ZIP to restore.");
      }
      
      res.json({ success: true });
    } catch (e: any) {
      console.error("Restore error:", e);
      res.status(500).json({ error: "Failed to restore backup: " + (e?.message || e) });
    } finally {
      // Always cleanup the uploaded multer temp file
      if (req.file && req.file.path) {
        await rm(req.file.path).catch(err => {
          console.error("[RESTORE BE] Failed to cleanup uploaded file:", req.file.path, err);
        });
      }
    }
  });

  app.get("/api/backlinks/:name", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name.replace(/ /g, "_");
      const backlinks = Object.keys(data).filter(pageName => {
        if (pageName.toLowerCase() === name.toLowerCase()) return false;
        
        const content = data[pageName];
        if (typeof content !== "string") return false;

        // Skip image embedding references
        const stripped = content.replace(/!\[\[/g, 'IMAGE_BRACKET');

        // Regex to find [[Target]] or [[Display|Target]]
        // Note: Using [\s\S] to match across newlines inside [[...]]
        const linkRegex = /\[\[(?:([^|\]\n]+)\|)?([^\]\n]+)\]\]/g;
        let match;
        while ((match = linkRegex.exec(stripped)) !== null) {
          const target = (match[2] || "").trim().replace(/ /g, "_").toLowerCase();
          if (target === name.toLowerCase()) return true;
        }
        return false;
      });
      res.json(backlinks);
    } catch (e) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.get("/api/wanted", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const existingPagesLower = new Set(Object.keys(data).map(name => name.toLowerCase()));
      const wantedMap = new Map<string, Set<string>>();
      
      const regex = /\[\[(?:([^|\]]+)\|)?([^\]]+)\]\]/g;
      
      for (const [srcPage, content] of Object.entries(data)) {
        if (typeof content !== "string") continue;
        
        // Strip out image references to avoid matching ![[...]]
        const stripped = content.replace(/!\[\[/g, 'IMAGE_BRACKET');
        let match;
        
        regex.lastIndex = 0;
        while ((match = regex.exec(stripped)) !== null) {
          const targetStr = match[2].trim();
          if (!targetStr) continue;
          
          const pageTarget = targetStr.replace(/ /g, "_");
          if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pageTarget)) {
            continue;
          }
          
          if (!existingPagesLower.has(pageTarget.toLowerCase())) {
            if (!wantedMap.has(pageTarget)) {
              wantedMap.set(pageTarget, new Set());
            }
            wantedMap.get(pageTarget)!.add(srcPage);
          }
        }
      }
      
      const result = Array.from(wantedMap.entries()).map(([name, sources]) => ({
        name,
        sources: Array.from(sources)
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      res.json(result);
    } catch (e) {
      console.error("Failed to compute wanted pages:", e);
      res.status(500).json({ error: "Failed to compute wanted pages" });
    }
  });

  app.get("/api/orphaned", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const existingPages = Object.keys(data);
      const existingPagesLower = new Set(existingPages.map(name => name.toLowerCase()));
      const targetedPagesLower = new Set<string>();
      
      const regex = /\[\[(?:([^|\]]+)\|)?([^\]]+)\]\]/g;
      
      for (const [srcPage, content] of Object.entries(data)) {
        if (typeof content !== "string") continue;
        
        const stripped = content.replace(/!\[\[/g, 'IMAGE_BRACKET');
        let match;
        
        regex.lastIndex = 0;
        while ((match = regex.exec(stripped)) !== null) {
          const targetStr = match[2].trim();
          if (!targetStr) continue;
          
          const pageTarget = targetStr.replace(/ /g, "_");
          if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pageTarget)) {
            continue;
          }
          
          if (pageTarget.toLowerCase() !== srcPage.toLowerCase()) {
            targetedPagesLower.add(pageTarget.toLowerCase());
          }
        }
      }
      
      const orphaned = existingPages.filter(page => !targetedPagesLower.has(page.toLowerCase())).sort((a, b) => a.localeCompare(b));
      res.json(orphaned);
    } catch (e) {
      console.error("Failed to compute orphaned pages:", e);
      res.status(500).json({ error: "Failed to compute orphaned pages" });
    }
  });

  // Catch-all for API to log 404s
  app.all("/api/*", (req, res) => {
    console.log(`[DEBUG] 404 for API route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "API route not found" });
  });

  // Vite/SPA Integration
  if (!isProd) {
    try {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("[VITE] Failed to load Vite middleware:", err);
    }
  }

  // Fallback to static files
  const distPath = path.join(process.cwd(), "dist");
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Wiki [${config.wikiName}] running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
