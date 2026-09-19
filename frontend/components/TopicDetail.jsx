"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  FileText,
  MessageSquare,
  Pencil,
  Send,
  History,
} from "lucide-react";
import { api } from "@/services/api";
import {
  AreaBadge,
  Avatar,
  ErrorMessage,
  formatDate,
  Loading,
  Priority,
  Status,
} from "./UI";
import TopicForm from "./TopicForm";

const fieldLabels = {
  titulo: "título",
  tipo: "tipo de tema",
  descripcion: "descripción",
  impacto: "impacto",
  prioridad: "prioridad",
  responsable: "responsable",
  area_origen: "área de origen",
  estado: "estado",
};
function display(value) {
  if (value == null) return "Sin asignar";
  if (typeof value === "object") return value.nombre || JSON.stringify(value);
  return String(value);
}
function Activity({ item }) {
  if (item.tipo_evento === "creacion") return <p>Creó el tema.</p>;
  if (item.tipo_evento === "importacion")
    return <p>Importó el tema desde el registro histórico.</p>;
  if (item.tipo_evento === "area_agregada")
    return (
      <p>
        Agregó el área <strong>{display(item.valor_nuevo)}</strong>.
      </p>
    );
  if (item.tipo_evento === "area_quitada")
    return (
      <p>
        Quitó el área <strong>{display(item.valor_anterior)}</strong>.
      </p>
    );
  return (
    <>
      <p>Cambió {fieldLabels[item.campo] || item.campo}.</p>
      <div className="change-values">
        <span>{display(item.valor_anterior)}</span>
        <span aria-label="a">→</span>
        <strong>{display(item.valor_nuevo)}</strong>
      </div>
    </>
  );
}

