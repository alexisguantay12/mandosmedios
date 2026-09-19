"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, csrf } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  async function refresh() {
    setLoading(true);
    setConnectionError("");
    try {
      setUser(await api("/auth/yo/"));
      await csrf();
    } catch (error) {
      setUser(null);
      if (![401, 403].includes(error.status)) setConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function signIn(username, password) {
    await csrf();
    const result = await api("/auth/login/", {
      method: "POST",
      body: { username, password },
    });
    setUser(result.usuario);
  }
  async function signOut() {
    await api("/auth/logout/", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, connectionError, refresh, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
