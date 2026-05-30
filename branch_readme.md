# LyngoSketch Branch Export Guide

LyngoSketch Wiki features a sophisticated, branch-aware export engine. This allows you to slice, pack, and export your knowledge base starting from any given page. Instead of exporting the entire database, the engine traces references to bundle a fully working, self-contained subset of pages and assets.

This document details how the export system resolves page dependencies, packs assets, and provides options for utilizing these exports.

---

## ⚙️ How the Export Database Engine Works

The export engine runs server-side and performs a selective, recursive depth-first traversal starting from your active page (`startPage`).

### 1. Reachability & Link Parsing
The engine identifies active hyperlinks inside your page markdown content using two main formats:
*   **WikiLinks**: Double-bracket internal links (e.g., `[[Sub_Page_Name]]` or `[[Label|Sub_Page_Name]]`).
*   **Markdown Views**: Standard Markdown links targeting internal pages (e.g., `[Label](/view/Sub_Page_Name)`).

Every valid target is converted into a standard lowercase slug. If a matching page exists in the database, it is pushed to a traversal queue. The system recursively parses all discovered pages until the full reachable subgraph is resolved.

### 2. Selective Isolation of Assets (Images)
During page parsing, the engine detects and harvests only the images that are actively referenced in the current branch:
*   **Standard Markdown Images**: `![alt](/images/filename.png)`
*   **Wiki Embedded Images**: `![[filename.png|caption]]`
*   **Direct Link Previews**: `[[filename.png]]`

Any referenced image is checked against the server's local media folder (`images/`) and added directly to the output package. Non-referenced image assets are excluded, ensuring the export is compact.

### 3. Selective Version History
For raw database backups, the system identifies history records residing in the `versions/` folder that match the names of the reachable page keys. Only these matches are bundled, keeping history lightweight and relevant to the exported project.

---

## 📦 Export Formats

LyngoSketch provides two distinct export modes to suit different goals:

### 1. Zipped HTML Branch (`.zip`)
Compiles the resolved branch into a standalone static web application.

*   **Design & Templates**: Every page is bundled within a responsive, styled HTML template featuring a modern layout with comfortable negative space. It matches the beautiful design of the primary wiki app.
*   **Safe SLUG Navigation**: High-integrity URL sanitization runs on the fly, transforming characters like `:` and other illegal operating system path symbols into safe filename slugs (e.g., `K:_Kotivara.html` becomes `K__Kotivara.html`).
*   **Functional Sidebar**: The template automatically embeds an elegant sidebar containing links to all other reachable sibling pages in the zip.
*   **Fallback Resolution**: If a link references a page *outside* the exported branch but exists in the database, the link is preserved with an `(External)` label style. If the destination page does not exist anywhere, the engine styles it with a distinct dashed visual signature indicating it is waiting to be written.

### 2. Wiki Branch Backup ZIP (`.zip`)
Generates a raw, standard database backup limited to the target branch.

*   **Database Slice (`wiki_storage.json`)**: Contains only the key-value rows of reachable pages.
*   **Localized Media (`images/`)**: Houses only the image files used by the sliced content.
*   **Selective History (`versions/`)**: Includes the text-file edits of the sliced pages, perfect for auditing or reverting changes in the future.

---

## 💡 What You Can Do with These Data Dumps

These structured exports open up numerous production opportunities for your digital brain:

### 🌐 Instant Serverless Static Sites
The compiled **Zipped HTML Branch** is serverless and ready to upload.
*   **Static Hosting**: Upload the contents directly to **GitHub Pages**, **Vite**, **Cloudflare Pages**, **Netlify**, or **Vercel** to share a responsive, blazing-fast read-only snapshot with your friends, colleagues, or public readers.
*   **Zero Infrastructure Costs**: No database, Node environment, or host is required. The pages load instantly with sub-millisecond static response times.

### 🧩 Spawn Isolated Wiki Instances
Using the **Wiki Branch Backup ZIP**:
*   **Horizontal Segments**: Spin up a brand new independent LyngoSketch container or service instance. Feed the exported `wiki_storage.json` into its configuration to easily split massive wikis (e.g., moving family research to its own server).
*   **Easy Migrations**: Transport your active research branch between laptops, home servers, or workspaces safely without moving unrelated configurations or private keys.

### 📂 Offline Archives & Local Reading
*   **100% Offline Access**: The index.html and safe-linked pages run smoothly inside any computer or mobile browser, completely disconnected from the internet. Keep permanent archives on absolute offline backups, secure flash drives, or write-once optical discs.
*   **Tool Interoperability**: Since the media and database are kept in standard formats (e.g., raw Markdown text within JSON and standard images in folder structures), they can easily be imported directly into other markdown editors like **Obsidian**, **Logseq**, or **Zettlr**.
