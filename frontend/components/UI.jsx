"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, LoaderCircle, X } from "lucide-react";

export function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function Loading({ label = "Cargando información…" }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      {label}
    </div>
  );
}
export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
      {onRetry && (
        <button className="button ghost" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = "No hay temas para mostrar",
  text = "Los temas que registres aparecerán aquí.",
}) {
  return (
    <div className="empty">
      <FileText size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Avatar({ name = "", small = false }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "—";
  return (
    <span aria-hidden="true" className={`avatar ${small ? "small" : ""}`}>
      {initials}
    </span>
  );
}
export function AreaBadge({ area }) {
  return (
    <span className="area-badge" style={{ "--area-color": area.color }}>
      {area.nombre}
    </span>
  );
}
export function Priority({ value }) {
  return (
    <span className={`priority ${value}`}>
      {{ alta: "Alta", media: "Media", baja: "Baja" }[value] || value}
    </span>
  );
}
export function Status({ state }) {
  return (
    <span
      className={`status ${state.es_resuelto ? "resolved" : state.es_inicial ? "new" : "progress"}`}
    >
      <span className="status-dot" />
      {state.nombre}
    </span>
  );
}
export function formatDate(value, full = false) {
  if (!value) return "Sin fecha registrada";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Salta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(full ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}
export function Modal({ children, title, onClose, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        className="icon-button modal-close"
        aria-label="Cerrar ventana"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      {children}
    </dialog>
  );
}
