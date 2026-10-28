# Sécurité — BLOK Relance

## Posture

- **Prospection automatique interdite** dans cette phase : `manual_only` par
  défaut. La protection est triple : (1) `OUTBOUND_CALLS_ENABLED=false` par
  défaut, (2) ligne `telephony_outbound` inactive en base, (3) **aucun
  fournisseur câblé** — `TelephonySafetyService.placeCall()` refuse dans tous
  les cas (testé : même « activé », aucun appel ne peut partir). Le
  planificateur ne réserve ni ne compose jamais.
- **Consentement** : numéro ≠ preuve. Inconnu/doute = blocage. Opposition =
  effet immédiat sur toutes les tâches + journal. Levée d'opposition :
  rôle admin uniquement, authentifiée, journalisée (`operator_actions`),
  base légitime à documenter avec le DPO.
- **Secrets** : `X-API-Key` Core et secrets AethexAI confinés serveur
  (connecteur / garde outils) ; jamais au navigateur (l'UI Next n'envoie que
  des appels same-origin), jamais dans les prompts, jamais journalisés ;
  TLS non désactivé ; 401/403 Core jamais contournés.
- **Isolation** : `customer_ref` / `organization_id` fournis par l'agent ou
  le navigateur ne sont jamais crus : droits vérifiés serveur, l'agent ne
  reçoit que le contexte de la conversation en cours.

## Authentification et rôles

- Opérateurs : jetons opaques (`OPERATOR_ADMIN_TOKEN`, `OPERATOR_SALES_TOKEN`),
  comparaison SHA-256 à temps constant, rôles `admin` / `sales` appliqués
  backend (`@Roles`) : journaux + activations + levées d'opposition = admin.
  **Dev-grade** : migrer vers un IdP avant production (aucun mot de passe
  géré ici, rotation manuelle).
- Outils vocaux : `x-voice-tool-secret` ≥ 16 caractères, temps constant ;
  secret absent = outils désactivés (503), pas de dégradé silencieux.
- Fermé par défaut : sans jeton configuré, tout accès protégé est refusé ;
  `/health` et `/api/docs` restent les seules routes publiques.

## Journalisation et données

- Logs Nest (corrélation : `correlationId` des outils, ids tâche/tentative) ;
  erreurs techniques expurgées ; `technical_error` ≤ 500 caractères, sans secret.
- Transcriptions non conservées par défaut ; preuves = références
  (`proof_ref`). Conservation/accès journaux : durées à fixer avec le DPO.
- Aucune conformité juridique affirmée sans validation appropriée.

## Revue de cette phase (vérifiée)

- [x] Aucun secret dans le code, les tests ou les fixtures (balayage effectué).
- [x] 41 tests verts dont : opposition bloque, sans-consentement bloque,
  fréquence/concurrence, idempotence, panne ≠ échec, garde outils, rôles,
  téléphonie inerte par défaut (double verrou + aucun fournisseur).
- [x] Flask/proxy vocal existant intact (aucun fichier `blok_voice/` modifié).
- [x] Migrations relues, `synchronize: false`, contraintes + index posés.
- [ ] IdP opérateur, rotation des secrets, durées de conservation : **à faire**.
- [ ] Clé Core réelle, schémas clients/produits, quotas : **en attente Core**.
