import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppProvider } from "@/context/AppContext";
import { IdentidadProvider } from "@/context/IdentidadContext";
import AvisoNovedades from "@/components/AvisoNovedades";

export const metadata: Metadata = {
  title: "Casaciones Judiciales del Peru",
  description: "Sistema de consulta de casaciones publicadas en El Peruano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased font-sans">
        <AuthProvider>
          <IdentidadProvider>
            <AppProvider>
              {children}
              <AvisoNovedades />
            </AppProvider>
          </IdentidadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
