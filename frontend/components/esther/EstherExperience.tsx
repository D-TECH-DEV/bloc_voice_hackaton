"use client";

import { useState } from "react";
import { decideOrbMode, ORB_LABELS } from "@/lib/esther-machine";
import { formatMontant, type DevisPret } from "@/lib/recap";
import { EstherOrb } from "./EstherOrb";
import { useSessionFeed } from "./useSessionFeed";
import { useTranscript } from "./useTranscript";
import { useVoiceEngine } from "./useVoiceEngine";

/**
 * Expérience vocale ESTHER : orb central piloté par les signaux réels
 * (niveaux audio WebRTC, événements backend), commandes sobres,
 * transcription visiteur discrète, panier temps réel, devis final réel.
 */
export function EstherExperience({
  sessionId,
  voiceBaseUrl,
}: {
  sessionId: string;
  voiceBaseUrl: string;
}) {
  const engine = useVoiceEngine(voiceBaseUrl);
  const feed = useSessionFeed(sessionId);
  const transcript = useTranscript(engine.phase === "live");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const decision = decideOrbMode(
    {
      phase: engine.phase,
      micOpen: engine.micOpen && !engine.micMuted,
      micLevel: engine.micLevel,
      remoteLevel: engine.remoteLevel,
      lastMicActiveAt: engine.lastMicActiveAt,
      now: Date.now(),
    },
    {
      searchFlashAt: feed.searchFlashAt,
      now: Date.now(),
      finalizing,
      quoteReady: feed.quote !== null,
    },
  );

  async function finalizeQuote() {
    if (finalizing) return;
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const res = await fetch(`/api/quote-finalize/${sessionId}`, { method: "POST" });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(corps?.message ?? `Préparation impossible (HTTP ${res.status}).`);
      }
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : "Préparation impossible.");
      setFinalizing(false);
    }
    // Succès : la scrutation détecte le devis prêt et affiche la vue finale.
  }

  const quote: DevisPret | null = feed.quote;
  const canTalk = engine.phase === "live";
  const selections = feed.recap?.selectionnes ?? [];
  const proposes = feed.recap?.proposes ?? [];

  return (
    <div className="esther">
      <audio ref={engine.attachAudio} autoPlay playsInline />

      <section className="esther-stage" aria-live="polite">
        <p className="esther-kicker">Agente commerciale virtuelle BLOK</p>
        <EstherOrb mode={decision.mode} energy={decision.energy} />
        <h2 className="esther-status">{ORB_LABELS[decision.mode]}</h2>
        {decision.mode === "accueil" && (
          <p className="esther-invite">Parlez-moi de vos besoins en matériaux de construction.</p>
        )}
        {engine.phase === "live" && (
          <p className="esther-indicators">
            <span className={`pill ${engine.micMuted ? "blocked" : "active"}`}>
              {engine.micMuted ? "Micro coupé" : "Micro actif"}
            </span>{" "}
            <span className={`pill ${engine.audioConnected ? "done" : "pending"}`}>
              {engine.audioConnected ? "Audio connecté" : "Audio…"}
            </span>
          </p>
        )}
        {engine.error && (
          <div className="error" role="alert">
            {engine.error}
          </div>
        )}
        {feed.feedError && <p className="muted">{feed.feedError}</p>}

        <div className="esther-controls">
          {(engine.phase === "idle" || engine.phase === "ended" || engine.phase === "error") && (
            <button type="button" className="esther-primary" onClick={() => void engine.start()}>
              {engine.phase === "idle" ? "Parler à ESTHER" : "Reprendre la conversation"}
            </button>
          )}
          {canTalk && (
            <>
              <button type="button" className="secondary" onClick={engine.toggleMute}>
                {engine.micMuted ? "Réactiver le micro" : "Couper le micro"}
              </button>
              <button type="button" className="danger" onClick={engine.end}>
                Terminer
              </button>
            </>
          )}
          {engine.phase === "connecting" && (
            <button type="button" disabled>
              Connexion…
            </button>
          )}
        </div>
        <div className="esther-toggles">
          <button type="button" className="secondary esther-mini" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? "Masquer la transcription" : "Voir la transcription"}
          </button>
          <button type="button" className="secondary esther-mini" onClick={() => setShowCart((v) => !v)}>
            {showCart ? "Masquer le panier" : `Voir le panier (${selections.length})`}
          </button>
        </div>
      </section>

      <div className="esther-side">
        {showTranscript && (
          <section className="card" aria-label="Transcription">
            <h2>Transcription</h2>
            {!transcript.supported && (
              <p className="muted">Reconnaissance vocale non prise en charge par ce navigateur.</p>
            )}
            {transcript.utterances.length === 0 ? (
              <div className="empty">Vos paroles apparaîtront ici pendant la conversation.</div>
            ) : (
              <ul className="esther-talk">
                {transcript.utterances.map((u) => (
                  <li key={u.id}>
                    <span className="muted">{u.at} — vous : </span>
                    {u.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">
              Transcription de votre voix par le navigateur uniquement. Les réponses vocales
              d’ESTHER ne sont pas transcrites : le moteur vocal ne fournit aucun texte.
            </p>
          </section>
        )}

        {showCart && (
          <section className="card" aria-label="Panier commercial">
            <h2>Panier commercial</h2>
            {selections.length === 0 && proposes.length === 0 ? (
              <div className="empty">ESTHER y ajoutera les matériaux identifiés pendant l’échange.</div>
            ) : (
              <>
                {selections.length > 0 && (
                  <>
                    <h3>Confirmés ({selections.length})</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Qté</th>
                          <th>Prix unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selections.map((p) => (
                          <tr key={p.id}>
                            <td>{p.label}</td>
                            <td>
                              {p.qty !== null ? `${p.qty}${p.unit ? ` ${p.unit}` : ""}` : "non précisée"}
                            </td>
                            <td>
                              {p.unitPrice !== null
                                ? formatMontant(p.unitPrice, p.currency)
                                : "Prix non communiqué"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {proposes.length > 0 && (
                  <p className="muted">À confirmer : {proposes.length} produit(s) proposé(s) par ESTHER.</p>
                )}
                {feed.recap?.totalEstime && (
                  <p>
                    <strong>
                      Total calculable :{" "}
                      {formatMontant(feed.recap.totalEstime.montant, feed.recap.totalEstime.devise)}
                    </strong>
                  </p>
                )}
              </>
            )}
            <p className="muted">Prix et disponibilités issus du catalogue BLOK, jamais inventés.</p>
          </section>
        )}

        {feed.catalogEvents.length > 0 && (
          <section className="card" aria-label="Catalogue">
            <h2>Catalogue consulté</h2>
            <ul className="esther-talk">
              {feed.catalogEvents.map((e) => (
                <li key={e.id}>
                  <code>{e.query}</code> — {e.resultCount} résultat(s) <span className="muted">({e.at})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="card esther-quote" aria-label="Devis">
        <h2>Devis commercial</h2>
        {quote ? (
          <div>
            <p>
              <strong>Votre devis est prêt !</strong>
            </p>
            <p className="muted">ESTHER a terminé la préparation de votre demande.</p>
            <p>
              Devis <code>{quote.numero}</code> · statut{" "}
              <span className={`pill ${quote.statut === "définitif" ? "done" : "in_progress"}`}>
                {quote.statut}
              </span>
            </p>
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
                {quote.lignes.map((l, i) => (
                  <tr key={i}>
                    <td>{l.label}</td>
                    <td>{l.qty !== null ? `${l.qty}${l.unit ? ` ${l.unit}` : ""}` : "non précisée"}</td>
                    <td>{l.unitPrice !== null ? formatMontant(l.unitPrice, l.currency) : "Prix non communiqué"}</td>
                    <td>{formatMontant(l.sousTotal, l.currency)}</td>
                    <td>{l.statutFr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quote.total ? (
              <p>
                <strong>Total : {formatMontant(quote.total.montant, quote.total.devise)}</strong>
              </p>
            ) : (
              <p>
                <strong>Total non calculable.</strong>
              </p>
            )}
            <p>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/api/quote-download/${quote.downloadToken}`;
                }}
              >
                Télécharger mon devis
              </button>{" "}
              <button type="button" className="secondary" onClick={() => void engine.start()}>
                Reprendre la conversation
              </button>
            </p>
          </div>
        ) : (
          <div>
            {engine.phase === "ended" && selections.length > 0 ? (
              <p>
                <button type="button" onClick={() => void finalizeQuote()} disabled={finalizing}>
                  {finalizing ? "ESTHER prépare votre devis…" : "Obtenir mon devis"}
                </button>
              </p>
            ) : (
              <p className="muted">
                Votre devis apparaîtra ici à la fin de la conversation, après confirmation de vos
                produits.
              </p>
            )}
            {finalizeError && (
              <div className="error" role="alert">
                {finalizeError}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
