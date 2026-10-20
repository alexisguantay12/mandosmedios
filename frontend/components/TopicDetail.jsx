"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  FileText,
  History,
  Lightbulb,
  MessageSquare,
  Pencil,
  Send,
  TrendingUp,
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


const INTERVENTION_TYPES = {
  comentario: {
    label: "Comentario",
    placeholder: "Escribí un comentario...",
    button: "Comentar",
    help: "Registrá una observación o información relacionada con el tema.",
    className: "comment",
    Icon: MessageSquare,
  },

  solucion: {
    label: "Solución propuesta",
    placeholder: "Describí la solución propuesta...",
    button: "Registrar solución",
    help: "Una solución propuesta es una alternativa para abordar el tema.",
    className: "solution",
    Icon: Lightbulb,
  },

  acuerdo: {
    label: "Acuerdo",
    placeholder: "Registrá el acuerdo alcanzado...",
    button: "Registrar acuerdo",
    help: "Registrá una decisión o compromiso concreto.",
    className: "agreement",
    Icon: BadgeCheck,
  },

  seguimiento: {
    label: "Seguimiento",
    placeholder: "Describí el avance o seguimiento...",
    button: "Registrar seguimiento",
    help: "Registrá novedades, avances o acciones realizadas sobre el tema.",
    className: "followup",
    Icon: TrendingUp,
  },
};


function display(value) {
  if (value == null) {
    return "Sin asignar";
  }

  if (typeof value === "object") {
    return value.nombre || JSON.stringify(value);
  }

  return String(value);
}


function Activity({ item }) {
  if (item.tipo_evento === "creacion") {
    return <p>Creó el tema.</p>;
  }

  if (item.tipo_evento === "importacion") {
    return <p>Importó el tema desde el registro histórico.</p>;
  }

  if (item.tipo_evento === "area_agregada") {
    return (
      <p>
        Agregó el área{" "}
        <strong>{display(item.valor_nuevo)}</strong>.
      </p>
    );
  }

  if (item.tipo_evento === "area_quitada") {
    return (
      <p>
        Quitó el área{" "}
        <strong>{display(item.valor_anterior)}</strong>.
      </p>
    );
  }

  return (
    <>
      <p>
        Cambió {fieldLabels[item.campo] || item.campo}.
      </p>

      <div className="change-values">
        <span>{display(item.valor_anterior)}</span>
        <span>→</span>
        <strong>{display(item.valor_nuevo)}</strong>
      </div>
    </>
  );
}


