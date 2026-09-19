"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  MouseSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListFilter,
  MessageSquare,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { api, queryString } from "@/services/api";
import {
  AreaBadge,
  Avatar,
  Empty,
  ErrorMessage,
  formatDate,
  Loading,
  Modal,
  Priority,
  Status,
  useDesktop,
} from "./UI";
import TopicDetail from "./TopicDetail";
import TopicForm from "./TopicForm";

function CardContent({ topic }) {
  return (
    <>
      <div className="card-top">
        <span className="topic-icon">
          <FileText size={20} />
        </span>

        <div>
          <div className="card-id">
            <strong>#{topic.id}</strong>

            <time title="Fecha de creación">
              {formatDate(topic.fecha_creacion)}
            </time>
          </div>

          <h3>{topic.titulo}</h3>
        </div>
      </div>

      <div className="card-meta-row">
        <div className="badges">
          {topic.areas_involucradas.map((a) => (
            <AreaBadge key={a.id} area={a} />
          ))}
        </div>

        <Priority value={topic.prioridad} />
      </div>

      <div className="card-footer">
        <span className="person">
          <Avatar name={topic.responsable?.nombre} small />

          <span>
            {topic.responsable?.nombre || "Sin asignar"}
          </span>
        </span>

        <span className="comment-count" title="Comentarios">
          <MessageSquare size={14} />
          {topic.total_comentarios || 0}
        </span>
      </div>
    </>
  );
}

