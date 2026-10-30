# Devis automatique en fin de conversation avec ESTHER

Parcours : conversation vocale → sélections confirmées → finalisation
→ « Votre devis est prêt ! » → téléchargement PDF.

## Règles d'honnêteté (rappel)

- Prix et disponibilités **revérifiés au catalogue à la génération**
  (`POST /products` via `CatalogAdapter`). Un prix enregistré pendant
  l'échange n'est jamais repris comme actuel.
- Prix absent → « Prix non communiqué », ligne exclue du total.
- Disponibilité non vérifiable → « Disponibilité à confirmer ».
- Produit indisponible → « Indisponible », exclu du total des commandables.
- Total = somme des lignes calculables, devise unique exigée ; sinon
  `null` + raisons explicites. Devis `provisoire` tant qu'une ligne
  n'est pas entièrement vérifiée.
- Aucun frais de livraison, taxe ou remise : non fournis par l'API.
- En mode `MOCK_CORE` (ou catalogue injoignable), le devis reste
  **provisoire et marqué simulé**, jamais chiffré fictivement.

## Endpoints backend (`QuotesController`)

| Méthode | Route | Auth | Effet |
|---|---|---|---|
| `POST` | `/api/v1/relance/quotes/from-session` `{ sessionId }` | opérateur `admin`/`sales` | Finalise (idempotent : répéter renvoie l'existant, aucun doublon) |
| `GET` | `/api/v1/relance/quotes/by-session/:sessionId` | opérateur `admin`/`sales` | `{ pret: false }` ou `{ pret: true, devis }` (scruté par le frontend) |
| `GET` | `/api/v1/relance/quotes/download/:token` | **publique, jeton seul** | PDF (`attachment`) ; 404 uniforme si jeton inconnu/malformé |

Numéro unique serveur `DEV-AAAA-XXXXXX`, jeton hex 64 car. imprédictible.
Aucune route par identifiant de session (pas de fuite inter-visiteurs).

## Frontend (page visiteur)

- `RecapLive` scrute `/api/session-quote/[id]` toutes les 3 s (non bloquant).
- Session terminée + sélections → bouton « Finaliser mon devis »
  (`POST /api/quote-finalize/[id]`, garde anti-clics + idempotence serveur).
- Devis prêt → « Votre devis est prêt ! », tableau avec statuts,
  total ou raisons, boutons « Télécharger mon devis PDF »
  (`/api/quote-download/[token]`), « Reprendre la conversation avec ESTHER »,
  « Modifier ma demande ».
- Le jeton opérateur ne quitte jamais le serveur (relais same-origin).

## ESTHER (voix)

Prompt §8BIS : récapituler, demander « Souhaitez-vous que je prépare
votre devis ? », confirmer via `confirm_selections`, terminer via
`end_conversation`, annoncer l'affichage « Votre devis est prêt ! » + PDF.
**Ne calcule jamais de total elle-même.** Aucun nouvel outil vocal requis
(les 9 outils existants sont inchangés).

## Fichiers

- Backend : `src/quotes/` (entité, `quote-lines.ts`, `quote-pdf.ts`,
  service, contrôleur, DTO, module, specs), migration
  `migrations/1760000000002-Quotes.ts`, `test/e2e/quotes.e2e-spec.ts`.
- Voix : `blok_voice/agent/create_agent.py` (§8BIS),
  `blok_voice/agent/test_esther_identity.py`.
- Frontend : `lib/recap.ts` (types), `app/api/session-quote|quote-finalize|quote-download/`,
  `app/conversation/recap-live.tsx`.
