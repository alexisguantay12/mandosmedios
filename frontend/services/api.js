const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
).replace(/\/$/, "");
let csrfToken = null;

export class ApiError extends Error {
  constructor(status, data) {
    const message =
      typeof data === "object"
        ? Object.entries(data)
            .map(
              ([key, value]) =>
                `${key === "detail" ? "" : key + ": "}${Array.isArray(value) ? value.join(" ") : value}`,
            )
            .join(" ")
        : "No se pudo completar la solicitud.";
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function csrf() {
  const data = await api("/auth/csrf/");
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function api(path, options = {}) {
  const method = options.method || "GET";
  const mutates = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (mutates && !csrfToken) await csrf();

  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: mutates
        ? {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          }
        : {},
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    if (response.status === 204) return null;
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error("El servidor devolvió una respuesta inesperada.");
    }
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("session-expired"));
    }
    if (!response.ok) throw new ApiError(response.status, data);
    if (data.csrfToken) csrfToken = data.csrfToken;
    return data;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new Error(
        mutates
          ? "El servidor demoró demasiado. Recargá el tema para comprobar si se guardó antes de reenviar el cambio."
          : "El servidor demoró demasiado. Intentá nuevamente.",
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "No se pudo conectar con el servidor. Verificá la conexión e intentá nuevamente.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export function queryString(values) {
  return new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== "" && value != null),
  ).toString();
}

export const adminUrl = BASE_URL.replace(/\/api$/, "") + "/admin/";
