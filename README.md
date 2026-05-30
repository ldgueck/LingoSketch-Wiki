# LyngoSketch Wiki

LingoSketch Wiki is a lightweight, multi-instance, multi-user wiki engine that stores data in plain JSON files. It is designed to be portable, highly performant, and easy to run on local machines or remote servers for collaborative knowledge management.

## Getting Started

### Prerequisites

*   Node.js (v18+)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd LyngoSketchWiki
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the application:
   ```bash
   npm run build
   ```

### Launching an Instance

Launch an instance using a configuration file:
   ```bash
   npm start ./configs/my-wiki.json
   ```

## Architecture & Internals

### Data Persistence (JSON Storage)
Instead of a database, LyngoSketch stores wiki content in JSON files. This ensures your data remains human-readable, easy to back up, and version-controllable with Git.

### Reliability (Atomic Writes)
The system uses atomic file writes when saving pages or database updates. This minimizes the risk of file corruption if the server reboots or loses power during a write operation.

### Multi-Instance/Horizontal Scaling
You can run multiple, completely independent wiki instances on a single machine. Create a custom JSON configuration file for each wiki and assign it a unique port:

```json
{
  "wikiName": "My Project",
  "port": 3001,
  "imagesDir": "./data/project/images",
  "dataFile": "./data/project/storage.json"
}
```

### Export Engine
The wiki includes a branch-aware export engine that allows you to slice off a self-contained subset of pages and assets from your knowledge base.

*   **Recursive Discovery**: The engine traces all internal links (WikiLinks and Markdown links) starting from a selected page to determine what to include in the branch.
*   **Asset Harvesting**: It selectively exports only the images referenced within the branch, keeping export files compact.
*   **Branch-Aware Backups**: Exports can include selective version history for the pages included in the branch.

*For more details, see `branch_readme.md` in this repository.*

## Security & Deployment

*   **Access Control**: The wiki supports multiple concurrent users. You can secure access to an instance using the `APP_PASSWORD` environment variable.
*   **Remote Access**: If you are hosting the wiki on a public server, it is recommended to place it behind a reverse proxy (such as Nginx, Caddy, or Traefik) to handle SSL/TLS encryption.
*   **Process Management**: For production environments, use a process manager like PM2 to keep your wiki instances running in the background.

## License
MIT
