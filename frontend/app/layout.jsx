import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
export const metadata = {
  title: "Temas institucionales | Santa Clara de Asís",
  description:
    "Seguimiento institucional del Hospital Privado Santa Clara de Asís",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
