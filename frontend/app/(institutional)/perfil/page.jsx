"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/services/api";
import { Avatar, ErrorMessage } from "@/components/UI";
export default function ProfilePage() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setBusy(true);
    const form = event.currentTarget;
    try {
      await api("/auth/password/", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      setSuccess(true);
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-panel page-panel">
      <header className="section-heading">
        <h1>Mi perfil</h1>
        <p>Tu cuenta y seguridad de acceso.</p>
      </header>
      <div className="profile-summary">
        <Avatar name={user?.nombre} />
        <div>
          <strong>{user?.nombre}</strong>
          <p className="muted">{user?.username}</p>
        </div>
      </div>
      <h2>Cambiar contraseña</h2>
      <p className="muted">
        Utilizá al menos 10 caracteres y evitá datos personales.
      </p>
      <ErrorMessage message={error} />
      {success && (
        <p className="success-message" role="status">
          Contraseña actualizada correctamente.
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Contraseña actual
          <input
            type="password"
            name="actual"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          Nueva contraseña
          <input
            type="password"
            name="nueva"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </label>
        <label>
          Confirmar nueva contraseña
          <input
            type="password"
            name="confirmar"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Guardando…" : "Actualizar contraseña"}
        </button>
      </form>
    </section>
  );
}
