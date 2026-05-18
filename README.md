# LingoSketch Wiki
 
A private, self-hosted knowledge base engine designed for digital sovereignty and offline capability.
 
## 🚀 What It Is
 
LingoSketch is a "Digital Brain" for your personal notes.
 
- **Private & Local**: Your data never leaves your device.
- **Offline First**: Fully functional without an internet connection.
- **Deep Context**: Designed for research-heavy projects requiring side-by-side documentation and AI-assisted refinement.
- **Portable**: Your entire knowledge base is stored in a simple JSON format.
 
## 🛠 Prerequisites
 
- Node.js (v18+)
 
## 💻 Installation
 
### Windows
1. Download or clone this repository.
2. Open **PowerShell** or **Git Bash** in the project directory.
3. Install dependencies: `npm install`
4. Build the application: `npm run build`
5. Start the server: `npm start`
 
### Linux (Ubuntu/Debian)
1. Ensure `node` and `npm` are installed.
2. In your terminal, navigate to the project directory.
3. Install dependencies: `npm install`
4. Build the application: `npm run build`
5. Start the server: `npm start`
 
## 🌐 Accessing the Wiki
Once the server is running, open your web browser and navigate to:
`http://localhost:3000`
 
## 🔒 Password Protection
The application is secured with a password to ensure your data stays private.
- **Default password**: `lingo`
- To customize, set the `APP_PASSWORD` environment variable in your `.env` file.
 
## 📡 Offline Features
- **No Internet Required**: Everything, including dependencies, is bundled to run entirely locally.
- **Local Data Sovereignty**: All content is saved in `wiki_storage.json`.
- **Media**: Local images are stored in `public/images/`.
- **Snapshots**: Automatic page versioning is stored in the `versions/` folder.
 
## 🏗 Architecture & Maintenance
 
- **Persistence**: Atomic file writes ensure data integrity even during power outages.
- **Data Portability**: The database is human-readable JSON. You can easily back it up, move it, or read it without the software installed.
- **Git Friendly**: The repository is set up with a `.gitignore` to keep binary files and temporary build artifacts out of your public repository.
 
## 📄 License
MIT - Feel free to use and modify for your own personal needs.
