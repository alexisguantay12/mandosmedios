"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Cross,
  LayoutDashboard,
  LogOut,
  UserRound,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Avatar, ErrorMessage, Loading } from "./UI";
import { adminUrl } from "@/services/api";

export default function Shell({ children }) {
  const { user, loading, connectionError, refresh, signOut } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!loading && !user && !connectionError) router.replace("/login");
  }, [loading, user, connectionError, router]);
  if (loading) return <Loading label="Comprobando sesión…" />;
  if (connectionError)
    return (
      <main className="connection-screen">
        <ErrorMessage message={connectionError} onRetry={refresh} />
      </main>
    );
  if (!user) return null;
  async function exit() {
    try {
      await signOut();
      router.replace("/login");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/tablero" className="brand">
          <Cross size={35} strokeWidth={3} />
          <span>
            <strong>Santa Clara de Asís</strong>
            <small>HOSPITAL PRIVADO</small>
          </span>
        </Link>
        <div className="sidebar-caption">SEGUIMIENTO INSTITUCIONAL</div>
        <nav aria-label="Navegación principal">
          <Link href="/tablero" className={path === "/tablero" ? "active" : ""}>
            <LayoutDashboard size={20} />
            <span>Tablero</span>
          </Link>
          <Link
            href="/mis-temas"
            className={path === "/mis-temas" ? "active" : ""}
          >
            <UserRound size={20} />
            <span>Mis temas</span>
          </Link>
          <Link
            href="/reuniones"
            className={path.startsWith("/reuniones") ? "active" : ""}
          >
            <CalendarDays size={20} />
            <span>Reuniones</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          {user.is_staff && (
            <a
              href={adminUrl}
              target="_blank"
              rel="noreferrer"
              className="admin-link"
            >
              <ShieldCheck size={17} />
              <span>Administración</span>
            </a>
          )}
          <Link
            href="/perfil"
            className="profile-link"
            aria-label={`Mi perfil de ${user.nombre}`}
          >
            <Avatar name={user.nombre} />
            <span>
              <strong>{user.nombre}</strong>
              <small>Mi perfil</small>
            </span>
          </Link>
          <button onClick={exit} className="logout" aria-label="Cerrar sesión">
            <LogOut size={19} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <ErrorMessage message={error} />
        {children}
        <footer className="institution-footer">
          HOSPITAL PRIVADO SANTA CLARA DE ASÍS
        </footer>
      </main>
    </div>
  );
}