export default function TopicDetail({
  id,
  onBack,
  onChanged,
  modal = false,
}) {
  const [topic, setTopic] = useState(null);

  const [comments, setComments] = useState({
    results: [],
    next: null,
  });

  const [activities, setActivities] = useState({
    results: [],
    next: null,
  });

  const [masters, setMasters] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);

  const [tab, setTab] = useState("comments");

  const [text, setText] = useState("");

  const [commentType, setCommentType] =
    useState("comentario");

  const [busy, setBusy] = useState(false);

  const [stateOpen, setStateOpen] = useState(false);

  const [newState, setNewState] = useState("");


  const intervention =
    INTERVENTION_TYPES[commentType] ||
    INTERVENTION_TYPES.comentario;

  const InterventionIcon = intervention.Icon;

  const timeline =
    tab === "comments"
      ? comments
      : activities;

  const commentCount =
    topic?.total_comentarios ??
    comments.results.length;


  async function load() {
    setError("");

    try {
      const [
        detail,
        commentPage,
        activityPage,
        states,
      ] = await Promise.all([
        api(`/temas/${id}/`),
        api(`/temas/${id}/comentarios/`),
        api(`/temas/${id}/actividad/`),
        api("/estados/"),
      ]);

      setTopic(detail);
      setComments(commentPage);
      setActivities(activityPage);
      setMasters(states);

      setNewState(
        String(detail.estado.id),
      );
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
    const data =
      kind === "comments"
        ? comments
        : activities;

    if (!data.next || busy) {
      return;
    }

    setBusy(true);

    try {
      const page = new URL(
        data.next,
      ).searchParams.get("page");

      const result = await api(
        `/temas/${id}/${
          kind === "comments"
            ? "comentarios"
            : "actividad"
        }/?page=${page}`,
      );

      const setter =
        kind === "comments"
          ? setComments
          : setActivities;

      setter((current) => ({
        ...result,

        results: [
          ...new Map(
            [
              ...current.results,
              ...result.results,
            ].map((item) => [
              item.id,
              item,
            ]),
          ).values(),
        ].sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) ||
            a.id - b.id,
        ),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }


  async function comment(event) {
    event.preventDefault();

    const cleanText = text.trim();

    if (!cleanText || busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const created = await api(
        `/temas/${id}/comentarios/`,
        {
          method: "POST",

          body: {
            texto: cleanText,
            tipo: commentType,
          },
        },
      );

      setText("");
      setCommentType("comentario");

      setComments((current) => ({
        ...current,

        results: [
          ...current.results,
          created,
        ],
      }));

      const detail = await api(
        `/temas/${id}/`,
      );

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
      const detail = await api(
        `/temas/${id}/cambiar-estado/`,
        {
          method: "POST",

          body: {
            estado: Number(newState),
            version: topic.version,
          },
        },
      );

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


  if (loading) {
    return <Loading />;
  }


  if (!topic) {
    return (
      <ErrorMessage
        message={error}
        onRetry={load}
      />
    );
  }


  if (editing) {
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
  }


  return (
    <article
      className={`topic-detail ${
        modal ? "in-modal" : ""
      }`}
    >
      {/* =====================================================
          TOOLBAR
          ===================================================== */}

      <div className="detail-toolbar">
        {!modal && (
          <button
            className="button ghost"
            onClick={onBack}
          >
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


      <ErrorMessage
        message={error}
        onRetry={load}
      />


      <div className="detail-layout">

        {/* ===================================================
            PANEL IZQUIERDO
            =================================================== */}

        <section className="detail-main">

          <div className="detail-title">

            <span className="topic-icon large">
              <FileText size={30} />
            </span>

            <div>
              <span className="eyebrow">
                TEMA #{topic.id} ·{" "}
                {topic.tipo.nombre}
              </span>

              <h1>
                {topic.titulo}
              </h1>

              <p className="muted">
                Creado por{" "}
                {topic.creador.nombre}
                {" · "}
                {formatDate(
                  topic.fecha_creacion,
                  true,
                )}
              </p>
            </div>

            <Priority
              value={topic.prioridad}
            />

          </div>


          <div className="badges">
            {topic.areas_involucradas.map(
              (area) => (
                <AreaBadge
                  key={area.id}
                  area={area}
                />
              ),
            )}
          </div>


          <section className="text-section">
            <h2>Descripción</h2>

            <p>{topic.descripcion}</p>
          </section>


          <section className="text-section">
            <h2>Impacto</h2>

            <p>
              {topic.impacto ||
                "No se especificó el impacto."}
            </p>
          </section>


          <dl className="metadata">

            <div>
              <dt>Área de origen</dt>

              <dd>
                <AreaBadge
                  area={topic.area_origen}
                />
              </dd>
            </div>


            <div>
              <dt>Prioridad</dt>

              <dd>
                <Priority
                  value={topic.prioridad}
                />
              </dd>
            </div>


            <div>
              <dt>Responsable</dt>

              <dd className="person">
                <Avatar
                  name={
                    topic.responsable?.nombre
                  }
                  small
                />

                {topic.responsable?.nombre ||
                  "Sin asignar"}
              </dd>
            </div>


            <div>
              <dt>Estado</dt>

              <dd>
                <Status
                  state={topic.estado}
                />
              </dd>
            </div>


            <div>
              <dt>Áreas involucradas</dt>

              <dd className="badges">
                {topic.areas_involucradas.length
                  ? topic.areas_involucradas.map(
                      (area) => (
                        <AreaBadge
                          key={area.id}
                          area={area}
                        />
                      ),
                    )
                  : "Sin áreas adicionales"}
              </dd>
            </div>


            <div>
              <dt>Fecha de creación</dt>

              <dd>
                {formatDate(
                  topic.fecha_creacion,
                  true,
                )}
              </dd>
            </div>


            <div>
              <dt>Última actualización</dt>

              <dd>
                {formatDate(
                  topic.fecha_actualizacion,
                  true,
                )}
              </dd>
            </div>


            <div>
              <dt>Creador</dt>

              <dd>
                {topic.creador.nombre}
              </dd>
            </div>


            {topic.fecha_limite && (
              <div>
                <dt>Fecha límite</dt>

                <dd>
                  {formatDate(
                    topic.fecha_limite,
                  )}
                </dd>
              </div>
            )}


            {topic.estado.es_resuelto && (
              <div>
                <dt>Fecha de resolución</dt>

                <dd>
                  {formatDate(
                    topic.fecha_resolucion,
                    true,
                  )}
                </dd>
              </div>
            )}

          </dl>


          {/* =================================================
              CAMBIO DE ESTADO
              ================================================= */}

          <div className="state-change">

            <button
              className="button primary"
              onClick={() => {
                setStateOpen(
                  !stateOpen,
                );

                setNewState(
                  String(
                    topic.estado.id,
                  ),
                );
              }}
            >
              <ArrowRightLeft size={17} />
              Cambiar estado
            </button>


            {stateOpen && (
              <form
                className="state-panel"
                onSubmit={changeState}
              >

                <label>
                  Nuevo estado

                  <select
                    value={newState}
                    onChange={(e) =>
                      setNewState(
                        e.target.value,
                      )
                    }
                  >
                    {masters
                      .filter(
                        (state) =>
                          state.activo,
                      )
                      .map((state) => (
                        <option
                          value={state.id}
                          key={state.id}
                        >
                          {state.nombre}
                        </option>
                      ))}
                  </select>
                </label>


                <div className="button-row">

                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setStateOpen(false)
                    }
                  >
                    Cancelar
                  </button>


                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      Number(newState) ===
                        topic.estado.id
                    }
                  >
                    {busy
                      ? "Guardando…"
                      : "Confirmar estado"}
                  </button>

                </div>

              </form>
            )}

          </div>

        </section>


        {/* ===================================================
            PANEL DERECHO
            =================================================== */}

        <aside className="discussion">

          {/* TABS */}

          <div
            className="discussion-tabs"
            role="tablist"
            aria-label="Seguimiento del tema"
          >

            <button
              type="button"
              role="tab"
              aria-selected={
                tab === "comments"
              }
              className={
                tab === "comments"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab("comments")
              }
            >
              <MessageSquare size={16} />

              Comentarios

              {commentCount > 0 && (
                <span className="tab-count">
                  {commentCount}
                </span>
              )}
            </button>


            <button
              type="button"
              role="tab"
              aria-selected={
                tab === "activity"
              }
              className={
                tab === "activity"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab("activity")
              }
            >
              <History size={16} />
              Actividad
            </button>

          </div>


          {/* =================================================
              NUEVA INTERVENCIÓN
              ================================================= */}

          {tab === "comments" && (
            <form
              className="comment-composer"
              onSubmit={comment}
            >

              <div className="comment-composer-title">
                Agregar comentario
              </div>


              <div className="comment-type-grid">

                <label className="comment-type-select">
                  <span>
                    Tipo de intervención
                  </span>

                  <select
                    value={commentType}
                    onChange={(e) =>
                      setCommentType(
                        e.target.value,
                      )
                    }
                  >
                    <option value="comentario">
                      Comentario
                    </option>

                    <option value="solucion">
                      Solución propuesta
                    </option>

                    <option value="acuerdo">
                      Acuerdo
                    </option>

                    <option value="seguimiento">
                      Seguimiento
                    </option>
                  </select>
                </label>


                <div
                  className={`comment-type-help ${intervention.className}`}
                >
                  <InterventionIcon
                    size={16}
                  />

                  <span>
                    {intervention.help}
                  </span>
                </div>

              </div>


              <div className="comment-textarea-box">

                <textarea
                  id={`comment-${id}`}
                  placeholder={
                    intervention.placeholder
                  }
                  maxLength={10000}
                  rows={4}
                  value={text}
                  onChange={(e) =>
                    setText(
                      e.target.value,
                    )
                  }
                  required
                />

                <span className="comment-counter">
                  {text.length}/10000
                </span>

              </div>


              <div className="comment-composer-footer">

                <span className="comment-author-help">
                  Quedará registrado quién carga la intervención.
                </span>


                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !text.trim()
                  }
                >
                  <Send size={16} />

                  {busy
                    ? "Guardando…"
                    : intervention.button}
                </button>

              </div>

            </form>
          )}


          {/* =================================================
              HISTORIAL
              ================================================= */}

          <div
            className="detail-timeline"
            role="tabpanel"
          >

            {timeline.results.map(
              (item) => {

                const itemType =
                  INTERVENTION_TYPES[
                    item.tipo
                  ] ||
                  INTERVENTION_TYPES.comentario;

                const ItemIcon =
                  itemType.Icon;


                return (
                  <div
                    className="detail-timeline-item"
                    key={item.id}
                  >

                    <Avatar
                      name={
                        item.usuario.nombre
                      }
                      small
                    />


                    <div className="detail-timeline-content">

                      <div className="detail-timeline-header">

                        <div className="detail-timeline-user">

                          <strong>
                            {item.usuario.nombre}
                          </strong>

                          <div className="detail-timeline-meta">

                            <time>
                              {formatDate(
                                item.fecha,
                                true,
                              )}
                            </time>


                            {tab ===
                              "comments" && (
                              <>
                                <span>
                                  ·
                                </span>

                                <span>
                                  {item.tipo_display ||
                                    itemType.label}
                                </span>
                              </>
                            )}

                          </div>

                        </div>


                        {tab === "comments" && (
                          <span
                            className={`comment-type-badge ${itemType.className}`}
                          >
                            <ItemIcon
                              size={13}
                            />

                            {item.tipo_display ||
                              itemType.label}
                          </span>
                        )}

                      </div>


                      {tab === "comments" ? (
                        <>

                          <p>
                            {item.texto}
                          </p>


                          {item.es_historico && (
                            <small className="historical-label">
                              Registro histórico · cargado por importación
                            </small>
                          )}

                        </>
                      ) : (
                        <Activity
                          item={item}
                        />
                      )}

                    </div>

                  </div>
                );
              },
            )}


            {!timeline.results.length && (
              <div className="detail-timeline-empty">

                {tab === "comments" ? (
                  <>
                    <MessageSquare
                      size={27}
                    />

                    <strong>
                      Todavía no hay intervenciones
                    </strong>

                    <span>
                      Registrá el primer comentario,
                      solución, acuerdo o seguimiento.
                    </span>
                  </>
                ) : (
                  <>
                    <History
                      size={27}
                    />

                    <strong>
                      No hay actividad registrada
                    </strong>
                  </>
                )}

              </div>
            )}

          </div>


          {timeline.next && (
            <button
              type="button"
              className="button secondary full-width"
              onClick={() =>
                more(tab)
              }
              disabled={busy}
            >
              Ver más{" "}
              {tab === "comments"
                ? "comentarios"
                : "actividad"}
            </button>
          )}

        </aside>

      </div>
    </article>
  );
}