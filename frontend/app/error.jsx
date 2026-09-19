"use client";
export default function ErrorPage({ reset }) {
  return (
    <main className="connection-screen">
      <h1>No pudimos cargar esta pantalla</h1>
      <p>
        Intentá nuevamente. Si el problema continúa, comunicate con Sistemas.
      </p>
      <button className="button primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
