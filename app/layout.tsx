import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agro-Gestão Mogi",
  description:
    "Gestão agrícola simples e inteligente para os produtores do Cinturão Verde de Mogi das Cruzes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
