/**
 * Machine à états de l'interface vocale ESTHER — logique pure, sans DOM.
 *
 * Honnêteté des états (chaque état est piloté par un signal réel) :
 * - `accueil` : avant tout démarrage (aucun signal).
 * - `connexion` : session/offre SDP en cours (moteur WebRTC).
 * - `parole` : niveau audio DISTANT > seuil (analyseur Web Audio sur le
 *   flux reçu) — ESTHER parle réellement.
 * - `recherche` : le récapitulatif backend signale une NOUVELLE recherche
 *   catalogue depuis le dernier rendu (données réelles, retard ≈ scrutation).
 * - `devis` : finalisation demandée et devis pas encore prêt (requête réelle).
 * - `ecoute` : micro ouvert et niveau micro > seuil — le visiteur parle.
 * - `reflexion` : HEURISTIQUE documentée — micro récemment actif puis
 *   silence des deux côtés : transition parole→traitement détectée, jamais
 *   affirmée comme certitude moteur (aucun signal moteur ne l'indique).
 * - `veille` : connecté, micro ouvert, aucune activité (attente réelle).
 * - `termine` : connexion fermée par l'utilisateur. `erreur` : échec explicite.
 *
 * Syntaxe volontairement effaçable (erasableSyntaxOnly) : ce module est
 * exécuté tel quel par les tests via le type-stripping de Node.
 */

export type OrbMode =
  | "accueil"
  | "connexion"
  | "ecoute"
  | "reflexion"
  | "parole"
  | "recherche"
  | "devis"
  | "veille"
  | "termine"
  | "erreur";

export interface EngineSignals {
  phase: "idle" | "connecting" | "live" | "ended" | "error";
  micOpen: boolean;
  micLevel: number;
  remoteLevel: number;
  /** Horodatage (ms) de la dernière activité micro > seuil, 0 si jamais. */
  lastMicActiveAt: number;
  now: number;
}

export interface DataSignals {
  /** Horodatage (ms) de la dernière NOUVELLE recherche catalogue, 0 si aucune. */
  searchFlashAt: number;
  now: number;
  /** Finalisation du devis demandée, devis pas encore reçu. */
  finalizing: boolean;
  /** Devis prêt reçu du backend. */
  quoteReady: boolean;
}

export interface OrbDecision {
  mode: OrbMode;
  /** Amplitude 0..1 qui pilote l'orb (niveau réel du flux actif). */
  energy: number;
}

const SPEAK_THRESHOLD = 0.08;
const MIC_THRESHOLD = 0.08;
/** Fenêtre « le visiteur vient de parler » (réflexion possible). */
const THINK_WINDOW_MS = 15000;
/** Fraîcheur d'une nouvelle recherche catalogue. */
const SEARCH_FLASH_MS = 8000;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function decideOrbMode(engine: EngineSignals, data: DataSignals): OrbDecision {
  if (engine.phase === "error") return { mode: "erreur", energy: 0 };
  if (engine.phase === "idle") return { mode: "accueil", energy: 0.15 };
  if (engine.phase === "connecting") return { mode: "connexion", energy: 0.4 };
  if (engine.phase === "ended") {
    if (data.quoteReady) return { mode: "devis", energy: 0.5 };
    return { mode: "termine", energy: 0.1 };
  }
  // Phase "live" ci-dessous.
  if (engine.remoteLevel > SPEAK_THRESHOLD) {
    return { mode: "parole", energy: clamp01(engine.remoteLevel) };
  }
  if (data.finalizing && !data.quoteReady) {
    return { mode: "devis", energy: 0.55 };
  }
  if (data.searchFlashAt > 0 && data.now - data.searchFlashAt < SEARCH_FLASH_MS) {
    return { mode: "recherche", energy: 0.6 };
  }
  if (engine.micOpen && engine.micLevel > MIC_THRESHOLD) {
    return { mode: "ecoute", energy: clamp01(engine.micLevel) };
  }
  if (
    engine.micOpen &&
    engine.lastMicActiveAt > 0 &&
    engine.now - engine.lastMicActiveAt < THINK_WINDOW_MS
  ) {
    return { mode: "reflexion", energy: 0.3 };
  }
  return { mode: "veille", energy: 0.15 };
}

export const ORB_LABELS: Record<OrbMode, string> = {
  accueil: "Bonjour, je suis ESTHER",
  connexion: "Connexion à ESTHER…",
  ecoute: "ESTHER vous écoute",
  reflexion: "ESTHER réfléchit…",
  parole: "ESTHER vous répond",
  recherche: "Consultation du catalogue BLOK…",
  devis: "ESTHER prépare votre devis…",
  veille: "En conversation — à vous",
  termine: "Conversation terminée",
  erreur: "Connexion impossible",
};
