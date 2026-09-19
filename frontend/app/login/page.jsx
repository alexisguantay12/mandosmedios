"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cross, ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorMessage } from "@/components/UI";
export default function LoginPage() {
  const { user, signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user) router.replace("/tablero");
  }, [user, router]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(username, password);
      router.replace("/tablero");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-wordmark">
          <Cross size={40} strokeWidth={3} />
          <span>
            HOSPITAL PRIVADO
            <br />
            <strong>SANTA CLARA DE ASÍS</strong>
          </span>
        </div>
        <div>
          <div className="eyebrow">CONECTADOS PARA MEJORAR</div>
          <h1>
            Cada tema,
            <br />
            un paso adelante.
          </h1>
          <p>
            Un espacio para organizar, compartir y dar seguimiento a las
            acciones de nuestro hospital.
          </p>
        </div>
        <small>SEGUIMIENTO INSTITUCIONAL · MANDOS MEDIOS</small>
      </section>
      <section className="login-form-panel">
        <form onSubmit={submit}>
          <div className="login-symbol">
            <LockKeyhole size={26} />
          </div>
          <h2>Bienvenido</h2>
          <p>Ingresá con tu usuario institucional.</p>
          <ErrorMessage message={error} />
          <label>
            Usuario
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="button primary full-width" disabled={busy}>
            {busy ? "Ingresando…" : "Iniciar sesión"}
            <ArrowRight size={18} />
          </button>
          <p className="login-support">
            Si necesitás acceso o recuperar tu contraseña, comunicate con
            Sistemas.
          </p>
        </form>
      </section>
    </main>
  );
}
