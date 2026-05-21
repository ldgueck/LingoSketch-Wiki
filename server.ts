import express from "express";
import path from "path";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import cookieParser from "cookie-parser";

// Only production if explicitly set
const isProd = process.env.NODE_ENV === "production";
const PORT = 3000;
const IMAGES_DIR = path.resolve(process.cwd(), "images");
const VERSIONS_DIR = path.resolve(process.cwd(), "versions");
const DATA_FILE = path.resolve(process.cwd(), "wiki_storage.json");

// Authentication Config
const APP_PASSWORD = process.env.APP_PASSWORD || "password";
const AUTH_COOKIE_NAME = "wiki_auth";

async function startServer() {
  // Ensure directories exist
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
  if (!existsSync(VERSIONS_DIR)) mkdirSync(VERSIONS_DIR, { recursive: true });

  const app = express();
  app.set('trust proxy', 1);
  
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ limit: "50mb" }));

  // Authentication Middleware
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log("[DEBUG] Cookies in middleware:", req.cookies);
    if (req.cookies && req.cookies[AUTH_COOKIE_NAME] === APP_PASSWORD) {
      next();
    } else {
      console.log("[DEBUG] Auth failed. Expected:", APP_PASSWORD, "Got:", req.cookies ? req.cookies[AUTH_COOKIE_NAME] : "no cookies object");
      res.status(401).json({ error: "Unauthorized" });
    }
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
    const isAuthenticated = req.cookies[AUTH_COOKIE_NAME] === APP_PASSWORD;
    res.json({ isAuthenticated });
  });

  // Logout
  app.post("/api/logout", (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.json({ success: true });
  });

  // Pages CRUD
  app.get("/api/pages/:name", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name;
      if (!data[name]) return res.status(404).json({ error: "Page not found" });
      res.json({ name, content: data[name] });
    } catch (e) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.post("/api/pages/:name", authMiddleware, async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name;
      const { content } = req.body;
      data[name] = content;
      await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to write data" });
    }
  });

  app.delete("/api/pages/:name", authMiddleware, async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name;
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
      
      await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ message: `Successfully imported ${count} pages` });
    } catch (e) {
      console.error("Lisp import error:", e);
      res.status(500).json({ error: "Failed to process Lisp data" });
    }
  });

  app.get("/api/backlinks/:name", async (req, res) => {
    try {
      const data = JSON.parse(await readFile(DATA_FILE, "utf-8"));
      const name = req.params.name;
      const backlinks = Object.keys(data).filter(pageName => pageName !== name && data[pageName].includes(`[[${name}]]`));
      res.json(backlinks);
    } catch (e) {
      res.status(500).json({ error: "Failed to read data" });
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
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
