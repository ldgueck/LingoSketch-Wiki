***

# LyngoSketch Wiki

A straightforward, reliable wiki engine designed for local control and data portability. LyngoSketch uses a flat-file system, meaning your data stays in human-readable JSON files that you can easily back up, move, or manage with Git.

## Key Features

*   **Simple Data Storage**: Your wiki content is stored in JSON. No complex databases to manage—just clear, accessible files.
*   **Independent Instances**: You can run multiple, isolated wiki instances on the same machine. This makes it easy to keep different projects (like personal notes, family records, or research) separate while using the same software.
*   **Performance**: Built to handle thousands of pages quickly without the overhead of a heavy database.
*   **Flexible Deployment**: Runs just as well on a home laptop as it does on a remote server.

## Getting Started

1.  **Installation**:
    ```bash
    git clone <your-repo-url>
    cd LyngoSketchWiki
    npm install
    npm run build
    ```
2.  **Running the Wiki**:
    ```bash
    npm start ./configs/my-wiki.json
    ```

## Running Multiple Instances

You can run multiple wikis simultaneously by creating a separate configuration file for each. 

Example `config.json`:
```json
{
  "wikiName": "My Project",
  "port": 3001,
  "imagesDir": "./data/project/images",
  "dataFile": "./data/project/storage.json"
}
```
You can launch these instances individually or use a process manager like PM2 to keep them running in the background.

## Security & Reliability

*   **Atomic Saves**: The system uses atomic file writes. This helps prevent data corruption if your computer unexpectedly loses power or reboots.
*   **Access Control**: You can password-protect your instances using the `APP_PASSWORD` environment variable.
*   **Remote Access**: If you choose to host this on a public server, please use a reverse proxy (such as Nginx, Caddy, or Traefik) to handle your SSL/TLS encryption.

## License
MIT - You own your data and control your hosting environment.
