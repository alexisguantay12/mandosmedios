
"use client";

import { useState } from "react";
import { CalendarDays, Clock3, X, Save } from "lucide-react";
import { api } from "@/services/api";

function fechaLocal() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function fechaISOConZona(fecha, hora) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);

  const local = new Date(anio, mes - 1, dia, hh, mm);

  if (
    local.getFullYear() !== anio ||
    local.getMonth() !== mes - 1 ||
    local.getDate() !== dia ||
    local.getHours() !== hh ||
    local.getMinutes() !== mm
  ) {
    throw new Error("La fecha u hora seleccionada no es válida.");
  }

  const offset = -local.getTimezoneOffset();
  const signo = offset >= 0 ? "+" : "-";
  const absoluto = Math.abs(offset);

  const zona =
    signo +
    String(Math.floor(absoluto / 60)).padStart(2, "0") +
    ":" +
    String(absoluto % 60).padStart(2, "0");

  return `${fecha}T${hora}:00${zona}`;
}

export default function NuevaReunionModal({
  onClose,
  onCreated,
}) {
  const [fecha, setFecha] = useState(fechaLocal());
  const [inicio, setInicio] = useState("09:00");
  const [fin, setFin] = useState("12:00");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();

    if (guardando) return;

    if (!fecha || !inicio || !fin) {
      setError("Completá la fecha y el horario.");
      return;
    }

    if (fin <= inicio) {
      setError(
        "La hora de finalización debe ser posterior al inicio."
      );
      return;
    }

    setGuardando(true);
    setError("");

    try {
      const datos = {
        titulo: "Reunión Miércoles",
        fecha: fechaISOConZona(fecha, inicio),
        hora_inicio: inicio,
        hora_fin: fin,
        observaciones: observaciones.trim(),
      };

      // Este llamado supone que api admite:
      // api(ruta, { method, body })
      // y serializa automáticamente el body.
      const creada = await api("/reuniones/", {
        method: "POST",
        body: JSON.stringify(datos),
      });

      await onCreated(creada);
    } catch (err) {
      setError(
        err.message || "No se pudo crear la reunión."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div
        style={s.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nueva-reunion-title"
      >
        <div style={s.header}>
          <div>
            <h2 id="nueva-reunion-title" style={s.title}>
              Nueva reunión
            </h2>
            <p style={s.subtitle}>
              Registrar una reunión de Mandos Medios
            </p>
          </div>

          <button
            type="button"
            style={s.close}
            onClick={onClose}
            disabled={guardando}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={guardar}>
          <div style={s.content}>
            <div style={s.info}>
              <CalendarDays size={20} />
              <div>
                <strong>Reunión Miércoles</strong>
                <p style={s.subtitle}>
                  El nombre se asigna automáticamente.
                </p>
              </div>
            </div>

            <label style={s.label}>
              Fecha de reunión
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={s.input}
              />
            </label>

            <div style={s.grid}>
              <label style={s.label}>
                Hora de inicio
                <input
                  type="time"
                  required
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  style={s.input}
                />
              </label>

              <label style={s.label}>
                Hora de finalización
                <input
                  type="time"
                  required
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                  style={s.input}
                />
              </label>
            </div>

            <div style={s.notice}>
              <Clock3 size={17} />
              <span>
                La minuta recuperará los cambios de estado y
                comentarios registrados durante este horario.
              </span>
            </div>

            <label style={s.label}>
              Observaciones (opcional)
              <textarea
                value={observaciones}
                onChange={(e) =>
                  setObservaciones(e.target.value)
                }
                placeholder="Observaciones generales..."
                rows={3}
                style={{
                  ...s.input,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </label>

            {error && (
              <div role="alert" style={s.error}>
                {error}
              </div>
            )}
          </div>

          <div style={s.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              style={s.cancel}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              style={s.save}
            >
              <Save size={17} />
              {guardando ? "Guardando..." : "Crear reunión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    background: "rgba(15,23,42,.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 24px 70px rgba(0,0,0,.2)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "22px 24px",
    borderBottom: "1px solid #e2e8f0",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    color: "#172b4d",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    margin: "5px 0 0",
  },
  close: {
    border: 0,
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
  },
  content: {
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  info: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 15,
    background: "#f1f5f9",
    borderRadius: 10,
    color: "#334155",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    fontSize: 14,
    background: "#fff",
    color: "#1e293b",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 9,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    lineHeight: 1.5,
  },
  error: {
    padding: 12,
    borderRadius: 8,
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 13,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "18px 24px",
    borderTop: "1px solid #e2e8f0",
  },
  cancel: {
    padding: "10px 16px",
    background: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    cursor: "pointer",
    color: "#475569",
  },
  save: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 17px",
    border: 0,
    borderRadius: 9,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
};
