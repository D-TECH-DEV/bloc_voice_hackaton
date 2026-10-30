"use client";

import { useEffect, useState } from "react";
import {
  formatMontant,
  type DevisLigne,
  type DevisPret,
  type EtatDevis,
  type RecapItemView,
  type SessionRecap,
} from "@/lib/recap";

const VOICE_CLIENT_URL = "http://127.0.0.1:5000/";

function SourceBadge({ simulee, source }: { simulee: boolean; source: string }) {
  if (!simulee) return <span className="pill done">BLOK vérifié</span>;
  return (
    <span className="pill simulated" title="Données de démonstration, explicitement simulées">
      SIMULÉ — démonstration
    </span>
  );
}

function ProduitsTable({ items, caption }: { items: RecapItemView[]; caption: string }) {
  if (items.length === 0) return <div className="empty">{caption}</div>;
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Réf.</th>
            <th>Qté</th>
            <th>Prix unit.</th>
            <th>Sous-total</th>
            <th>Origine</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.label}</td>
              <td>
                <code>{p.ref ?? (p.variantId !== null ? `#${p.variantId}` : "sans réf.")}</code>
              </td>
              <td>{p.qty !== null ? `${p.qty}${p.unit ? ` ${p.unit}` : ""}` : "non précisée"}</td>
              <td>{formatMontant(p.unitPrice, p.currency)}</td>
              <td>{formatMontant(p.sousTotal, p.currency)}</td>
              <td>{p.source === "core" ? "BLOK" : "simulée"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DevisTable({ lignes }: { lignes: DevisLigne[] }) {
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Qté</th>
            <th>Prix unit.</th>
            <th>Sous-total</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td>
                {l.label}{" "}
                <code>{l.ref ?? (l.variantId !== null ? `#${l.variantId}` : "sans réf.")}</code>
              </td>
              <td>{l.qty !== null ? `${l.qty}${l.unit ? ` ${l.unit}` : ""}` : "non précisée"}</td>
              <td>{l.unitPrice !== null ? formatMontant(l.unitPrice, l.currency) : "Prix non communiqué"}</td>
              <td>{formatMontant(l.sousTotal, l.currency)}</td>
              <td>{l.statutFr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Panneau vivant du récapitulatif : interroge le backend toutes les 3 s
 * pendant l'appel (pas de WebSocket : HTTP suffit, re-GET = reconnexion),
 * s'arrête quand la conversation est terminée.
 */
export default function RecapLive({ sessionId, initial }: { sessionId: string; initial: SessionRecap }) {
  const [recap, setRecap] = useState<SessionRecap>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actualise, setActualise] = useState<string>(new Date().toLocaleTimeString("fr-FR"));
  const [devis, setDevis] = useState<DevisPret | null>(null);
  const [finalisation, setFinalisation] = useState<boolean>(false);
  const [erreurDevis, setErreurDevis] = useState<string | null>(null);

  useEffect(() => {
    if (recap.statut === "ended") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/session-recap/${sessionId}`, { cache: "no-store" });
        if (!res.ok) {
          setErreur(`Actualisation impossible (HTTP ${res.status}). Dernières données conservées.`);
          return;
        }
        const data = (await res.json()) as SessionRecap;
        setRecap(data);
        setErreur(null);
        setActualise(new Date().toLocaleTimeString("fr-FR"));
        if (data.statut === "ended") clearInterval(timer);
      } catch {
        setErreur("Backend injoignable. Dernières données conservées — réessai automatique.");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [sessionId, recap.statut]);

  useEffect(() => {
    if (devis !== null) return; // devis prêt : plus besoin de scruter
    let arrete = false;
    async function scruterDevis() {
      try {
        const res = await fetch(`/api/session-quote/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as EtatDevis;
        if (!arrete && data.pret) setDevis(data.devis);
      } catch {
        // Devis non bloquant : le récapitulatif reste affiché, réessai au prochain tour.
      }
    }
    void scruterDevis();
    const timer = setInterval(async () => {
      if (arrete) return;
      await scruterDevis();
    }, 3000);
    return () => {
      arrete = true;
      clearInterval(timer);
    };
  }, [sessionId, devis]);

  async function finaliserDevis() {
    if (finalisation) return; // garde anti-clics répétés (backend idempotent de toute façon)
    setFinalisation(true);
    setErreurDevis(null);
    try {
      const res = await fetch(`/api/quote-finalize/${sessionId}`, { method: "POST" });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(corps?.message ?? `Finalisation impossible (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as DevisPret;
      setDevis(data);
    } catch (e) {
      setErreurDevis(e instanceof Error ? e.message : "Finalisation impossible.");
    } finally {
      setFinalisation(false);
    }
  }

  return (
    <div>
      <div className="card">
        <p>
          Statut : <span className={`pill ${recap.statut}`}>{recap.statut}</span>{" "}
          <SourceBadge simulee={recap.donneesSimulees} source={recap.source} />{" "}
          <span className="muted">
            source : {recap.source} · client : <code>{recap.customerRef ?? "non renseigné"}</code>
          </span>
        </p>
        {recap.donneesSimulees && (
          <p className="muted">
            Données de démonstration explicitement simulées : aucun prix réel tant que l’intégration BLOK
            n’est pas validée.
          </p>
        )}
        <p className="muted">
          {recap.statut === "active"
            ? `Conversation en cours — actualisé à ${actualise}.`
            : `Conversation terminée le ${recap.endedAt ? new Date(recap.endedAt).toLocaleString("fr-FR") : "—"}.`}
        </p>
        {erreur && (
          <div className="error" role="alert">
            {erreur}
          </div>
        )}
      </div>

      <h2>Recherches effectuées ({recap.recherches.length})</h2>
      {recap.recherches.length === 0 ? (
        <div className="empty">Aucune recherche catalogue dans cette conversation pour l’instant.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Requête</th>
                <th>Résultats</th>
                <th>Origine</th>
              </tr>
            </thead>
            <tbody>
              {recap.recherches.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.query}</code>
                  </td>
                  <td>{r.resultCount}</td>
                  <td>{r.source === "core" ? "BLOK" : "simulée"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Produits proposés ({recap.proposes.length})</h2>
      <ProduitsTable items={recap.proposes} caption="Aucun produit proposé pour l’instant." />

      <h2>Produits sélectionnés — accord client ({recap.selectionnes.length})</h2>
      <ProduitsTable items={recap.selectionnes} caption="Aucune sélection confirmée par le client." />

      <h2>Total estimé</h2>
      {recap.totalEstime ? (
        <div className="card">
          <p>
            <strong>{formatMontant(recap.totalEstime.montant, recap.totalEstime.devise)}</strong>{" "}
            <span className="muted">(sélections confirmées uniquement)</span>
          </p>
        </div>
      ) : (
        <div className="card">
          <p>
            <strong>Total non calculable.</strong>
          </p>
          <ul>
            {recap.totalNonCalculableRaisons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {recap.informationsManquantes.length > 0 && (
        <>
          <h2>Informations manquantes</h2>
          <div className="card">
            <ul>
              {recap.informationsManquantes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h2>Demande de devis</h2>
      <div className="card">
        {recap.demandeDevis.statut === "demandée" ? (
          <p>
            Statut : <span className="pill in_progress">demandée</span> · numéro{" "}
            <code>{recap.demandeDevis.numero}</code>
            {recap.demandeDevis.simulee ? " (simulée)" : " (BLOK)"} · suivi : indisponible.
          </p>
        ) : (
          <p>
            Statut : <span className="pill">non demandée</span>
          </p>
        )}
        <p className="muted">Une demande de devis n’est ni un devis confirmé ni une commande.</p>
      </div>

      <h2>Devis commercial</h2>
      {devis ? (
        <div>
          <div className="card">
            <p>
              <strong>Votre devis est prêt !</strong> · numéro <code>{devis.numero}</code> · statut{" "}
              <span className={`pill ${devis.statut === "définitif" ? "done" : "in_progress"}`}>
                {devis.statut}
              </span>{" "}
              {devis.donneesSimulees && <span className="pill simulated">SIMULÉ — démonstration</span>}
            </p>
            {devis.statut === "provisoire" && (
              <p className="muted">
                Devis provisoire : certaines informations restent à confirmer (voir statuts des lignes).
              </p>
            )}
          </div>
          <DevisTable lignes={devis.lignes} />
          <div className="card">
            {devis.total ? (
              <p>
                <strong>
                  Total (produits commandables) : {formatMontant(devis.total.montant, devis.total.devise)}
                </strong>
              </p>
            ) : (
              <p>
                <strong>Total non calculable.</strong>
              </p>
            )}
            {devis.raisons.length > 0 && (
              <ul>
                {devis.raisons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <p>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/api/quote-download/${devis.downloadToken}`;
                }}
              >
                Télécharger mon devis PDF
              </button>{" "}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  window.location.href = VOICE_CLIENT_URL;
                }}
              >
                Reprendre la conversation avec ESTHER
              </button>{" "}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  window.location.href = "/conversation";
                }}
              >
                Modifier ma demande
              </button>
            </p>
            <p className="muted">
              Montants calculés par le système à partir du catalogue revérifié, jamais par l’IA.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          {recap.statut === "ended" && recap.selectionnes.length > 0 ? (
            <p>
              <button type="button" onClick={finaliserDevis} disabled={finalisation}>
                {finalisation ? "Préparation du devis…" : "Finaliser mon devis"}
              </button>
            </p>
          ) : (
            <p className="muted">
              {recap.selectionnes.length === 0
                ? "Aucune sélection confirmée pour l’instant : le devis se prépare ici dès qu’ESTHER aura confirmé vos produits."
                : "La finalisation sera possible à la fin de la conversation, après confirmation de vos produits par ESTHER."}
            </p>
          )}
          {erreurDevis && (
            <div className="error" role="alert">
              {erreurDevis}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
