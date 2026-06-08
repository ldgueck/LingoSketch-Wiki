/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WikiView from "./pages/WikiView";
import WikiEdit from "./pages/WikiEdit";
import WikiIndex from "./pages/WikiIndex";
import NewPage from "./pages/NewPage";
import SearchResults from "./pages/SearchResults";
import ImportPage from "./pages/ImportPage";
import ImageGallery from "./pages/ImageGallery";
import PdfGallery from "./pages/PdfGallery";
import AudioGallery from "./pages/AudioGallery";
import VideoGallery from "./pages/VideoGallery";
import LoginPage from "./pages/LoginPage";
import WantedPages from "./pages/WantedPages";
import OrphanedPages from "./pages/OrphanedPages";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="text-blue-500 animate-spin mb-4" size={40} />
        <h2 className="text-white font-semibold text-lg animate-pulse">Initializing Wiki...</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-xs">
          This usually takes a few seconds. If it stays like this, the server might be starting up from a cold sleep.
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/view/HomePage" replace />} />
      <Route path="/view/:name" element={<WikiView />} />
      <Route path="/edit/:name" element={<WikiEdit />} />
      <Route path="/index" element={<WikiIndex />} />
      <Route path="/wanted" element={<WantedPages />} />
      <Route path="/orphaned" element={<OrphanedPages />} />
      <Route path="/new" element={<NewPage />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/images" element={<ImageGallery />} />
      <Route path="/pdfs" element={<PdfGallery />} />
      <Route path="/audio" element={<AudioGallery />} />
      <Route path="/videos" element={<VideoGallery />} />
      <Route path="*" element={<Navigate to="/view/HomePage" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
