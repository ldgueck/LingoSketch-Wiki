# Coder.md - LyngoSketch Wiki Developer Manual

## 1. Project Overview
LyngoSketch Wiki is a persistent, Node.js-based wiki engine. Its function is to facilitate collaborative knowledge management through page-based storage, currently implemented via a SQLite database.

## 2. Technical Stack
- **Runtime:** Node.js
- **Backend:** Express.js
- **Frontend:** React with Vite
- **Database:** SQLite
- **Build System:** Vite (SPA) + esbuild (server-side bundle)

## 3. System Architecture
The application operates on a full-stack architecture:
- **Server:** Handles API routing and database operations. It must be bundled into `dist/server.cjs` for deployment.
- **Database:** SQLite is used for page content storage. Ensure the storage path is correctly configured within the server environment.
- **Client:** A React SPA that communicates with the server-side endpoints for all data persistence and retrieval tasks.

## 4. Development Workflow
### 4.1 Prerequisites
- Node.js environment.
- Dependencies installed via `npm install`.

### 4.2 Build and Start
- **Build:** `npm run build`
- **Start:** `npm start` (This executes `node dist/server.cjs`)

### 4.3 Port Configuration
The infrastructure defaults to port 3000. If modification of the port is necessary due to specific infrastructure requirements, ensure the server-side configuration in `server.ts` and any relevant systemd service files or external proxies are updated accordingly.

## 5. Database Persistence
SQLite persists data directly to the `wiki.sqlite` file in the root directory. 
- **Maintenance:** Ensure the application has read/write permissions for both the `wiki.sqlite` file and the root directory. 
- **Troubleshooting:** If new pages disappear after restart, verify the persistent storage path. If the service configuration (e.g., in a systemd service file) forces a working directory or a temporary directory, SQLite may be initializing a new database in an unexpected location instead of the project root.

## 6. Deployment and Service Configuration
### 6.1 Service Management
When running as a system service:
- **Service Files:** Typically located at `/etc/systemd/system/`.
- **Modifications:** Use `systemctl edit <service-name>` for overrides. To comment lines within service files, use `#` at the beginning of the line.
- **Management:** 
  - Stop service: `sudo systemctl stop <service-name>`
  - Start service: `sudo systemctl start <service-name>`
  - Restart service: `sudo systemctl restart <service-name>`

### 6.2 Process Monitoring
If necessary, identify processes via `ps aux | grep <process-name>`. The process ID (PID) is the second column of the output. Termination of unresponsive processes may be required via `kill <PID>` or `kill -9 <PID>` if the process fails to terminate gracefully.

## 7. Authentication System
The wiki requires authentication for all API access.

### 7.1 User Management
Credentials are stored locally in the `passwd.json` file in the project root. Each user entry includes a password and a role (`admin` or `user`).

### 7.2 Access Control
- **Authentication**: Access is verified via the `wiki_auth` cookie, which is set upon a successful login and must match a username defined in `passwd.json`.
- **Authorization**: All API routes are protected by `authMiddleware`, which validates if the user exists in `passwd.json`. Currently, both `admin` and `user` roles are permitted access to all wiki content. The `role` field is infrastructure for future implementation of granular role-based access control (e.g., restricting editing functions to administrators only).
