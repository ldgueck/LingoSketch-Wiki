***

# LyngoSketch Branch Export Guide

LyngoSketch Wiki includes a tool to export a specific section—or "branch"—of your wiki. Instead of exporting the entire database, this tool traces links from a starting page to create a self-contained bundle of pages and images.

---

## How the Export Engine Works

The engine performs a recursive scan starting from your chosen `startPage`.

### 1. Link Parsing
The engine identifies links within your markdown content to determine which pages are connected to your starting page:
*   **WikiLinks**: `[[Page_Name]]` or `[[Label|Page_Name]]`
*   **Markdown Links**: `[Label](/view/Page_Name)`

It converts these into standardized slugs and recursively builds a list of all reachable pages.

### 2. Asset Selection
The engine scans the reachable pages for referenced images:
*   Standard markdown images: `![alt](/images/filename.png)`
*   Wiki embedded images: `![[filename.png|caption]]`
*   Direct link previews: `[[filename.png]]`

Only the images found in your content are included in the export, keeping the file size manageable.

### 3. Version History
If you choose to include history, the engine bundles only the version files corresponding to the pages in your selected branch.

---

## Export Formats

There are two ways to export your data:

### 1. Zipped HTML Branch
This compiles your branch into a standalone, static website.
*   **Self-Contained**: Includes a responsive HTML template to view your content in any browser.
*   **Safe Filenames**: Automatically renames pages to be compatible with all operating systems (e.g., converting special characters to safe filename slugs).
*   **Navigation**: Includes a sidebar with links to all pages within the exported branch.
*   **Link Handling**: Links to pages outside your export are marked as "External," and broken links are visually flagged.

### 2. Wiki Branch Backup
This generates a raw backup of your data.
*   **Database Slice**: A `wiki_storage.json` file containing only the reachable pages.
*   **Localized Media**: A folder containing only the images used by these pages.
*   **Selective History**: A `versions/` folder containing the edit history for these specific pages.

---

## Uses for Exported Data

### Static Web Hosting
You can upload the **Zipped HTML Branch** to any static host (such as GitHub Pages, Netlify, or Vercel). Because these are standard HTML files, they require no database or server-side software to run.

### Migrating or Splitting Wikis
Use the **Wiki Branch Backup** to move content. You can take this data and point a new LyngoSketch instance to it. This is a practical way to split a large wiki into smaller, specialized projects.

### Offline Archives and Interoperability
*   **Offline Access**: The HTML exports work in any browser without an internet connection, making them ideal for long-term storage on flash drives or external hard drives.
*   **Compatibility**: Because the data is stored in standard Markdown and JSON formats, you can easily open or import your content into other markdown-based tools like Obsidian, Logseq, or Zettlr.