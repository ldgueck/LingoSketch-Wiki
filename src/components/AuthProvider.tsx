import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    console.log("Starting auth check...");
    setError(null);
    
    // Safety timeout to prevent stuck loading screen
    const timeout = setTimeout(() => {
      console.warn("Auth check timed out after 10s");
      setError("The server took too long to respond. You might be offline or the server might be starting up still.");
      setIsLoading(false);
    }, 10000);

    try {
      const response = await fetch("/api/auth-status", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Auth status received:", data);
      setIsAuthenticated(data.isAuthenticated);
    } catch (err: any) {
      console.error("Auth check failed:", err);
      setIsAuthenticated(false);
      // We don't necessarily set a visible error here unless it's a persistent failure
      // because we want to allow the user to see the login screen even if auth check fails
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (password: string) => {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
      {error && !isAuthenticated && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-2xl z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4">
          <p className="text-sm font-medium">{error}</p>
          <button 
            onClick={() => { setIsLoading(true); checkAuth(); }}
            className="mt-2 text-xs bg-white text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-50 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
