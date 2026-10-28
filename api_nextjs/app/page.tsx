import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blok Voice Backend - AethexAI",
  description: "Backend API pour l'agent vocal commercial Blok",
};

export default function HomePage() {
  const tools = [
    {
      name: "1. Rechercher un produit",
      route: "POST /api/rechercher-produit",
      desc: "Trouve les matériaux, prix (FCFA), unités et disponibilités dans le catalogue Blok.",
      input: '{ "terme": "ciment" }'
    },
    {
      name: "2. Vérifier un client",
      route: "POST /api/verifier-client",
      desc: "Identifie l'artisan par son téléphone ou nom, statut de compte et dernière commande.",
      input: '{ "telephone": "+2250707070102" }'
    },
    {
      name: "3. Préparer un devis",
      route: "POST /api/preparer-devis",
      desc: "Calcule le montant estimé et génère la référence de devis sans écriture risquée.",
      input: '{ "articles": [{ "designation": "Ciment Bélier", "quantite": 50, "prix_unitaire": 4800 }] }'
    },
    {
      name: "4. Proposer un produit absent",
      route: "POST /api/proposer-produit-absent",
      desc: "Enregistre un besoin d'article hors catalogue avec le statut \"à valider\".",
      input: '{ "designation": "Brique réfractaire", "unite": "brique", "quantite_estimee": 200 }'
    }
  ];

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ borderBottom: "2px solid #e5e7eb", paddingBottom: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, color: "#111827", fontSize: "1.85rem" }}>Blok Africa × AethexAI Voice Backend</h1>
            <p style={{ color: "#059669", fontWeight: 600, margin: "0.5rem 0 0" }}>
              ● Statut : Serveur Actif et Opérationnel
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a
              href="/docs"
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
              }}
            >
              📖 Ouvrir Swagger UI (/docs)
            </a>
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              style={{
                backgroundColor: "#f3f4f6",
                color: "#1f2937",
                border: "1px solid #d1d5db",
                padding: "10px 14px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.95rem",
              }}
            >
              { } Schéma openapi.json
            </a>
          </div>
        </div>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", color: "#374151" }}>Règles de sécurité & Intégration</h2>
        <ul style={{ color: "#4b5563", lineHeight: 1.6 }}>
          <li><strong>En-tête requis :</strong> <code>x-agent-secret: dev-secret-12345</code></li>
          <li><strong>Délai maximal (Timeout) :</strong> 8 secondes avec contrôleur d'abandon strict.</li>
          <li><strong>Protection des données :</strong> Drapeau <code>ENABLE_WRITES=false</code> pour sécuriser les tests.</li>
          <li><strong>Plan de secours Démo :</strong> Mode simulation actif (catalogue de 15 matériaux réels à Abidjan).</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: "1.25rem", color: "#374151" }}>Outils HTTPS exposés pour l'Agent Vocal</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {tools.map((t, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", backgroundColor: "#f9fafb" }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", color: "#1f2937" }}>{t.name}</h3>
              <p style={{ margin: "0 0 0.5rem", color: "#4b5563", fontSize: "0.95rem" }}>{t.desc}</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "4px", fontSize: "0.85rem", fontWeight: 600 }}>
                  {t.route}
                </span>
                <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>Exemple payload : <code>{t.input}</code></span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb", color: "#9ca3af", fontSize: "0.85rem" }}>
        Consulter <code>CONTRAT.md</code> pour les schémas JSON exhaustifs et les cas d'erreurs.
      </footer>
    </main>
  );
}
