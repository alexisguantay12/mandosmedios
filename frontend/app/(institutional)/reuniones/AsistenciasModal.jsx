
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Save, Users, CheckCircle2, UserX, Clock3 } from "lucide-react";
import { api } from "@/services/api";

const COLORES = {
  presente: {
    fondo: "#dcfce7",
    texto: "#166534",
  },
  ausente: {
    fondo: "#fee2e2",
    texto: "#991b1b",
  },
  sin_registrar: {
    fondo: "#f1f5f9",
    texto: "#475569",
  },
};

function fechaVisible(valor) {
  if (!valor) return "-";
  const [anio, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function AsistenciasModal({ reunion, onClose }) {
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [modificado, setModificado] = useState(false);

  const confirmada = reunion.estado_minuta === "confirmada";

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError("");

      try {
        const datos = await api(
          `/reuniones/${reunion.id}/asistencias/`
        );

        if (!activo) return;

        setAsistencias(
          (datos.asistencias || []).map((a) => ({
            responsable: a.responsable,
            responsable_nombre: a.responsable_nombre,
            condicion: a.condicion || "sin_registrar",
            motivo_ausencia: a.motivo_ausencia || "",
          }))
        );
      } catch (err) {
        if (activo) {
          setError(err.message || "No se pudo cargar la asistencia.");
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, [reunion.id]);

  const resumen = useMemo(() => ({
    presentes: asistencias.filter(
      (a) => a.condicion === "presente"
    ).length,
    ausentes: asistencias.filter(
      (a) => a.condicion === "ausente"
    ).length,
    sinRegistrar: asistencias.filter(
      (a) => a.condicion === "sin_registrar"
    ).length,
  }), [asistencias]);

  function actualizar(id, campo, valor) {
    setAsistencias((actuales) =>
      actuales.map((a) => {
        if (a.responsable !== id) return a;

        if (campo === "condicion") {
          return {
            ...a,
            condicion: valor,
            motivo_ausencia:
              valor === "ausente" ? a.motivo_ausencia : "",
          };
        }

        return { ...a, [campo]: valor };
      })
    );

    setModificado(true);
    setMensaje("");
    setError("");
  }

  async function guardar() {
    if (guardando || confirmada || !modificado) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const payload = {
        asistencias: asistencias.map((a) => ({
          responsable: a.responsable,
          condicion: a.condicion,
          motivo_ausencia:
            a.condicion === "ausente"
              ? a.motivo_ausencia.trim()
              : "",
        })),
      };

      // api() ya serializa automáticamente el objeto.
      await api(`/reuniones/${reunion.id}/asistencias/`, {
        method: "PUT",
        body: payload,
      });

      setModificado(false);
      setMensaje("Asistencias guardadas correctamente.");
    } catch (err) {
      setError(err.message || "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    if (guardando) return;

    if (
      modificado &&
      !window.confirm("Hay cambios sin guardar. ¿Querés salir?")
    ) {
      return;
    }

    onClose();
  }

  return (
    <div style={s.overlay} onClick={cerrar}>
      <div
        style={s.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asistencias-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={s.header}>
          <div>
            <h2 id="asistencias-title" style={s.title}>
              Asistentes y ausentes
            </h2>
            <p style={s.subtitle}>
              {reunion.titulo} · {fechaVisible(reunion.fecha)}
            </p>
          </div>

          <button
            type="button"
            style={s.close}
            onClick={cerrar}
            disabled={guardando}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {cargando ? (
          <p style={s.empty}>Cargando responsables...</p>
        ) : (
          <>
            <div style={s.resumen}>
              <div style={s.contador}>
                <CheckCircle2 size={19} color="#15803d" />
                <strong style={{ color: "#15803d" }}>
                  {resumen.presentes}
                </strong>
                <span>Presentes</span>
              </div>

              <div style={s.contador}>
                <UserX size={19} color="#b91c1c" />
                <strong style={{ color: "#b91c1c" }}>
                  {resumen.ausentes}
                </strong>
                <span>Ausentes</span>
              </div>

              <div style={s.contador}>
                <Clock3 size={19} color="#64748b" />
                <strong>{resumen.sinRegistrar}</strong>
                <span>Sin registrar</span>
              </div>
            </div>

            {confirmada && (
              <div style={s.notice}>
                Esta reunión está confirmada. La asistencia
                se encuentra bloqueada para preservar el
                registro histórico.
              </div>
            )}

            {asistencias.length === 0 ? (
              <div style={s.empty}>
                <Users size={28} />
                <p>No hay responsables asociados a esta reunión.</p>
              </div>
            ) : (
              <div style={s.lista}>
                {asistencias.map((a) => {
                  const color =
                    COLORES[a.condicion] ||
                    COLORES.sin_registrar;

                  return (
                    <div key={a.responsable} style={s.fila}>
                      <div style={s.filaPrincipal}>
                        <strong style={s.nombre}>
                          {a.responsable_nombre}
                        </strong>

                        <select
                          value={a.condicion}
                          disabled={confirmada || guardando}
                          onChange={(e) =>
                            actualizar(
                              a.responsable,
                              "condicion",
                              e.target.value
                            )
                          }
                          style={{
                            ...s.select,
                            background: color.fondo,
                            color: color.texto,
                          }}
                        >
                          <option value="sin_registrar">
                            Sin registrar
                          </option>
                          <option value="presente">
                            Presente
                          </option>
                          <option value="ausente">
                            Ausente
                          </option>
                        </select>
                      </div>

                      {a.condicion === "ausente" && (
                        <div style={s.motivoWrap}>
                          <label style={s.label}>
                            Motivo de ausencia (opcional)
                          </label>

                          <input
                            type="text"
                            style={s.input}
                            value={a.motivo_ausencia}
                            disabled={confirmada || guardando}
                            onChange={(e) =>
                              actualizar(
                                a.responsable,
                                "motivo_ausencia",
                                e.target.value
                              )
                            }
                            placeholder="Ej.: Licencia, vacaciones, enfermedad..."
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <div role="alert" style={s.error}>
                {error}
              </div>
            )}

            {mensaje && (
              <div role="status" style={s.success}>
                {mensaje}
              </div>
            )}

            <div style={s.footer}>
              <span style={s.footerInfo}>
                {asistencias.length} responsables
              </span>

              <div style={s.buttons}>
                <button
                  type="button"
                  style={s.cancel}
                  onClick={cerrar}
                  disabled={guardando}
                >
                  Cerrar
                </button>

                {!confirmada && (
                  <button
                    type="button"
                    style={{
                      ...s.save,
                      opacity:
                        guardando || !modificado ? 0.55 : 1,
                    }}
                    disabled={guardando || !modificado}
                    onClick={guardar}
                  >
                    <Save size={17} />
                    {guardando
                      ? "Guardando..."
                      : "Guardar asistencia"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    background: "rgba(15,23,42,.48)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 16,
    padding: 26,
    boxShadow: "0 25px 70px rgba(0,0,0,.18)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  title: {
    margin: 0,
    color: "#172b4d",
    fontSize: 21,
    fontWeight: 700,
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
  },
  close: {
    padding: 9,
    border: "1px solid #e2e8f0",
    borderRadius: 9,
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
  },
  resumen: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 10,
    marginBottom: 22,
  },
  contador: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "14px 5px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    color: "#64748b",
    fontSize: 12,
  },
  lista: {
    display: "flex",
    flexDirection: "column",
  },
  fila: {
    padding: "14px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  filaPrincipal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  nombre: {
    fontSize: 14,
    color: "#172b4d",
  },
  select: {
    minWidth: 145,
    padding: "9px 11px",
    border: "1px solid #e2e8f0",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  motivoWrap: {
    marginTop: 12,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    marginBottom: 7,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    fontSize: 13,
  },
  notice: {
    padding: 12,
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 9,
    fontSize: 13,
    marginBottom: 14,
  },
  error: {
    padding: 12,
    marginTop: 14,
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 9,
    fontSize: 13,
  },
  success: {
    padding: 12,
    marginTop: 14,
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 9,
    fontSize: 13,
  },
  empty: {
    textAlign: "center",
    padding: 30,
    color: "#64748b",
    fontSize: 14,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid #e2e8f0",
  },
  footerInfo: {
    color: "#64748b",
    fontSize: 12,
  },
  buttons: {
    display: "flex",
    gap: 10,
  },
  cancel: {
    padding: "10px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
  },
  save: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 15px",
    border: 0,
    borderRadius: 9,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
};
