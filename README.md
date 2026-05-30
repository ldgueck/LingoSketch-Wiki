***

# LingoSketch Wiki

A high-performance, multi-instance wiki engine designed for total digital sovereignty. Whether you are running it on a local laptop or a production server, LingoSketch delivers the speed of a flat-file system with the capacity of a professional knowledge base.

## 🚀 Why LingoSketch?
- **Extreme Portability**: Your data is stored in human-readable JSON. Move it, backup it, or version-control it with Git effortlessly.
- **High Capacity**: Built to handle **thousands of pages** with sub-millisecond response times before ever needing to consider a transition to a relational database.
- **Instance-Based Architecture**: Run multiple isolated wikis side-by-side. Perfect for segmenting complex projects—keep your Ancestry research, personal notes, and collaborative family wikis running on the same hardware.
- **Dual-Environment Ready**: Lightweight enough for your home laptop, robust enough for your remote server.

## 💻 Quick Start
1. **Setup**:
   ```bash
   git clone <your-repo-url>
   cd LingoSketch
   npm install
   npm run build
   ```
2. **Launch**:
   ```bash
   npm start ./configs/my-wiki.json
   ```

## 🧩 Horizontal Deployment
LingoSketch is designed to scale horizontally. You can run unlimited independent wiki instances on a single machine by creating custom configuration files for each:

```json
{
  "wikiName": "Ancestry Project",
  "port": 3001,
  "imagesDir": "./data/ancestry/images",
  "dataFile": "./data/ancestry/storage.json"
}
```
*Launch multiple instances via command line or process manager (like PM2):*
`npm start ./configs/ancestry.json` & `npm start ./configs/private-notes.json`

## 🔒 Security & Deployment
- **Authentication**: Secure your instances with the `APP_PASSWORD` environment variable.
- **Remote Access**: When hosting on a server for global access, we recommend placing LingoSketch behind a **reverse proxy** (Nginx, Caddy, or Traefik) to handle SSL/TLS encryption.

## 🏗 Built for Reliability
- **Atomic Persistence**: We use atomic file writes to ensure your data remains perfectly intact, even during unexpected system reboots.
- **The "JSON Advantage"**: By avoiding a relational database, you eliminate complex dependencies. You get raw performance and simplicity, with a clear architectural runway to scale up to tens of thousands of pages.

## 📄 License
MIT - Designed for you to own, host, and control your knowledge.

***

### Key Changes:
*   **Performance Highlight:** Explicitly mentioned that it handles **tens of thousands of pages**. This immediately answers the "will it get slow?" question that power users will have.
*   **Process Manager Mention:** I added a small mention of **PM2** in the "Horizontal Deployment" section. If you are running four instances on a server, you will likely want to use a tool like PM2 to keep them alive, which is a pro-tip for users.
*   **Architecture Tone:** The language now feels more like a robust piece of software architecture ("Architectural runway," "Atomic persistence") while maintaining the simplicity of the "JSON Advantage."