function TopicCard({
  topic,
  onOpen,
  desktop,
  suppressClick,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: topic.id,
    data: { topic },
    disabled: !desktop,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      aria-disabled={false}
      tabIndex={0}
      aria-label={`Abrir tema ${topic.id}: ${topic.titulo}`}
      className={`topic-card ${isDragging ? "dragging" : ""}`}
      onClick={() => {
        if (Date.now() > suppressClick.current) {
          onOpen(topic.id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(topic.id);
        }
      }}
    >
      <CardContent topic={topic} />
    </div>
  );
}

function Column({
  column,
  onOpen,
  desktop,
  selected,
  filters,
  suppressClick,
}) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: `state-${column.estado.id}`,
    data: {
      state: column.estado,
    },
    disabled: !desktop || !column.estado.activo,
  });

  const tone = column.estado.es_resuelto
    ? "resolved"
    : column.estado.es_inicial
      ? "new"
      : "progress";

  const Icon = column.estado.es_resuelto
    ? Check
    : column.estado.es_inicial
      ? FileText
      : RotateCw;

  const remaining =
    column.cantidad - column.temas.length;

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${tone} ${
        isOver ? "drop-target" : ""
      } ${
        selected ? "mobile-selected" : ""
      }`}
      aria-label={`Columna ${column.estado.nombre}`}
    >
      <header>
        <Icon size={20} />

        <h2>{column.estado.nombre}</h2>

        <span className="count">
          {column.cantidad}
        </span>
      </header>

      <div className="column-cards">
        {column.temas.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onOpen={onOpen}
            desktop={desktop}
            suppressClick={suppressClick}
          />
        ))}

        {!column.temas.length && (
          <div className="column-empty">
            {column.estado.es_resuelto
              ? "Los temas resueltos aparecerán aquí."
              : "Sin temas en este estado."}
          </div>
        )}
      </div>

      {(remaining > 0 || column.estado.es_resuelto) && (
        <Link
          className="column-more"
          href={`/temas?${queryString({
            ...filters,
            estado: column.estado.id,
            ...(column.estado.es_resuelto
              ? { resueltos: "1" }
              : {}),
          })}`}
        >
          {column.estado.es_resuelto
            ? "Ver todos los temas resueltos"
            : "Ver todos los temas"}

          {remaining > 0 && (
            <span>{remaining} más</span>
          )}

          <ChevronRight size={15} />
        </Link>
      )}
    </section>
  );
}

export default function TopicWorkspace({
  mode = "board",
}) {
  const router = useRouter();
  const params = useSearchParams();
  const desktop = useDesktop();

  const [filters, setFilters] = useState({
    buscar: params.get("buscar") || "",
    origen: params.get("origen") || "",
    area: params.get("area") || "",
    responsable: params.get("responsable") || "",
    prioridad: params.get("prioridad") || "",
    estado: params.get("estado") || "",
    resueltos: params.get("resueltos") || "",
  });

  const [search, setSearch] = useState(
    filters.buscar,
  );

  const [masters, setMasters] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [drag, setDrag] = useState(null);
  const [notice, setNotice] = useState("");

  const suppressClick = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 7,
      },
    }),
  );

  const refresh = useCallback(
    () => setRevision((v) => v + 1),
    [],
  );

  useEffect(() => {
    if (search === filters.buscar) {
      return;
    }

    const timer = setTimeout(() => {
      setPage(1);

      setFilters((f) => ({
        ...f,
        buscar: search,
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, filters.buscar]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api("/areas/", {
        signal: controller.signal,
      }),

      api("/responsables/", {
        signal: controller.signal,
      }),

      api("/estados/", {
        signal: controller.signal,
      }),
    ])
      .then(
        ([
          areas,
          responsables,
          estados,
        ]) => {
          setMasters({
            areas,
            responsables,
            estados,
          });
        },
      )
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      });

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    const endpoint =
      mode === "board"
        ? "/temas/tablero/"
        : mode === "mine"
          ? "/temas/mis-temas/"
          : "/temas/";

    api(
      `${endpoint}?${queryString({
        ...filters,
        page,
      })}`,
      {
        signal: controller.signal,
      },
    )
      .then((result) => {
        setData(result);

        if (mode === "board") {
          setSelected(
            (current) =>
              current ??
              result[0]?.estado.id,
          );
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    filters,
    page,
    mode,
    revision,
  ]);

  function filter(event) {
    setPage(1);

    setFilters((f) => ({
      ...f,
      [event.target.name]:
        event.target.value,
    }));
  }

  function open(id) {
    desktop
      ? setModal(id)
      : router.push(
          id === "new"
            ? "/temas/nuevo"
            : `/temas/${id}`,
        );
  }

  async function drop(event) {
    suppressClick.current =
      Date.now() + 300;

    setDrag(null);

    const topic =
      event.active.data.current.topic;

    const state =
      event.over?.data.current?.state;

    if (
      !state ||
      topic.estado.id === state.id ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/temas/${topic.id}/cambiar-estado/`,
        {
          method: "POST",
          body: {
            estado: state.id,
            version: topic.version,
          },
        },
      );

      setNotice(
        `Tema #${topic.id} movido a ${state.nombre}.`,
      );

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "mine"
      ? "Mis temas"
      : mode === "list"
        ? filters.resueltos === "1"
          ? "Temas resueltos"
          : "Todos los temas"
        : "Tablero de temas";

  return (
    <>
      <header className="workspace-heading">
        <div>
          <div className="eyebrow">
            MANDOS MEDIOS
          </div>

          <h1>{title}</h1>

          <p>
            {mode === "mine"
              ? "Consultá y seguí los temas que creaste."
              : "Seguimiento de temas y acciones institucionales."}
          </p>
        </div>

        <div className="workspace-actions">
          <label className="search-box">
            <Search size={19} />

            <input
              aria-label="Buscar temas"
              placeholder="Buscar por título, descripción o número…"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </label>

          <button
            className="button primary"
            onClick={() => open("new")}
          >
            <Plus size={19} />
            Nuevo tema
          </button>
        </div>
      </header>

      <section
        className="filters"
        aria-label="Filtros de temas"
      >
        <label>
          Área de origen

          <select
            name="origen"
            value={filters.origen}
            onChange={filter}
          >
            <option value="">
              Todas
            </option>

            {masters?.areas.map((a) => (
              <option
                value={a.id}
                key={a.id}
              >
                {a.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Área involucrada

          <select
            name="area"
            value={filters.area}
            onChange={filter}
          >
            <option value="">
              Todas
            </option>

            {masters?.areas.map((a) => (
              <option
                value={a.id}
                key={a.id}
              >
                {a.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Responsable

          <select
            name="responsable"
            value={
              filters.responsable
            }
            onChange={filter}
          >
            <option value="">
              Todos
            </option>

            {masters?.responsables.map(
              (a) => (
                <option
                  value={a.id}
                  key={a.id}
                >
                  {a.nombre}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          Prioridad

          <select
            name="prioridad"
            value={filters.prioridad}
            onChange={filter}
          >
            <option value="">
              Todas
            </option>

            <option value="alta">
              Alta
            </option>

            <option value="media">
              Media
            </option>

            <option value="baja">
              Baja
            </option>
          </select>
        </label>

        {mode !== "board" && (
          <label>
            Estado

            <select
              name="estado"
              value={filters.estado}
              onChange={filter}
            >
              <option value="">
                Todos
              </option>

              {masters?.estados.map(
                (s) => (
                  <option
                    value={s.id}
                    key={s.id}
                  >
                    {s.nombre}
                  </option>
                ),
              )}
            </select>
          </label>
        )}

        <button
          className="button filter-reset"
          onClick={() => {
            setSearch("");
            setPage(1);

            setFilters({
              buscar: "",
              origen: "",
              area: "",
              responsable: "",
              prioridad: "",
              estado: "",
              resueltos:
                mode === "list"
                  ? filters.resueltos
                  : "",
            });
          }}
        >
          <ListFilter size={17} />
          Limpiar filtros
        </button>
      </section>

      <ErrorMessage
        message={error}
        onRetry={refresh}
      />

      <div
        className="sr-only"
        role="status"
      >
        {notice}
      </div>

      {busy && (
        <div
          className="saving-banner"
          role="status"
        >
          Guardando cambio de estado…
        </div>
      )}

      {loading ? (
        <Loading />
      ) : data &&
        mode === "board" ? (
        <>
          <div
            className="mobile-status-tabs"
            aria-label="Estados del tablero"
          >
            {data.map((column) => (
              <button
                key={column.estado.id}
                className={
                  selected ===
                  column.estado.id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setSelected(
                    column.estado.id,
                  )
                }
              >
                {column.estado.nombre}

                <span>
                  {column.cantidad}
                </span>
              </button>
            ))}
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={(event) => {
              setDrag(
                event.active.data.current
                  .topic,
              );

              suppressClick.current =
                Infinity;
            }}
            onDragEnd={drop}
            onDragCancel={() => {
              setDrag(null);

              suppressClick.current =
                Date.now() + 300;
            }}
          >
            <div className="kanban-board">
              {data.map((column) => (
                <Column
                  key={column.estado.id}
                  column={column}
                  onOpen={open}
                  desktop={
                    desktop && !busy
                  }
                  selected={
                    selected ===
                    column.estado.id
                  }
                  filters={filters}
                  suppressClick={
                    suppressClick
                  }
                />
              ))}
            </div>

            <DragOverlay>
              {drag && (
                <div className="topic-card drag-overlay">
                  <CardContent
                    topic={drag}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <p className="board-hint">
            {desktop
              ? "Abrí una tarjeta para ver el detalle. Arrastrala a otra columna para cambiar su estado."
              : "Tocá una tarjeta para ver el detalle y actualizar su estado."}
          </p>
        </>
      ) : (
        data && (
          <>
            <div className="list-summary">
              {data.count}{" "}
              {data.count === 1
                ? "tema encontrado"
                : "temas encontrados"}
            </div>

            {!data.results.length ? (
              <Empty text="Probá con otros filtros o registrá un nuevo tema." />
            ) : (
              <div className="topic-list">
                {data.results.map(
                  (topic) => (
                    <button
                      className="list-row"
                      key={topic.id}
                      onClick={() =>
                        open(topic.id)
                      }
                    >
                      <span className="topic-icon">
                        <FileText
                          size={22}
                        />
                      </span>

                      <span className="list-title">
                        <small>
                          #{topic.id} ·{" "}
                          {topic.tipo.nombre}
                        </small>

                        <strong>
                          {topic.titulo}
                        </strong>

                        <span className="muted">
                          {
                            topic
                              .area_origen
                              .nombre
                          }{" "}
                          ·{" "}
                          {topic
                            .responsable
                            ?.nombre ||
                            "Sin asignar"}
                        </span>
                      </span>

                      <Status
                        state={
                          topic.estado
                        }
                      />

                      <Priority
                        value={
                          topic.prioridad
                        }
                      />

                      <time>
                        {formatDate(
                          topic.fecha_creacion,
                        )}
                      </time>

                      <ChevronRight
                        size={17}
                      />
                    </button>
                  ),
                )}
              </div>
            )}

            <div className="pagination">
              <button
                className="button secondary"
                disabled={!data.previous}
                onClick={() =>
                  setPage(
                    (p) => p - 1,
                  )
                }
              >
                <ChevronLeft
                  size={16}
                />
                Anterior
              </button>

              <span>
                Página {page} de{" "}
                {Math.max(
                  1,
                  Math.ceil(
                    data.count / 30,
                  ),
                )}
              </span>

              <button
                className="button secondary"
                disabled={!data.next}
                onClick={() =>
                  setPage(
                    (p) => p + 1,
                  )
                }
              >
                Siguiente
                <ChevronRight
                  size={16}
                />
              </button>
            </div>
          </>
        )
      )}

      {modal && (
        <Modal
          title={
            modal === "new"
              ? "Nuevo tema"
              : "Detalle del tema"
          }
          onClose={() =>
            setModal(null)
          }
          className={
            modal === "new"
              ? "form-modal"
              : "detail-modal"
          }
        >
          {modal === "new" ? (
            <TopicForm
              onCancel={() =>
                setModal(null)
              }
              onSaved={(saved) => {
                refresh();
                setModal(saved.id);
              }}
            />
          ) : (
            <TopicDetail
              id={modal}
              modal
              onChanged={refresh}
            />
          )}
        </Modal>
      )}
    </>
  );
}