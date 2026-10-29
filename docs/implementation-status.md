# État d'implémentation — BLOK Relance

Tenu à jour à chaque étape. « Terminé » = implémenté **et** vérifié.

## Implémenté et testé (41 tests verts : 28 unitaires, 13 e2e)

- Socle NestJS strict + Swagger `/api/docs` + `GET /health` (`manual_only`).
- PostgreSQL + migration initiale relue (9 tables, contraintes, index).
- Consentements/oppositions (+ historique), file de tâches (transitions
  fermées, idempotence, réservation atomique), tentatives/outcomes
  (refus ⇒ opposition auto), listes de matériaux, transferts (+ reprise),
  journal des décisions et des actions opérateurs.
- Moteur de règles v1.0.0 : 11 codes, fuseau `Africa/Abidjan`, silence 20 h–8 h.
- Connecteur Core : catalogue, clients, RFQ (enveloppe 201 validée), erreurs
  typées, mode secours `mock`, écritures verrouillées par défaut.
- 6 outils vocaux (garde, allowlist, corrélation) ; aucun outil d'appel.
- Téléphonie inerte : double verrou + aucun fournisseur (prouvé par test).
- Planificateur : réévalue/journalise/bloque, ne compose jamais.
- Interface Next.js : dashboard, file, fiche (décisions/tentatives/
  consentement), transferts, journal, consentements — 5 pages fumées 200.
- Auth : jetons opérateurs + rôles, secret outils, tout fermé par défaut.

## Implémenté mais non testé avec un service réel

- Connecteur Core en mode réel (aucune clé de test fournie) : schémas
  clients/produits, pagination `customers`, `POST /notifications`,
  quotas/429, suivi RFQ.
- Enregistrement des 6 outils sur l'agent AethexAI (procédure prête,
  `create_agent.py` inchangé en attendant).
- `POST /add_to_cart` et `GET /quotes/{id}/pdf` non câblés (pas de parcours).

## Bloqué par un accès externe

- Lecture projets/devis/commandes par client (déclenchement auto + scoring).
- Schémas de réponse Core, permissions manquantes, quotas.
- Téléphonie sortante : fournisseur, émetteur, éligibilité CI.
- Doctrine consentement/conservation (DPO/juridique), IdP opérateur.

## Contrat non vérifié

- Réponses `customers`, `products`, `notifications`, `smart-rfqs`.
- Auth des specs admin/web ; webhooks (aucun documenté).
- Champs téléphone, statuts clients, stocks/disponibilités.

## Volontairement désactivé

- Appels sortants (triple verrou), écritures Core (`ENABLE_CORE_WRITES`),
  notifications externes, scoring commercial (aucun signal d'intention
  vérifiable), synchronisation massive clients.

## Docker (ajout phase locale durable)

- Créé : `docker-compose.yml` + `docker-compose.override.yml` (bind mounts,
  volumes `pgdata`/`*_node_modules`, healthchecks, ports 127.0.0.1),
  3 Dockerfiles + `.dockerignore`, `.env.docker.example`, `docs/docker.md`.
- Services réels : `postgres`, `backend-api`, `frontend-commercial`,
  `voice-agent`, `migrate`. Non retenus et justifiés : redis, worker, reverse-proxy.
- Validé sans daemon : `docker compose config` uniquement. Builds, watched
  reload, persistance et healthchecks : **à exécuter sur machine avec daemon**.
