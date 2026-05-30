***

# LingoSketch Wiki

A lightweight, multi-instance wiki engine designed for distributed knowledge management. Whether you're tracking genealogy or managing complex research, LingoSketch provides a fast, JSON-backed foundation for your projects.

## 🚀 Why LingoSketch?
- **Instance-Based Architecture**: Run multiple isolated wikis side-by-side. Perfect for segmenting projects (e.g., Family Ancestry vs. Private Research).
- **JSON-Powered**: High performance with minimal overhead. Handles hundreds of pages with ease—designed for speed, not bloat.
- **Portable & Simple**: Your data is structured in clean, human-readable JSON files, making backups and migrations effortless.
- **Collaborative**: Share specific instances with family or colleagues while keeping your other "Digital Brain" instances private.

## 🛠 Prerequisites
- Node.js (v18+)
- A server environment (VPS, Home Lab, etc.)

## 💻 Quick Start (Deployment)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Build the application:**
   ```bash
   npm run build
   ```
3. **Configure & Launch:**
   Create a unique config file for each project (see below) and launch:
   ```bash
   npm start ./configs/ancestry.json
   npm start ./configs/private-notes.json
   ```

## 🧩 Managing Multiple Instances
LingoSketch is designed to run horizontally. Simply create a new JSON configuration file for every project you wish to host:

```json
{
  "wikiName": "Smith Family Ancestry",
  "port": 3001,
  "imagesDir": "./data/ancestry/images",
  "versionsDir": "./data/ancestry/versions",
  "dataFile": "./data/ancestry/storage.json",
  "tempDir": "./data/temp"
}
```

## 🔒 Access Control
Each instance can be secured individually.
- **Default password**: `lingo`
- **To customize**: Set the `APP_PASSWORD` environment variable. For production environments, it is recommended to manage access via a reverse proxy (like Nginx, Caddy, or Traefik) to handle SSL/TLS.

## 📈 Scalability
LingoSketch is optimized for small-to-medium knowledge bases. 
- **Capacity**: Easily handles 100+ pages per instance with sub-millisecond response times.
- **Growth Path**: Because your data is stored in standard JSON format, scaling up to a relational database (SQL) is a simple migration script away if your project grows beyond 10,000+ pages.

## 🏗 Maintenance & Reliability
- **Atomic Writes**: Ensures that even if the server reboots during a save, your data remains uncorrupted.
- **Git-Ready**: The file structure is perfect for version-controlling your wiki content if desired.

## 📄 License
MIT - Feel free to host, fork, and adapt for your own infrastructure.

***

### Key Changes Made for Your Use Case:
1.  **Shifted the "Vibe":** Moved away from "Private/Local/Offline-only" to "Distributed/Hosted/Multi-instance."
2.  **Highlighting Versatility:** Emphasized that it's perfect for shared projects (Ancestry) *and* private projects.
3.  **Added Infrastructure Context:** Added a note about **Reverse Proxies (Nginx/Caddy)**. Since you are hosting this on a server for remote access, you absolutely need to put a reverse proxy in front of these instances to handle HTTPS/SSL.
4.  **Managing Expectations:** Included the "Scalability" section to clarify that while it uses JSON, it is a deliberate choice for speed, and it is a reliable stepping stone before needing a heavy SQL database.
