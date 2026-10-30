import type { ReactNode } from "react";
import "./globals.css";
import { callBackend } from "@/lib/backend";

export const metadata = { title: "BLOK Relance — Suivi interne" };

async function ModeBanner() {
  const health = await callBackend<{ mode?: string; mock_core?: boolean }>(
    "/health",
  );
  const mode = health.ok ? (health.data.mode ?? "?") : "backend injoignable";
  const mock = health.ok && health.data.mock_core ? " · Core en mode secours (fixtures)" : "";
  return (
    <div className="modebanner" role="status">
      Mode <strong>{mode}</strong> — aucun appel commercial automatique{mock}. Fournisseur vocal : non validé.
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav className="topbar">
          <span className="brand">BLOK Relance — suivi interne</span>
          <a href="/">Tableau de bord</a>
          <a href="/taches">Tâches</a>
          <a href="/transferts">Transferts</a>
          <a href="/decisions">Décisions</a>
          <a href="/consents">Consentements</a>
          <a href="/conversation">Conversation</a>
          <a href="/vocale">Voix ESTHER</a>
        </nav>
        <ModeBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
