"use client";

import { useEffect, useRef, useState } from "react";
import type { DevisPret, EtatDevis, SessionRecap } from "@/lib/recap";

export interface CatalogEvent {
  id: string;
  query: string;
  resultCount: number;
  at: string;
}

/**
 * Fil de données de la session : récapitulatif (propositions, sélections,
 * total) et devis, via les relais same-origin existants. La détection d'une
 * NOUVELLE recherche catalogue est un fait backend réel (compteur croissant),
 * pas une animation : c'est lui qui pilote l'état « recherche » de l'orb.
 */
export function useSessionFeed(
  sessionId: string,
  pollMs = 3000,
): {
  recap: SessionRecap | null;
  quote: DevisPret | null;
  catalogEvents: CatalogEvent[];
  searchFlashAt: number;
  feedError: string | null;
} {
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [quote, setQuote] = useState<DevisPret | null>(null);
  const [catalogEvents, setCatalogEvents] = useState<CatalogEvent[]>([]);
  const [searchFlashAt, setSearchFlashAt] = useState(0);
  const [feedError, setFeedError] = useState<string | null>(null);
  const seenSearchesRef = useRef<Set<string>>(new Set());
  const firstRunRef = useRef(true);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      try {
        const [recapRes, quoteRes] = await Promise.all([
          fetch(`/api/session-recap/${sessionId}`, { cache: "no-store" }),
          fetch(`/api/session-quote/${sessionId}`, { cache: "no-store" }),
        ]);
        if (stopped) return;
        if (recapRes.ok) {
          const data = (await recapRes.json()) as SessionRecap;
          setRecap(data);
          const fresh: CatalogEvent[] = [];
          for (const r of data.recherches) {
            if (!seenSearchesRef.current.has(r.id)) {
              seenSearchesRef.current.add(r.id);
              // Premier chargement : amorcer sans « flash » (recherches déjà connues).
              if (!firstRunRef.current) {
                fresh.push({
                  id: r.id,
                  query: r.query,
                  resultCount: r.resultCount,
                  at: new Date(r.searchedAt).toLocaleTimeString("fr-FR"),
                });
              }
            }
          }
          firstRunRef.current = false;
          if (fresh.length > 0) {
            setCatalogEvents((prev) => [...fresh, ...prev].slice(0, 6));
            setSearchFlashAt(Date.now());
          }
          setFeedError(null);
        }
        if (quoteRes.ok) {
          const qdata = (await quoteRes.json()) as EtatDevis;
          if (qdata.pret) setQuote(qdata.devis);
        }
      } catch {
        if (!stopped) setFeedError("Actualisation impossible. Dernières données conservées.");
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), pollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sessionId, pollMs]);

  return { recap, quote, catalogEvents, searchFlashAt, feedError };
}
