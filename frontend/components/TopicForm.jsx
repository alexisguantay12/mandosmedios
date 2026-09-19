"use client";
import { useEffect, useState } from "react";
import { FileText, Info, Layers, Target, UserRound } from "lucide-react";
import { api } from "@/services/api";
import { ErrorMessage, Loading } from "./UI";

export default function TopicForm({ topic = null, onSaved, onCancel }) {
  const [masters, setMasters] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    titulo: topic?.titulo || "",
    tipo: topic?.tipo.id || "",
    area_origen: topic?.area_origen.id || "",
    areas_involucradas: topic?.areas_involucradas.map((a) => a.id) || [],
    responsable: topic?.responsable?.id || "",
    prioridad: topic?.prioridad || "media",
    descripcion: topic?.descripcion || "",
    impacto: topic?.impacto || "",
  });
  async function load() {
    setError("");
    try {
      const [areas, tipos, responsables] = await Promise.all([
        api("/areas/"),
        api("/tipos/"),
        api("/responsables/"),
      ]);
      setMasters({ areas, tipos, responsables });
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function field(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }
  function toggleArea(id) {
    setForm((current) => ({
      ...current,
      areas_involucradas: current.areas_involucradas.includes(id)
        ? current.areas_involucradas.filter((a) => a !== id)
        : [...current.areas_involucradas, id],
    }));
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        ...form,
        tipo: Number(form.tipo),
        area_origen: Number(form.area_origen),
        responsable: form.responsable ? Number(form.responsable) : null,
        ...(topic ? { version: topic.version } : {}),
      };
      const saved = await api(topic ? `/temas/${topic.id}/` : "/temas/", {
        method: topic ? "PATCH" : "POST",
        body: payload,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="topic-form">
      <header className="section-heading">
        <div className="eyebrow">SEGUIMIENTO INSTITUCIONAL</div>
        <h1>{topic ? "Editar tema" : "Nuevo tema"}</h1>
        <p>Registrá un problema, una necesidad o una propuesta.</p>
      </header>
      <ErrorMessage message={error} onRetry={!masters ? load : undefined} />
      {!masters ? (
        !error && <Loading />
      ) : (
        <form onSubmit={submit}>
          <div className="form-layout">
            <div className="form-fields">
              <div className="form-row title-row">
                <label>
                  Título <b>*</b>
                  <input
                    name="titulo"
                    value={form.titulo}
                    onChange={field}
                    maxLength={200}
                    placeholder="Ej. Demoras en la asignación de camas"
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Tipo de tema <b>*</b>
                  <select
                    name="tipo"
                    value={form.tipo}
                    onChange={field}
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    {masters.tipos
                      .filter((t) => t.activo || t.id === topic?.tipo.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Área de origen <b>*</b>
                  <select
                    name="area_origen"
                    value={form.area_origen}
                    onChange={field}
                    required
                  >
                    <option value="">Seleccionar área</option>
                    {masters.areas
                      .filter((a) => a.activa || a.id === topic?.area_origen.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Responsable
                  <select
                    name="responsable"
                    value={form.responsable}
                    onChange={field}
                  >
                    <option value="">Sin asignar</option>
                    {masters.responsables
                      .filter(
                        (r) => r.activo || r.id === topic?.responsable?.id,
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <fieldset className="area-selector">
                <legend>
                  Áreas involucradas{" "}
                  <span className="optional">(opcional)</span>
                </legend>
                <div className="area-options">
                  {masters.areas
                    .filter(
                      (a) => a.activa || form.areas_involucradas.includes(a.id),
                    )
                    .map((a) => (
                      <label
                        key={a.id}
                        className={
                          form.areas_involucradas.includes(a.id)
                            ? "selected"
                            : ""
                        }
                      >
                        <input
                          type="checkbox"
                          checked={form.areas_involucradas.includes(a.id)}
                          onChange={() => toggleArea(a.id)}
                        />
                        {a.nombre}
                      </label>
                    ))}
                </div>
                {!masters.areas.length && (
                  <p className="muted">
                    Primero cargá las áreas desde Django Admin.
                  </p>
                )}
              </fieldset>
              <fieldset className="priority-selector">
                <legend>
                  Prioridad <b>*</b>
                </legend>
                <div>
                  {[
                    ["alta", "Alta"],
                    ["media", "Media"],
                    ["baja", "Baja"],
                  ].map(([value, text]) => (
                    <label
                      key={value}
                      className={`${value} ${form.prioridad === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="prioridad"
                        value={value}
                        checked={form.prioridad === value}
                        onChange={field}
                      />
                      {text}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Descripción <b>*</b>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={field}
                  maxLength={30000}
                  rows={5}
                  placeholder="Describí el problema, la necesidad o la propuesta…"
                  required
                />
              </label>
              <label>
                Impacto
                <textarea
                  name="impacto"
                  value={form.impacto}
                  onChange={field}
                  maxLength={15000}
                  rows={4}
                  placeholder="¿A quién afecta? ¿Qué consecuencias tiene?"
                />
              </label>
            </div>
            <aside className="form-help">
              <h3>
                <Info size={22} />
                Tené en cuenta
              </h3>
              <p>La información clara nos ayuda a dar un mejor seguimiento.</p>
              <hr />
              <div>
                <FileText />
                <span>
                  <strong>Título y descripción</strong>
                  <p>Resumí el tema y explicá qué sucede.</p>
                </span>
              </div>
              <div>
                <Layers />
                <span>
                  <strong>Áreas involucradas</strong>
                  <p>Seleccioná los sectores que participan.</p>
                </span>
              </div>
              <div>
                <UserRound />
                <span>
                  <strong>Responsable</strong>
                  <p>
                    Puede ser cualquier responsable, independientemente del
                    área.
                  </p>
                </span>
              </div>
              <div>
                <Target />
                <span>
                  <strong>Impacto</strong>
                  <p>
                    Describí las consecuencias. La urgencia se expresa en la
                    prioridad.
                  </p>
                </span>
              </div>
            </aside>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Guardando…" : topic ? "Guardar cambios" : "Crear tema"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
