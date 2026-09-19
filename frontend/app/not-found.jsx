import Link from "next/link";
export default function NotFound() {
  return (
    <main className="connection-screen">
      <h1>Página no encontrada</h1>
      <p>La dirección solicitada no está disponible.</p>
      <Link className="button primary" href="/tablero">
        Volver al tablero
      </Link>
    </main>
  );
}
