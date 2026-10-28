# Contrats Core API — état vérifié

Base : `https://core-api-dev.blok.africa/api/external`. Auth : header
`X-API-Key` (clé générée via le CRUD admin `client-api-keys`, `plain_key`
retournée une seule fois). Spécification : `…/external/docs?api-docs-external.json`
(OpenAPI 3.0.0, « BLOK External API v1.0.0 », 30 paths — snapshot local
conforme, zéro dérive constatée entre l'audit et ce développement).

## Endpoints exploités

### `POST /products` — recherche catalogue
- Corps (optionnel) : `limit` (1–100), `offset`, `category_id`, `search`,
  `min_price`, `max_price`, `organization_id`. Pagination manuelle.
- Permission : `access_external_products`. Erreurs : 400 (validation !),
  401, 403, 500. **Réponse non schématisée** → `CatalogAdapter` : accepte
  `[]` ou `{data|products|items: []}`, extrait les clés candidates
  (`product_variant_id`, `name|nom|label`, `price|prix`, `unit`,
  `available|stock…`), le reste est ignoré ; champs absents = `null` +
  fanions `prixVerifie` / `dispoVerifiee` à `false`.

### `GET /customers`, `GET /customers/{id}` — annuaire
- Aucun paramètre ni schéma documentés. `CustomersAdapter.getById` :
  extrait référence + nom candidat, **téléphone toujours `verifie: false`**,
  usage informatif uniquement (jamais pour composer un appel).

### `POST /rfqs` — création de demande
- Requis : `organization_id` (entier). Optionnels : `file_name`,
  `line_items[]` (`extracted_text`, `matched_product(s)`).
- Permission : `access_external_create_rfqs`. Succès 201, seule enveloppe
  schématisée de la spec : `{error: false, message, data: object}` —
  validée en runtime (`RfqAdapter`) ; succès non confirmé = erreur.
- Erreurs : 401, 403, 422, 500. **Suivi (liste/détail/statut) non exposé** :
  `RfqAdapter.track()` échoue explicitement.

### `POST /add_to_cart` — écriture panier
- `user_id` + `organization_id` (+ contrôle d'appartenance), ligne simple ou
  `items[]`. **Lecture du panier absente** → non exploité pour l'intention.

### `GET /quotes/{id}/pdf` — PDF d'un devis connu
- Lecture par id uniquement ; pas de liste ni statut → non câblé (aucun
  parcours ne connaît l'id sans accès devis).

### `POST /notifications` — CONTRAT NON VÉRIFIÉ
- Route existante (« Notifier un utilisateur », 201) sans corps documenté.
  `NotificationsAdapter.send()` refuse explicitement : les transferts vivent
  en interne (`handoffs`, `external_notification_ref = NULL`) jusqu'à
  validation. Aucune notification fantôme.

## Règles transverses du connecteur (`BlokCoreClient`)

- Timeout explicite (défaut 8 s), `AbortController`, aucune donnée de
  remplacement en cas de panne (`CORE_UNAVAILABLE`).
- Erreurs typées : `CORE_VALIDATION` (400 **et** 422 — incohérence
  documentée des specs), `CORE_FORBIDDEN` (403, contournement interdit),
  `CORE_NOT_FOUND`, `CORE_ERROR`. Jamais de retry automatique sur écriture.
- `MOCK_CORE=true` (ou clé absente) : fixtures fictives marquées
  `mock: true` (`fixtures.ts`, ids `9001…`, `demo-client-*`). Prix/stock des
  fixtures = `null` (aucune valeur inventée).
- `ENABLE_CORE_WRITES=false` par défaut : `assertWritesEnabled()` bloque
  RFQ/panier/notifications.

## Limites confirmées (pas de routes)

Commandes, devis (liste/détail/statuts), projets, paiements, livraisons,
utilisateurs, appels, consentements, analytique, webhooks : **absents** de
l'API externe (vérifié par balayage des 30 paths). Disponibilité/stock et
schémas clients/produits : **non documentés**. Rate limits : **aucune
mention, aucun 429** dans les 4 documentations.
