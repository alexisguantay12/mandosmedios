
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays, Plus, Search, Users, FileText,
 RefreshCw, X, Save, Clock3, FileDown, Download
} from "lucide-react";

import AsistenciasModal from "./AsistenciasModal";

import { api } from "@/services/api";

const azul = "#2563eb";
const borde = "#e2e8f0";

function fechaVisible(valor) {
  if (!valor) return "-";
  const [anio, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

function fechaHoy() {
  const ahora = new Date();
  return [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, "0"),
    String(ahora.getDate()).padStart(2, "0")
  ].join("-");
}

function fechaConZona(fecha, hora) {
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
    throw new Error("La fecha u hora no es válida.");
  }

  const offset = -local.getTimezoneOffset();
  const signo = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const zona = `${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;

  return `${fecha}T${hora}:00${zona}`;
}

export default function ReunionesPage() {
  const [reuniones, setReuniones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [fecha, setFecha] = useState(fechaHoy);
  const [inicio, setInicio] = useState("09:00");
  const [fin, setFin] = useState("12:00");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState("");

  const cargarReuniones = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const data = await api("/reuniones/");
      setReuniones(
        Array.isArray(data) ? data : data.results || []
      );
    } catch (err) {
      setError(err.message || "Error al cargar reuniones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarReuniones();
  }, [cargarReuniones]);

  function abrirNueva() {
    setFecha(fechaHoy());
    setInicio("09:00");
    setFin("12:00");
    setObservaciones("");
    setErrorFormulario("");
    setModal({ tipo: "nueva" });
  }

  async function crearReunion(e) {
    e.preventDefault();
    if (guardando) return;

    if (!fecha || !inicio || !fin) {
      setErrorFormulario("Completá fecha y horario.");
      return;
    }

    if (fin <= inicio) {
      setErrorFormulario(
        "La hora de finalización debe ser posterior al inicio."
      );
      return;
    }

    setGuardando(true);
    setErrorFormulario("");

    try {
      const datos = {
        titulo: "Reunión Miércoles",
        fecha: fechaConZona(fecha, inicio),
        hora_inicio: inicio,
        hora_fin: fin,
        observaciones: observaciones.trim()
      };

      await api("/reuniones/", {
        method: "POST",
        body: datos
      });

      setModal(null);
      await cargarReuniones();
    } catch (err) {
      setErrorFormulario(
        err.message || "No se pudo crear la reunión."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function abrirDetalle(reunion, tipo) {
    setModal({ reunion, tipo });
    setDetalle(null);
    setCargandoDetalle(true);

    try {
      const endpoint =
        tipo === "asistencias"
          ? `/reuniones/${reunion.id}/asistencias/`
          : `/reuniones/${reunion.id}/minuta/`;

      const data = await api(endpoint);
      setDetalle(data);
    } catch (err) {
      setDetalle({
        error: err.message || "Error al consultar."
      });
    } finally {
      setCargandoDetalle(false);
    }
  }
  
  const [descargando, setDescargando] = useState(null);
  const [errorDescarga, setErrorDescarga] = useState("");

  async function descargarMinuta(reunion, formato) {
    const clave = `${reunion.id}-${formato}`;

    if (descargando) return;

    setDescargando(clave);
    setErrorDescarga("");

    const baseUrl = (
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000/api"
    ).replace(/\/$/, "");

    try {
      const response = await fetch(
        `${baseUrl}/reuniones/${reunion.id}/${formato}/`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        let mensaje = "No se pudo descargar la minuta.";

        try {
          const error = await response.json();
          mensaje = error.detail || error.horario || mensaje;
          if (Array.isArray(mensaje)) {
            mensaje = mensaje.join(", ");
          }
        } catch {
          // El servidor no devolvió un error JSON.
        }

        throw new Error(mensaje);
      }

      const archivo = await response.blob();

      const extension = formato === "word" ? "docx" : "pdf";
      const fecha = reunion.fecha?.slice(0, 10) || "sin-fecha";

      const nombre = `Minuta_Mandos_Medios_${fecha}.${extension}`;

      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorDescarga(
        err.message || "Ocurrió un error durante la descarga."
      );
    } finally {
      setDescargando(null);
    }
  }

  const filtradas = reuniones.filter((r) =>
    `${r.titulo} ${fechaVisible(r.fecha)}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Reuniones</h1>
          <p style={s.subtitle}>
            Gestión y seguimiento de reuniones de Mandos Medios
          </p>
        </div>

        <button style={s.primary} onClick={abrirNueva}>
          <Plus size={18} />
          Nueva reunión
        </button>
      </header>

      <section style={s.card}>
        <div style={s.toolbar}>
          <div style={s.search}>
            <Search size={18} color="#64748b" />
            <input
              style={s.searchInput}
              placeholder="Buscar reunión por fecha o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <button
            style={s.button}
            onClick={cargarReuniones}
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {error && <p style={s.error}>{error}</p>}
        {errorDescarga && (
            <p style={s.error}>{errorDescarga}</p>
            )}
        {cargando ? (
          <p style={s.empty}>Cargando reuniones...</p>
        ) : filtradas.length === 0 ? (
          <div style={s.empty}>
            <CalendarDays size={30} />
            <p>No se encontraron reuniones.</p>
          </div>
        ) : (
          filtradas.map((r) => (
            <div key={r.id} style={s.reunion}>
              <div style={s.reunionInfo}>
                <div style={s.calendar}>
                  <CalendarDays size={22} />
                </div>

                <div>
                  <strong>{r.titulo}</strong>
                  <p style={s.subtitle}>
                    {fechaVisible(r.fecha)} ·{" "}
                    {String(r.hora_inicio).slice(0, 5)} a{" "}
                    {String(r.hora_fin).slice(0, 5)}
                  </p>
                  <span style={s.badge}>
                    {r.estado_minuta === "confirmada"
                      ? "Confirmada"
                      : "Borrador"}
                  </span>
                </div>
              </div>

              <div style={s.actions}>
                <button
                  style={s.button}
                  title="Ver asistentes y ausentes"
                  onClick={() => setModal({ tipo: "asistencias", reunion: r })}
                >
                  <Search size={17} />
                  <Users size={16} />
                </button>

                <button
                  style={s.button}
                  onClick={() => abrirDetalle(r, "minuta")}
                >
                  <FileText size={17} />
                  Minuta
                </button>
                                
                <button
                style={s.button}
                title="Descargar minuta en Word"
                disabled={Boolean(descargando)}
                onClick={() => descargarMinuta(r, "word")}
                >
                <Download size={17} />
                {descargando === `${r.id}-word` ? "Descargando..." : "Word"}
                </button>

                <button
                style={s.button}
                title="Descargar minuta en PDF"
                disabled={Boolean(descargando)}
                onClick={() => descargarMinuta(r, "pdf")}
                >
                <FileDown size={17} />
                {descargando === `${r.id}-pdf` ? "Descargando..." : "PDF"}
                </button>

              </div>
            </div>
          ))
        )}
      </section>

      {modal?.tipo === "asistencias" && (
        <AsistenciasModal
            reunion={modal.reunion}
            onClose={() => setModal(null)}
        />
        )}

        {modal && modal.tipo !== "asistencias" && (
        <div
          style={s.overlay}
          onClick={() => {
            if (!guardando) setModal(null);
          }}
        >
          <div
            style={s.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>
                  {modal.tipo === "nueva"
                    ? "Nueva reunión"
                    : modal.tipo === "asistencias"
                    ? "Asistentes y ausentes"
                    : "Minuta automática"}
                </h2>

                <p style={s.subtitle}>
                  {modal.reunion
                    ? `${modal.reunion.titulo} · ${fechaVisible(modal.reunion.fecha)}`
                    : "Mandos Medios"}
                </p>
              </div>

              <button
                style={s.button}
                onClick={() => setModal(null)}
                disabled={guardando}
              >
                <X size={19} />
              </button>
            </div>

            {modal.tipo === "nueva" ? (
              <form onSubmit={crearReunion}>
                <div style={s.formBody}>
                  <div style={s.info}>
                    <CalendarDays size={21} />
                    <div>
                      <strong>Reunión Miércoles</strong>
                      <p style={s.subtitle}>
                        Nombre asignado automáticamente
                      </p>
                    </div>
                  </div>

                  <label style={s.label}>
                    Fecha de reunión
                    <input
                      type="date"
                      style={s.input}
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </label>

                  <div style={s.grid}>
                    <label style={s.label}>
                      Hora de inicio
                      <input
                        type="time"
                        style={s.input}
                        value={inicio}
                        onChange={(e) => setInicio(e.target.value)}
                        required
                      />
                    </label>

                    <label style={s.label}>
                      Hora de finalización
                      <input
                        type="time"
                        style={s.input}
                        value={fin}
                        onChange={(e) => setFin(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <div style={s.notice}>
                    <Clock3 size={19} />
                    <span>
                      La minuta recuperará automáticamente
                      los movimientos y comentarios registrados
                      durante este horario.
                    </span>
                  </div>

                  <label style={s.label}>
                    Observaciones (opcional)
                    <textarea
                      style={{ ...s.input, resize: "vertical" }}
                      rows={3}
                      value={observaciones}
                      onChange={(e) =>
                        setObservaciones(e.target.value)
                      }
                      placeholder="Observaciones generales..."
                    />
                  </label>

                  {errorFormulario && (
                    <p style={s.error}>{errorFormulario}</p>
                  )}
                </div>

                <div style={s.footer}>
                  <button
                    type="button"
                    style={s.button}
                    disabled={guardando}
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    style={s.primary}
                    disabled={guardando}
                  >
                    <Save size={17} />
                    {guardando
                      ? "Guardando..."
                      : "Crear reunión"}
                  </button>
                </div>
              </form>
            ) : cargandoDetalle ? (
              <p style={s.empty}>Cargando información...</p>
            ) : detalle?.error ? (
              <p style={s.error}>{detalle.error}</p>
            ) : modal.tipo === "asistencias" ? (
              <div>
                <p style={s.subtitle}>
                  {detalle?.presentes || 0} presentes ·{" "}
                  {detalle?.ausentes || 0} ausentes
                </p>

                {(detalle?.asistencias || []).length === 0 ? (
                  <p style={s.empty}>
                    Todavía no se registraron asistencias.
                  </p>
                ) : (
                  detalle.asistencias.map((a) => (
                    <div key={a.id} style={s.detailRow}>
                      <div>
                        <strong>{a.responsable_nombre}</strong>
                        {a.motivo_ausencia && (
                          <p style={s.subtitle}>
                            Motivo: {a.motivo_ausencia}
                          </p>
                        )}
                      </div>
                      <span style={s.badge}>
                        {a.condicion === "presente"
                          ? "Presente"
                          : "Ausente"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div>
                <p style={s.subtitle}>
                  {detalle?.cantidad_temas || 0} temas
                  detectados automáticamente
                </p>

                {(detalle?.temas || []).length === 0 ? (
                  <p style={s.empty}>
                    No se detectó actividad durante
                    el horario de esta reunión.
                  </p>
                ) : (
                  detalle.temas.map((tema) => (
                    <div key={tema.tema_id} style={s.topic}>
                      <strong>{tema.titulo}</strong>

                      {tema.cambio_estado && (
                        <p style={s.subtitle}>
                          {tema.estado_inicial?.nombre || "Anterior"}
                          {" → "}
                          {tema.estado_final?.nombre || "Actual"}
                        </p>
                      )}

                      {(tema.comentarios || []).map((c) => (
                        <div key={c.id} style={s.comment}>
                          <strong>{c.autor}</strong>
                          <p>{c.texto}</p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: {
    maxWidth: 1100,
    margin: "0 auto"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 750,
    color: "#172b4d"
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    margin: "6px 0"
  },
  primary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: azul,
    color: "#fff",
    padding: "11px 16px",
    border: 0,
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer"
  },
  card: {
    background: "#fff",
    border: `1px solid ${borde}`,
    borderRadius: 16,
    overflow: "hidden"
  },
  toolbar: {
    display: "flex",
    gap: 12,
    padding: 18,
    borderBottom: `1px solid ${borde}`
  },
  search: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    border: `1px solid ${borde}`,
    borderRadius: 9,
    padding: "9px 12px"
  },
  searchInput: {
    width: "100%",
    border: 0,
    outline: "none",
    background: "transparent",
    fontSize: 14
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "9px 12px",
    background: "#fff",
    border: `1px solid ${borde}`,
    borderRadius: 9,
    cursor: "pointer",
    color: "#334155"
  },
  reunion: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    padding: 18,
    borderBottom: `1px solid ${borde}`
  },
  reunionInfo: {
    display: "flex",
    alignItems: "center",
    gap: 14
  },
  calendar: {
    padding: 12,
    background: "#eff6ff",
    color: azul,
    borderRadius: 11
  },
  badge: {
    display: "inline-block",
    padding: "4px 9px",
    background: "#f1f5f9",
    color: "#475569",
    borderRadius: 7,
    fontSize: 12
  },
  actions: {
    display: "flex",
    gap: 8
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(15,23,42,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  modal: {
    background: "#fff",
    width: "100%",
    maxWidth: 650,
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,.15)"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20
  },
  modalTitle: {
    margin: 0,
    fontSize: 19,
    color: "#172b4d"
  },
  formBody: {
    display: "flex",
    flexDirection: "column",
    gap: 18
  },
  info: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 15,
    background: "#f1f5f9",
    borderRadius: 10
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    fontSize: 13,
    fontWeight: 600,
    color: "#334155"
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#1e293b",
    background: "#fff"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 14
  },
  notice: {
    display: "flex",
    gap: 10,
    padding: 12,
    borderRadius: 9,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    lineHeight: 1.5
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 20,
    marginTop: 20,
    borderTop: `1px solid ${borde}`
  },
  empty: {
    padding: 30,
    textAlign: "center",
    color: "#64748b"
  },
  error: {
    color: "#b91c1c",
    background: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    fontSize: 13
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 0",
    borderBottom: `1px solid ${borde}`
  },
  topic: {
    padding: 14,
    border: `1px solid ${borde}`,
    borderRadius: 10,
    marginTop: 12
  },
  comment: {
    padding: 10,
    marginTop: 10,
    background: "#f8fafc",
    borderRadius: 8,
    fontSize: 13
  }
};
