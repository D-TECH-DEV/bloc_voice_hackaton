import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blok Voice Backend",
  description: "Backend pour l'agent vocal AethexAI x Blok",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "sans-serif", margin: 0, padding: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