export default function TopicDetail({ id, onBack, onChanged, modal = false }) {
  const [topic, setTopic] = useState(null);
  const [comments, setComments] = useState({ results: [], next: null });
  const [activities, setActivities] = useState({ results: [], next: null });
  const [masters, setMasters] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("comments");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [newState, setNewState] = useState("");
  async function load() {
    setError("");
    try {
      const [detail, commentPage, activityPage, states] = await Promise.all([
        api(`/temas/${id}/`),
        api(`/temas/${id}/comentarios/`),
        api(`/temas/${id}/actividad/`),
        api("/estados/"),
      ]);
      setTopic(detail);
      setComments(commentPage);
      setActivities(activityPage);
      setMasters(states);
      setNewState(String(detail.estado.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  async function more(kind) {
    const data = kind === "comments" ? comments : activities;
    if (!data.next || busy) return;
    setBusy(true);
    try {
      const page = new URL(data.next).searchParams.get("page");
      const result = await api(
        `/temas/${id}/${kind === "comments" ? "comentarios" : "actividad"}/?page=${page}`,
      );
      const setter = kind === "comments" ? setComments : setActivities;
      setter((current) => ({
        ...result,
        results: [
          ...new Map(
            [...current.results, ...result.results].map((item) => [
              item.id,
              item,
            ]),
          ).values(),
        ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function comment(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api(`/temas/${id}/comentarios/`, {
        method: "POST",
        body: { texto: text },
      });
      setText("");
      // Mantener todo lo cargado; no volver a la primera página de comentarios.
      setComments((current) => ({
        ...current,
        results: [...current.results, created],
      }));
      const detail = await api(`/temas/${id}/`);
      setTopic(detail);
      onChanged?.(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeState(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const detail = await api(`/temas/${id}/cambiar-estado/`, {
        method: "POST",
        body: { estado: Number(newState), version: topic.version },
      });
      setTopic(detail);
      setStateOpen(false);
      onChanged?.(detail);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!topic) return <ErrorMessage message={error} onRetry={load} />;
  if (editing)
    return (
      <TopicForm
        topic={topic}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          setTopic(saved);
          load();
          onChanged?.(saved);
        }}
      />
    );
  const timeline = tab === "comments" ? comments : activities;
  return (
    <article className={`topic-detail ${modal ? "in-modal" : ""}`}>
      <div className="detail-toolbar">
        {!modal && (
          <button className="button ghost" onClick={onBack}>
            <ArrowLeft size={17} />
            Volver
          </button>
        )}
        <Status state={topic.estado} />
        <button
          className="button secondary small-button"
          onClick={() => setEditing(true)}
        >
          <Pencil size={15} />
          Editar tema
        </button>
      </div>
      <ErrorMessage message={error} onRetry={load} />
      <div className="detail-layout">
        <section className="detail-main">
          <div className="detail-title">
            <span className="topic-icon large">
              <FileText size={30} />
            </span>
            <div>
              <span className="eyebrow">
                TEMA #{topic.id} · {topic.tipo.nombre}
              </span>
              <h1>{topic.titulo}</h1>
              <p className="muted">Creado por {topic.creador.nombre}</p>
            </div>
            <Priority value={topic.prioridad} />
          </div>
          <div className="badges">
            {topic.areas_involucradas.map((area) => (
              <AreaBadge key={area.id} area={area} />
            ))}
          </div>
          <section className="text-section">
            <h2>Descripción</h2>
            <p>{topic.descripcion}</p>
          </section>
          <section className="text-section">
            <h2>Impacto</h2>
            <p>{topic.impacto || "No se especificó el impacto."}</p>
          </section>
          <dl className="metadata">
            <div>
              <dt>Área de origen</dt>
              <dd>
                <AreaBadge area={topic.area_origen} />
              </dd>
            </div>
            <div>
              <dt>Prioridad</dt>
              <dd>
                <Priority value={topic.prioridad} />
              </dd>
            </div>
            <div>
              <dt>Áreas involucradas</dt>
              <dd className="badges">
                {topic.areas_involucradas.length
                  ? topic.areas_involucradas.map((a) => (
                      <AreaBadge key={a.id} area={a} />
                    ))
                  : "Sin áreas adicionales"}
              </dd>
            </div>
            <div>
              <dt>Fecha de creación</dt>
              <dd>{formatDate(topic.fecha_creacion, true)}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd className="person">
                <Avatar name={topic.responsable?.nombre} small />
                {topic.responsable?.nombre || "Sin asignar"}
              </dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd>{formatDate(topic.fecha_actualizacion, true)}</dd>
            </div>
            <div>
              <dt>Creador</dt>
              <dd>{topic.creador.nombre}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <Status state={topic.estado} />
              </dd>
            </div>
            {topic.estado.es_resuelto && (
              <div>
                <dt>Fecha de resolución</dt>
                <dd>{formatDate(topic.fecha_resolucion, true)}</dd>
              </div>
            )}
          </dl>
          <div className="state-change">
            <button
              className="button primary"
              onClick={() => {
                setStateOpen(!stateOpen);
                setNewState(String(topic.estado.id));
              }}
            >
              <ArrowRightLeft size={17} />
              Cambiar estado
            </button>
            {stateOpen && (
              <form className="state-panel" onSubmit={changeState}>
                <label>
                  Nuevo estado
                  <select
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                  >
                    {masters
                      .filter((s) => s.activo)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="button-row">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setStateOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || Number(newState) === topic.estado.id}
                  >
                    {busy ? "Guardando…" : "Confirmar estado"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
        <aside className="discussion">
          <div
            className="discussion-tabs"
            role="tablist"
            aria-label="Seguimiento del tema"
          >
            <button
              role="tab"
              aria-selected={tab === "comments"}
              className={tab === "comments" ? "active" : ""}
              onClick={() => setTab("comments")}
            >
              <MessageSquare size={16} />
              Comentarios
            </button>
            <button
              role="tab"
              aria-selected={tab === "activity"}
              className={tab === "activity" ? "active" : ""}
              onClick={() => setTab("activity")}
            >
              <History size={16} />
              Actividad
            </button>
          </div>
          {tab === "comments" && (
            <form className="comment-form" onSubmit={comment}>
              <label className="sr-only" htmlFor={`comment-${id}`}>
                Comentario
              </label>
              <textarea
                id={`comment-${id}`}
                placeholder="Escribí un comentario…"
                maxLength={10000}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
              <button
                className="button primary"
                disabled={busy || !text.trim()}
              >
                <Send size={16} />
                {busy ? "Enviando…" : "Comentar"}
              </button>
              <small>Quedará registrado quién carga el comentario.</small>
            </form>
          )}
          <div className="timeline" role="tabpanel">
            {timeline.results.map((item) => (
              <div className="timeline-item" key={item.id}>
                <Avatar name={item.usuario.nombre} small />
                <div>
                  <strong>{item.usuario.nombre}</strong>
                  <time>{formatDate(item.fecha, true)}</time>
                  {tab === "comments" ? (
                    <>
                      <p>{item.texto}</p>
                      {item.es_historico && (
                        <small className="historical-label">
                          Comentario histórico · cargado por importación
                        </small>
                      )}
                    </>
                  ) : (
                    <Activity item={item} />
                  )}
                </div>
              </div>
            ))}
            {!timeline.results.length && (
              <p className="timeline-empty">
                {tab === "comments"
                  ? "Todavía no hay comentarios. Agregá el primer seguimiento."
                  : "No hay actividad registrada."}
              </p>
            )}
          </div>
          {timeline.next && (
            <button
              className="button secondary full-width"
              onClick={() => more(tab)}
              disabled={busy}
            >
              Ver más {tab === "comments" ? "comentarios" : "actividad"}
            </button>
          )}
        </aside>
      </div>
    </article>
  );
}
